import { beforeEach, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Catalog seam tests (ticket 02). As in the auth suite, the only mocks are
// Next.js runtime transport (cookie jar, redirects, cache) — shared via
// src/test/browser-transport.ts. The Server Actions under test and the
// database are real.
// ---------------------------------------------------------------------------

vi.mock("next/headers", async () => (await import("@/test/browser-transport")).nextHeaders);
vi.mock("next/navigation", async () => (await import("@/test/browser-transport")).nextNavigation);
vi.mock("next/cache", async () => (await import("@/test/browser-transport")).nextCache);
vi.mock("next/server", async () => (await import("@/test/browser-transport")).nextServer);

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { signIn } from "@/lib/auth/actions";
import { ForbiddenError } from "@/lib/auth/errors";
import { cookieStore } from "@/test/browser-transport";
import {
  addPhotos,
  catalogItem,
  createItem,
  getItem,
  listItems,
  removePhoto,
  setCostBasis,
  updateItem,
  type ItemFormState,
} from "@/lib/catalog/actions";
import { CATEGORY_TEMPLATES } from "@/lib/catalog/categories";
import type { ItemCategory } from "@/generated/prisma/enums";

const initialFormState: ItemFormState = { error: null, fieldErrors: {} };

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

async function createUser(
  fields: Partial<{ email: string; name: string; password: string; role: "OWNER" | "CATALOGER" }> = {}
) {
  return prisma.user.create({
    data: {
      email: fields.email ?? "owner@test.local",
      name: fields.name ?? "Test Owner",
      passwordHash: await hashPassword(fields.password ?? "owner-password-1"),
      role: fields.role ?? "OWNER",
    },
  });
}

// Signing in succeeds by redirecting; every test that needs a signed-in user
// goes through this.
async function signInAs(email: string, password: string) {
  await expect(
    signIn({ error: null }, form({ email, password }))
  ).rejects.toThrow(/NEXT_REDIRECT/);
}

async function signInAsOwner() {
  await createUser();
  await signInAs("owner@test.local", "owner-password-1");
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "User", "Session", "Item", "Photo" CASCADE`
  );
  cookieStore.clear();
  // Photo tests configure Cloudinary per test; start each one clean.
  for (const key of [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ]) {
    delete process.env[key];
  }
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Photos. Cloudinary is the one external service in this slice; the network
// hop is stubbed with realistic responses (the same shape Cloudinary's API
// documents). Everything on our side of that hop is real.
// ---------------------------------------------------------------------------

const CLOUDINARY_TEST_ENV = {
  CLOUDINARY_CLOUD_NAME: "test-cloud",
  CLOUDINARY_API_KEY: "test-key",
  CLOUDINARY_API_SECRET: "test-secret",
};

function configurePhotoStorage() {
  for (const [key, value] of Object.entries(CLOUDINARY_TEST_ENV)) {
    process.env[key] = value;
  }
}

// Stubs fetch so every Cloudinary upload succeeds and returns sequential
// public ids (uploaded-1, uploaded-2, ...). Also records calls for asserts.
function stubCloudinaryApi() {
  let uploads = 0;
  const calls: { url: string; body: FormData }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: { body?: FormData }) => {
      const urlText = String(url);
      calls.push({ url: urlText, body: init?.body as FormData });
      if (urlText.endsWith("/image/destroy")) {
        return { ok: true, json: async () => ({ result: "ok" }) };
      }
      const id = ++uploads;
      return {
        ok: true,
        json: async () => ({
          public_id: `antiques/items/uploaded-${id}`,
          format: "jpg",
          width: 4000,
          height: 3000,
        }),
      };
    })
  );
  return calls;
}

function imageFile(name = "cabinet.jpg", type = "image/jpeg", bytes = 2048) {
  return new File([new Uint8Array(bytes)], name, { type });
}

function formWithPhotos(fields: Record<string, string>, files: File[]) {
  const fd = form(fields);
  for (const file of files) fd.append("photos", file);
  return fd;
}

test("an item can be recorded with camera photos, stored once with derived variant URLs", async () => {
  await signInAsOwner();
  configurePhotoStorage();
  const calls = stubCloudinaryApi();

  await expect(
    createItem(
      initialFormState,
      formWithPhotos(CABINET_FORM, [imageFile("cabinet-1.jpg"), imageFile("cabinet-2.jpg")])
    )
  ).rejects.toThrow(/NEXT_REDIRECT/);

  // The upload went to Cloudinary as a signed multipart request.
  expect(calls).toHaveLength(2);
  expect(calls[0].url).toBe(
    "https://api.cloudinary.com/v1_1/test-cloud/image/upload"
  );
  expect(calls[0].body.get("folder")).toBe("antiques/items");
  expect(calls[0].body.get("api_key")).toBe("test-key");
  expect(calls[0].body.get("signature")).toMatch(/^[0-9a-f]{40}$/);

  const [item] = await listItems({});
  expect(item.photoCount).toBe(2);
  // The catalog thumbnail is a derived URL: same original, scaled to 400px.
  expect(item.thumbnailUrl).toBe(
    "https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto,c_limit,w_400,h_400/antiques/items/uploaded-1.jpg"
  );

  const detail = await getItem(item.id);
  expect(detail?.photos).toHaveLength(2);
  expect(detail?.photos[0]).toMatchObject({
    position: 1,
    url: "https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto,c_limit,w_1200,h_1200/antiques/items/uploaded-1.jpg",
  });
  expect(detail?.photos[1]?.position).toBe(2);
});

test("photos can be added to an existing item and removed again", async () => {
  await signInAsOwner();
  configurePhotoStorage();
  const calls = stubCloudinaryApi();

  const id = await createSampleItem(CABINET_FORM);

  const added = await addPhotos(
    { error: null },
    formWithPhotos({ itemId: id }, [imageFile("extra.jpg")])
  );
  expect(added.error).toBeNull();
  expect((await getItem(id))?.photos).toHaveLength(1);

  // Then remove it.
  const photoId = (await getItem(id))?.photos[0]?.id;
  const removed = await removePhoto({ error: null }, form({ photoId: photoId! }));
  expect(removed.error).toBeNull();
  expect((await getItem(id))?.photos).toHaveLength(0);
  expect((await listItems({}))[0].photoCount).toBe(0);

  // Removal also told Cloudinary to destroy the stored original.
  const destroyCall = calls.find((call) => call.url.endsWith("/image/destroy"));
  expect(destroyCall?.body.get("public_id")).toBe("antiques/items/uploaded-1");
});

test("photo uploads that are not images, or too large, are rejected", async () => {
  await signInAsOwner();
  configurePhotoStorage();
  const calls = stubCloudinaryApi();
  const id = await createSampleItem(CABINET_FORM);

  const notAnImage = await addPhotos(
    { error: null },
    formWithPhotos({ itemId: id }, [
      new File([new Uint8Array(10)], "notes.txt", { type: "text/plain" }),
    ])
  );
  expect(notAnImage.error).toContain("not an image");

  const tooLarge = await createItem(
    initialFormState,
    formWithPhotos(CABINET_FORM, [imageFile("huge.jpg", "image/jpeg", 11 * 1024 * 1024)])
  );
  expect(tooLarge.error).toBeTruthy();
  expect(tooLarge.fieldErrors.photos).toBeTruthy();

  // Nothing reached Cloudinary and nothing extra was stored.
  expect(calls).toHaveLength(0);
  expect((await getItem(id))?.photos).toHaveLength(0);
});

test("when photo storage is not configured, attaching photos is a clear error", async () => {
  await signInAsOwner();

  const result = await createItem(
    initialFormState,
    formWithPhotos(CABINET_FORM, [imageFile()])
  );

  expect(result.fieldErrors.photos).toBeTruthy();
  expect(result.fieldErrors.photos).toContain("README");
  expect(await listItems({})).toHaveLength(0);

  // ...but recording an item without photos still works (it rests as a Draft).
  await expect(
    createItem(initialFormState, form(CABINET_FORM))
  ).rejects.toThrow(/NEXT_REDIRECT/);
});

test("a Cataloger can add and remove photos — photo work is their job", async () => {
  await signInAsOwner();
  const id = await createSampleItem(CABINET_FORM);

  cookieStore.clear();
  await signInAsCataloger();
  configurePhotoStorage();
  stubCloudinaryApi();

  const added = await addPhotos(
    { error: null },
    formWithPhotos({ itemId: id }, [imageFile()])
  );
  expect(added.error).toBeNull();
  expect((await getItem(id))?.photos).toHaveLength(1);
});

test("an item can hold at most 10 photos", async () => {
  await signInAsOwner();
  configurePhotoStorage();
  stubCloudinaryApi();
  const id = await createSampleItem(CABINET_FORM);

  const fullBatch = await addPhotos(
    { error: null },
    formWithPhotos(
      { itemId: id },
      Array.from({ length: 10 }, (_, i) => imageFile(`photo-${i}.jpg`))
    )
  );
  expect(fullBatch.error).toBeNull();
  expect((await getItem(id))?.photos).toHaveLength(10);

  const eleventh = await addPhotos(
    { error: null },
    formWithPhotos({ itemId: id }, [imageFile("photo-11.jpg")])
  );
  expect(eleventh.error).toContain("10 photos");
  expect((await getItem(id))?.photos).toHaveLength(10);
});

test("the Owner can record a Furniture item, which rests as a Draft with the 50+ flag on", async () => {
  await signInAsOwner();

  // Creating succeeds by redirecting to the new item's page.
  await expect(
    createItem(
      initialFormState,
      form({
        name: "Jati Teak Cabinet",
        category: "FURNITURE",
        "attr.material": "Teak",
        "attr.style": "Colonial",
        "attr.heightCm": "180",
        "attr.widthCm": "90",
        "attr.depthCm": "45",
        conditionNotes: "One door hinge loose.",
        provenance: "From grandmother's house in Bandung.",
      })
    )
  ).rejects.toThrow(/NEXT_REDIRECT/);

  const items = await listItems({ view: "catalog" });
  expect(items).toHaveLength(1);
  expect(items[0].name).toBe("Jati Teak Cabinet");
  expect(items[0].category).toBe("FURNITURE");
  expect(items[0].state).toBe("DRAFT");
  expect(items[0].fiftyYearsOld).toBe(true);

  const detail = await getItem(items[0].id);
  expect(detail?.name).toBe("Jati Teak Cabinet");
  expect(detail?.state).toBe("DRAFT");
  expect(detail?.fiftyYearsOld).toBe(true);
  expect(detail?.attributes.material).toBe("Teak");
  expect(detail?.attributes.heightCm).toBe(180);
  expect(detail?.conditionNotes).toBe("One door hinge loose.");
  expect(detail?.provenance).toBe("From grandmother's house in Bandung.");
});

// One full, honest form per category: every template field filled in.
const CATEGORY_SAMPLE_FORMS: Record<ItemCategory, Record<string, string>> = {
  FURNITURE: {
    "attr.material": "Teak",
    "attr.style": "Colonial",
    "attr.period": "Early 20th century",
    "attr.heightCm": "180",
    "attr.widthCm": "90",
    "attr.depthCm": "45",
    "attr.weightKg": "65",
  },
  CERAMICS_PORCELAIN: {
    "attr.makersMark": "Blue seal mark",
    "attr.technique": "Blue & white",
    "attr.period": "Late Qing",
    "attr.origin": "Jingdezhen",
    "attr.heightCm": "24",
    "attr.diameterCm": "30",
    "attr.weightKg": "2.1",
  },
  ART_PAINTINGS: {
    "attr.artist": "Unknown Javanese school",
    "attr.medium": "Oil on canvas",
    "attr.subject": "Harbor scene",
    "attr.signature": "Unsigned",
    "attr.framed": "Framed",
    "attr.imageHeightCm": "60",
    "attr.imageWidthCm": "80",
    "attr.frameHeightCm": "70",
    "attr.frameWidthCm": "90",
  },
  BOOKS: {
    "attr.author": "Multatuli",
    "attr.publisher": "G. Kolff & Co",
    "attr.yearPublished": "1923",
    "attr.edition": "First edition",
    "attr.language": "Dutch",
    "attr.pageCount": "320",
    "attr.heightCm": "22",
    "attr.widthCm": "15",
    "attr.thicknessCm": "3",
    "attr.weightKg": "0.6",
  },
  WATCH: {
    "attr.brand": "Seiko",
    "attr.model": "Lord Matic",
    "attr.movement": "Automatic",
    "attr.caseMaterial": "Stainless steel",
    "attr.caseDiameterMm": "36",
    "attr.period": "1960s",
    "attr.serialNumber": "5606-7000",
  },
  PEN: {
    "attr.brand": "Montblanc",
    "attr.model": "149",
    "attr.material": "Black resin",
    "attr.nib": "14k gold, medium",
    "attr.fillingMechanism": "Piston",
    "attr.lengthCm": "14.9",
    "attr.weightG": "31",
  },
  OTHER: {
    "attr.object": "Brass hand scale",
    "attr.material": "Brass",
    "attr.period": "Colonial era",
    "attr.origin": "Batavia",
    "attr.heightCm": "12",
    "attr.widthCm": "6",
    "attr.depthCm": "3",
    "attr.weightKg": "0.4",
  },
};

// Independent spot-checks: literals straight from the sample forms above.
const CATEGORY_SPOT_CHECKS: Record<ItemCategory, [string, string | number][]> =
  {
    FURNITURE: [
      ["material", "Teak"],
      ["heightCm", 180],
      ["weightKg", 65],
    ],
    CERAMICS_PORCELAIN: [
      ["technique", "Blue & white"],
      ["heightCm", 24],
      ["weightKg", 2.1],
    ],
    ART_PAINTINGS: [
      ["medium", "Oil on canvas"],
      ["framed", "Framed"],
      ["imageWidthCm", 80],
    ],
    BOOKS: [
      ["author", "Multatuli"],
      ["pageCount", 320],
      ["thicknessCm", 3],
    ],
    WATCH: [
      ["brand", "Seiko"],
      ["movement", "Automatic"],
      ["caseDiameterMm", 36],
    ],
    PEN: [
      ["brand", "Montblanc"],
      ["fillingMechanism", "Piston"],
      ["lengthCm", 14.9],
    ],
    OTHER: [
      ["object", "Brass hand scale"],
      ["material", "Brass"],
      ["weightKg", 0.4],
    ],
  };

test.each(CATEGORY_TEMPLATES)(
  "a $label item can be recorded with its category's attribute template",
  async (template) => {
    await signInAsOwner();

    await expect(
      createItem(
        initialFormState,
        form({
          name: `${template.label} sample`,
          category: template.id,
          ...CATEGORY_SAMPLE_FORMS[template.id],
        })
      )
    ).rejects.toThrow(/NEXT_REDIRECT/);

    const items = await listItems({ category: template.id });
    expect(items).toHaveLength(1);

    const detail = await getItem(items[0].id);
    for (const [key, expected] of CATEGORY_SPOT_CHECKS[template.id]) {
      expect(detail?.attributes[key]).toBe(expected);
    }
  }
);

test("a record with missing attributes still saves — it rests as a Draft", async () => {
  await signInAsOwner();

  // movement (a required select) deliberately missing: cataloging happens in
  // many sittings, so creation is lenient. The Draft -> Cataloged step is
  // what demands the full record.
  await expect(
    createItem(
      initialFormState,
      form({
        name: "Watch missing its movement",
        category: "WATCH",
        "attr.brand": "Seiko",
        "attr.caseMaterial": "Stainless steel",
      })
    )
  ).rejects.toThrow(/NEXT_REDIRECT/);

  const [item] = await listItems({});
  expect(item.state).toBe("DRAFT");
  const detail = await getItem(item.id);
  expect(detail?.attributes.brand).toBe("Seiko");
  expect("movement" in (detail?.attributes ?? {})).toBe(false);
});

test("numbers must be positive and selects must come from the list", async () => {
  await signInAsOwner();

  const badNumber = await createItem(
    initialFormState,
    form({
      name: "Zero-height bowl",
      category: "CERAMICS_PORCELAIN",
      "attr.heightCm": "0",
      "attr.diameterCm": "30",
    })
  );
  expect(badNumber.fieldErrors.heightCm).toBeTruthy();

  const notANumber = await createItem(
    initialFormState,
    form({
      name: "Word-height bowl",
      category: "CERAMICS_PORCELAIN",
      "attr.heightCm": "tall",
      "attr.diameterCm": "30",
    })
  );
  expect(notANumber.fieldErrors.heightCm).toBeTruthy();

  const badSelect = await createItem(
    initialFormState,
    form({
      name: "Solar watch",
      category: "WATCH",
      "attr.brand": "Seiko",
      "attr.movement": "Solar",
      "attr.caseMaterial": "Steel",
    })
  );
  expect(badSelect.fieldErrors.movement).toBeTruthy();

  expect(await listItems({})).toHaveLength(0);
});

test("optional fields left empty are simply not stored", async () => {
  await signInAsOwner();

  await expect(
    createItem(
      initialFormState,
      form({
        name: "Bare cabinet",
        category: "FURNITURE",
        "attr.material": "Teak",
        "attr.heightCm": "180",
        "attr.widthCm": "90",
        "attr.depthCm": "45",
        // style, period, weightKg left empty
      })
    )
  ).rejects.toThrow(/NEXT_REDIRECT/);

  const [item] = await listItems({});
  const detail = await getItem(item.id);
  expect(Object.keys(detail?.attributes ?? {}).sort()).toEqual([
    "depthCm",
    "heightCm",
    "material",
    "widthCm",
  ]);
});

test("the 50+ flag can be turned off explicitly", async () => {
  await signInAsOwner();

  await expect(
    createItem(
      initialFormState,
      form({
        name: "Modern replica bowl",
        category: "CERAMICS_PORCELAIN",
        "attr.heightCm": "12",
        "attr.diameterCm": "20",
        fiftyYearsOld: "off",
      })
    )
  ).rejects.toThrow(/NEXT_REDIRECT/);

  const [item] = await listItems({});
  expect(item.fiftyYearsOld).toBe(false);
});

test("a Cataloger can record items too — cataloging is their job", async () => {
  await createUser({
    email: "ada@test.local",
    name: "Ada",
    password: "cataloger-password-1",
    role: "CATALOGER",
  });
  await signInAs("ada@test.local", "cataloger-password-1");

  await expect(
    createItem(
      initialFormState,
      form({
        name: "Cataloger's pen",
        category: "PEN",
        "attr.brand": "Parker",
      })
    )
  ).rejects.toThrow(/NEXT_REDIRECT/);

  expect(await listItems({})).toHaveLength(1);
});

test("an unauthenticated caller cannot create items", async () => {
  await expect(
    createItem(
      initialFormState,
      form({ name: "Ghost item", category: "PEN", "attr.brand": "Parker" })
    )
  ).rejects.toBeInstanceOf(ForbiddenError);
});

// Creates an item through the seam as the currently signed-in user and
// returns its id (discovered through the read seam — no peeking at tables).
async function createSampleItem(fields: Record<string, string>): Promise<string> {
  const name = fields.name;
  await expect(createItem(initialFormState, form(fields))).rejects.toThrow(
    /NEXT_REDIRECT/
  );
  const [item] = await listItems({ q: name });
  if (!item) throw new Error(`item ${name} not found after create`);
  return item.id;
}

async function signInAsCataloger() {
  await createUser({
    email: "ada@test.local",
    name: "Ada",
    password: "cataloger-password-1",
    role: "CATALOGER",
  });
  await signInAs("ada@test.local", "cataloger-password-1");
}

const CABINET_FORM = {
  name: "Jati Teak Cabinet",
  category: "FURNITURE",
  "attr.material": "Teak",
  "attr.heightCm": "180",
  "attr.widthCm": "90",
  "attr.depthCm": "45",
  provenance: "From grandmother's house in Bandung.",
};

test("the Owner can set and change an item's cost basis in IDR", async () => {
  await signInAsOwner();
  const id = await createSampleItem(CABINET_FORM);

  const first = await setCostBasis(
    { error: null },
    form({ itemId: id, costBasisIdr: "3500000" })
  );
  expect(first.error).toBeNull();
  expect((await getItem(id))?.costBasisIdr).toBe(3500000);
  expect((await listItems({ q: "Jati" }))[0].costBasisIdr).toBe(3500000);

  const changed = await setCostBasis(
    { error: null },
    form({ itemId: id, costBasisIdr: "4100000" })
  );
  expect(changed.error).toBeNull();
  expect((await getItem(id))?.costBasisIdr).toBe(4100000);
});

test("cost basis is hidden from a Cataloger on every read, even when set", async () => {
  await signInAsOwner();
  const id = await createSampleItem(CABINET_FORM);
  await setCostBasis(
    { error: null },
    form({ itemId: id, costBasisIdr: "3500000" })
  );

  // Switch to the Cataloger — same item, same read actions.
  cookieStore.clear();
  await signInAsCataloger();

  const detail = await getItem(id);
  expect(detail?.costBasisIdr).toBeNull();

  const [listed] = await listItems({ q: "Jati" });
  expect(listed.costBasisIdr).toBeNull();
});

test("a Cataloger attempting to set a cost basis is rejected by the server", async () => {
  await signInAsOwner();
  const id = await createSampleItem(CABINET_FORM);

  cookieStore.clear();
  await signInAsCataloger();

  await expect(
    setCostBasis({ error: null }, form({ itemId: id, costBasisIdr: "1" }))
  ).rejects.toBeInstanceOf(ForbiddenError);

  // The value is unchanged — the rejected attempt wrote nothing. (The owner
  // account already exists in this test; just sign back in as it.)
  cookieStore.clear();
  await signInAs("owner@test.local", "owner-password-1");
  expect((await getItem(id))?.costBasisIdr).toBeNull();
});

test("cost basis must be a whole number of rupiah (zero allowed, garbage rejected)", async () => {
  await signInAsOwner();
  const id = await createSampleItem(CABINET_FORM);

  const notANumber = await setCostBasis(
    { error: null },
    form({ itemId: id, costBasisIdr: "cheap" })
  );
  expect(notANumber.error).toBeTruthy();

  const negative = await setCostBasis(
    { error: null },
    form({ itemId: id, costBasisIdr: "-100" })
  );
  expect(negative.error).toBeTruthy();

  const zero = await setCostBasis(
    { error: null },
    form({ itemId: id, costBasisIdr: "0" })
  );
  expect(zero.error).toBeNull();
  expect((await getItem(id))?.costBasisIdr).toBe(0);
});

// Gives an item one photo row directly, as fixture setup — the upload
// pipeline has its own tests; here we only need "the item has a photo".
async function giveItemAPhoto(itemId: string) {
  await prisma.photo.create({
    data: {
      itemId,
      publicId: `antiques/items/fixture-${itemId}`,
      format: "jpg",
      width: 4000,
      height: 3000,
      position: 1,
    },
  });
}

test("an incomplete item stays a Draft and is told what is missing", async () => {
  await signInAsOwner();
  // No photo, and one required attribute missing.
  const id = await createSampleItem({
    ...CABINET_FORM,
    "attr.depthCm": "",
  });

  const result = await catalogItem({ error: null }, form({ itemId: id }));

  expect(result.error).toBeTruthy();
  expect(result.error).toContain("Depth");
  expect(result.error).toContain("photo");
  expect((await getItem(id))?.state).toBe("DRAFT");
});

test("a complete record moves from Draft to Cataloged", async () => {
  await signInAsOwner();
  const id = await createSampleItem(CABINET_FORM);
  await giveItemAPhoto(id);

  const result = await catalogItem({ error: null }, form({ itemId: id }));

  expect(result.error).toBeNull();
  expect((await getItem(id))?.state).toBe("CATALOGED");
  expect((await listItems({ state: "CATALOGED" }))[0].id).toBe(id);
});

test("moving an already-Cataloged item to Cataloged again is rejected", async () => {
  await signInAsOwner();
  const id = await createSampleItem(CABINET_FORM);
  await giveItemAPhoto(id);
  await catalogItem({ error: null }, form({ itemId: id }));

  const result = await catalogItem({ error: null }, form({ itemId: id }));

  expect(result.error).toBeTruthy();
  expect((await getItem(id))?.state).toBe("CATALOGED");
});

// A small catalog for the search/filter tests: five items across categories
// and states. SOLD and SHIPPED are set directly — no action reaches those
// states until the lifecycle ticket; here they are fixture arrangement.
async function seedSearchCatalog() {
  const cabinetId = await createSampleItem(CABINET_FORM);
  await giveItemAPhoto(cabinetId);
  await catalogItem({ error: null }, form({ itemId: cabinetId }));

  await createSampleItem({
    name: "Blue & White Bowl",
    category: "CERAMICS_PORCELAIN",
    "attr.heightCm": "12",
    "attr.diameterCm": "26",
  });
  await createSampleItem({
    name: "Harbor Painting",
    category: "ART_PAINTINGS",
    "attr.artist": "Unknown",
    "attr.medium": "Oil on canvas",
    "attr.imageHeightCm": "60",
    "attr.imageWidthCm": "80",
  });
  const soldId = await createSampleItem({
    name: "Seiko Lord Matic",
    category: "WATCH",
    "attr.brand": "Seiko",
    "attr.movement": "Automatic",
    "attr.caseMaterial": "Stainless steel",
  });
  const shippedId = await createSampleItem({
    name: "Multatuli Book",
    category: "BOOKS",
    "attr.author": "Multatuli",
    "attr.heightCm": "22",
    "attr.widthCm": "15",
  });
  await prisma.item.update({
    where: { id: soldId },
    data: { state: "SOLD" },
  });
  await prisma.item.update({
    where: { id: shippedId },
    data: { state: "SHIPPED" },
  });
}

async function listedNames(filters: Parameters<typeof listItems>[0]) {
  const items = await listItems(filters);
  return items.map((item) => item.name).sort();
}

test("the catalog can be searched by keyword, case-insensitively", async () => {
  await signInAsOwner();
  await seedSearchCatalog();

  // Names match.
  expect(await listedNames({ q: "jati" })).toEqual(["Jati Teak Cabinet"]);
  expect(await listedNames({ q: "BOWL" })).toEqual(["Blue & White Bowl"]);
  // Attribute values match ("teak" is the cabinet's material).
  expect(await listedNames({ q: "teak" })).toEqual(["Jati Teak Cabinet"]);
  // Provenance matches.
  expect(await listedNames({ q: "Bandung" })).toEqual(["Jati Teak Cabinet"]);
  expect(await listedNames({ q: "no such thing" })).toEqual([]);
});

test("the catalog can be filtered by category and by lifecycle state", async () => {
  await signInAsOwner();
  await seedSearchCatalog();

  expect(await listedNames({ category: "WATCH" })).toEqual([
    "Seiko Lord Matic",
  ]);
  expect(await listedNames({ state: "CATALOGED" })).toEqual([
    "Jati Teak Cabinet",
  ]);
  expect(await listedNames({ state: "SOLD" })).toEqual(["Seiko Lord Matic"]);
});

test("Inventory shows what the family still owns; the Catalog shows everything", async () => {
  await signInAsOwner();
  await seedSearchCatalog();

  // Catalog (default): every item ever recorded, including sold and shipped.
  expect(await listedNames({})).toEqual([
    "Blue & White Bowl",
    "Harbor Painting",
    "Jati Teak Cabinet",
    "Multatuli Book",
    "Seiko Lord Matic",
  ]);

  // Inventory: minus the Sold and Shipped items.
  expect(await listedNames({ view: "inventory" })).toEqual([
    "Blue & White Bowl",
    "Harbor Painting",
    "Jati Teak Cabinet",
  ]);

  // Filters combine: Inventory + Draft state.
  expect(await listedNames({ view: "inventory", state: "DRAFT" })).toEqual([
    "Blue & White Bowl",
    "Harbor Painting",
  ]);
});

test("an item's record can be edited after creation", async () => {
  await signInAsOwner();
  const id = await createSampleItem(CABINET_FORM);

  // Updating succeeds by redirecting to the item's page.
  await expect(
    updateItem(
      initialFormState,
      form({
        id,
        name: "Jati Teak Cabinet, restored",
        category: "FURNITURE",
        "attr.material": "Teak",
        "attr.style": "Colonial Revival",
        "attr.heightCm": "181",
        "attr.widthCm": "90",
        "attr.depthCm": "45",
        fiftyYearsOld: "off",
        conditionNotes: "Hinge repaired.",
      })
    )
  ).rejects.toThrow(/NEXT_REDIRECT/);

  const detail = await getItem(id);
  expect(detail?.name).toBe("Jati Teak Cabinet, restored");
  expect(detail?.attributes.style).toBe("Colonial Revival");
  expect(detail?.attributes.heightCm).toBe(181);
  expect(detail?.fiftyYearsOld).toBe(false);
  expect(detail?.conditionNotes).toBe("Hinge repaired.");
});

test("a Cataloger can edit items, and editing never touches the cost basis", async () => {
  await signInAsOwner();
  const id = await createSampleItem(CABINET_FORM);
  await setCostBasis(
    { error: null },
    form({ itemId: id, costBasisIdr: "3500000" })
  );

  cookieStore.clear();
  await signInAsCataloger();

  await expect(
    updateItem(
      initialFormState,
      form({
        id,
        name: "Jati Teak Cabinet",
        category: "FURNITURE",
        "attr.material": "Teak and rattan",
        "attr.heightCm": "180",
        "attr.widthCm": "90",
        "attr.depthCm": "45",
      })
    )
  ).rejects.toThrow(/NEXT_REDIRECT/);

  // The Cataloger's edit went through, and the Owner's cost basis survived.
  expect((await getItem(id))?.attributes.material).toBe("Teak and rattan");
  cookieStore.clear();
  await signInAs("owner@test.local", "owner-password-1");
  expect((await getItem(id))?.costBasisIdr).toBe(3500000);
});

test("editing with bad data is rejected and changes nothing", async () => {
  await signInAsOwner();
  const id = await createSampleItem(CABINET_FORM);

  const result = await updateItem(
    initialFormState,
    form({
      id,
      name: "Jati Teak Cabinet",
      category: "FURNITURE",
      "attr.material": "Teak",
      "attr.heightCm": "tall",
      "attr.widthCm": "90",
      "attr.depthCm": "45",
    })
  );

  expect(result.error).toBeTruthy();
  expect(result.fieldErrors.heightCm).toBeTruthy();
  expect((await getItem(id))?.attributes.heightCm).toBe(180);
});
