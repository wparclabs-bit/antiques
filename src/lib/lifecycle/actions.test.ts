import { beforeEach, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Lifecycle & export-gate seam tests (ticket 04). As in the auth and catalog
// suites, the only mocks are Next.js runtime transport (cookie jar,
// redirects, cache) — shared via src/test/browser-transport.ts — plus
// Cloudinary's network hop for certificate scans. The Server Actions under
// test and the database are real.
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
  catalogItem,
  createItem,
  getItem,
  listItems,
  type ItemFormState,
} from "@/lib/catalog/actions";
import { transitionItem, recordSkbcb, listNeedsClearance } from "@/lib/lifecycle/actions";

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

async function signInAsCataloger() {
  await createUser({
    email: "ada@test.local",
    name: "Ada",
    password: "cataloger-password-1",
    role: "CATALOGER",
  });
  await signInAs("ada@test.local", "cataloger-password-1");
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "User", "Session", "Item" CASCADE`
  );
  cookieStore.clear();
  for (const key of [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ]) {
    delete process.env[key];
  }
  vi.unstubAllGlobals();
});

const CABINET_FORM = {
  name: "Jati Teak Cabinet",
  category: "FURNITURE",
  "attr.material": "Teak",
  "attr.heightCm": "180",
  "attr.widthCm": "90",
  "attr.depthCm": "45",
  provenance: "From grandmother's house in Bandung.",
};

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

// A complete record moved to Cataloged through the seam — the starting point
// of every selling transition.
async function catalogedItem(fields: Record<string, string> = CABINET_FORM) {
  const id = await createSampleItem(fields);
  await giveItemAPhoto(id);
  const result = await catalogItem({ error: null }, form({ itemId: id }));
  if (result.error) throw new Error(`fixture not cataloged: ${result.error}`);
  return id;
}

test("an item with the 50+ flag off can be Listed internationally without any SKBCB", async () => {
  await signInAsOwner();
  const id = await catalogedItem({ ...CABINET_FORM, fiftyYearsOld: "off" });

  const result = await transitionItem(
    { error: null },
    form({ itemId: id, to: "LISTED", channel: "international" })
  );

  expect(result.error).toBeNull();
  expect((await getItem(id))?.state).toBe("LISTED");
});

test("a Listed item advances step by step to Reserved, Sold, and Shipped", async () => {
  await signInAsOwner();
  const id = await catalogedItem({ ...CABINET_FORM, fiftyYearsOld: "off" });
  await transitionItem(
    { error: null },
    form({ itemId: id, to: "LISTED", channel: "domestic" })
  );

  const reserved = await transitionItem(
    { error: null },
    form({ itemId: id, to: "RESERVED" })
  );
  expect(reserved.error).toBeNull();
  expect((await getItem(id))?.state).toBe("RESERVED");

  const sold = await transitionItem({ error: null }, form({ itemId: id, to: "SOLD" }));
  expect(sold.error).toBeNull();
  expect((await getItem(id))?.state).toBe("SOLD");
  // Sold items stay in the Catalog forever — but leave Inventory.
  expect((await listItems({})).map((i) => i.id)).toContain(id);
  expect((await listItems({ view: "inventory" })).map((i) => i.id)).not.toContain(id);

  const shipped = await transitionItem({ error: null }, form({ itemId: id, to: "SHIPPED" }));
  expect(shipped.error).toBeNull();
  expect((await getItem(id))?.state).toBe("SHIPPED");
});

test("invalid transitions are rejected and the state never changes", async () => {
  await signInAsOwner();
  // A Draft with a missing attribute — far from complete.
  const draftId = await createSampleItem({
    ...CABINET_FORM,
    "attr.depthCm": "",
    fiftyYearsOld: "off",
  });

  // Skips ahead from Draft are refused…
  for (const to of ["LISTED", "RESERVED", "SOLD", "SHIPPED"]) {
    const result = await transitionItem(
      { error: null },
      form({ itemId: draftId, to, channel: "domestic" })
    );
    expect(result.error, `Draft -> ${to}`).toBeTruthy();
  }
  // …and reaching Cataloged through this form cannot bypass the
  // completeness check that catalogItem enforces.
  const bypass = await transitionItem(
    { error: null },
    form({ itemId: draftId, to: "CATALOGED" })
  );
  expect(bypass.error).toBeTruthy();
  expect((await getItem(draftId))?.state).toBe("DRAFT");

  // A Cataloged item cannot skip the selling steps either.
  const id = await catalogedItem({ ...CABINET_FORM, fiftyYearsOld: "off" });
  for (const to of ["RESERVED", "SOLD", "SHIPPED"]) {
    const result = await transitionItem({ error: null }, form({ itemId: id, to }));
    expect(result.error, `Cataloged -> ${to}`).toBeTruthy();
  }
  expect((await getItem(id))?.state).toBe("CATALOGED");

  // Bogus step names are refused, not stored.
  const bogus = await transitionItem(
    { error: null },
    form({ itemId: id, to: "COLLECTED" })
  );
  expect(bogus.error).toBeTruthy();

  // And there is no going back: a Shipped item is done.
  await transitionItem({ error: null }, form({ itemId: id, to: "LISTED", channel: "domestic" }));
  await transitionItem({ error: null }, form({ itemId: id, to: "RESERVED" }));
  await transitionItem({ error: null }, form({ itemId: id, to: "SOLD" }));
  await transitionItem({ error: null }, form({ itemId: id, to: "SHIPPED" }));
  const backwards = await transitionItem(
    { error: null },
    form({ itemId: id, to: "SOLD" })
  );
  expect(backwards.error).toBeTruthy();
  expect((await getItem(id))?.state).toBe("SHIPPED");
});

test("a 50+ flagged item cannot be Listed internationally without an SKBCB certificate", async () => {
  await signInAsOwner();
  // The 50+ flag defaults to on — this item has no certificate recorded.
  const id = await catalogedItem(CABINET_FORM);

  const blocked = await transitionItem(
    { error: null },
    form({ itemId: id, to: "LISTED", channel: "international" })
  );

  expect(blocked.error).toContain("SKBCB");
  expect((await getItem(id))?.state).toBe("CATALOGED");
});

// ---------------------------------------------------------------------------
// Certificate scans. Cloudinary is the one external service here; the
// network hop is stubbed with realistic responses, as in the catalog suite.
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

// Stubs fetch so Cloudinary uploads succeed and return sequential public
// ids. Also records calls for asserts.
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
          public_id: `antiques/certificates/scan-${id}`,
          format: "jpg",
          width: 2480,
          height: 3508,
        }),
      };
    })
  );
  return calls;
}

function imageFile(name = "skbcb-scan.jpg", type = "image/jpeg", bytes = 2048) {
  return new File([new Uint8Array(bytes)], name, { type });
}

test("recording the SKBCB certificate number and scan allows the international listing", async () => {
  await signInAsOwner();
  configurePhotoStorage();
  const calls = stubCloudinaryApi();
  const id = await catalogedItem(CABINET_FORM);

  const recorded = await recordSkbcb(
    { error: null },
    formWithFile({ itemId: id, certificateNumber: "SKBCB/2026/DKI/0417" }, imageFile())
  );
  expect(recorded.error).toBeNull();

  // The scan was stored as one Cloudinary original in the certificates folder.
  expect(calls).toHaveLength(1);
  expect(calls[0].body.get("folder")).toBe("antiques/certificates");

  // The record is visible on the item.
  const detail = await getItem(id);
  expect(detail?.skbcb.certificateNumber).toBe("SKBCB/2026/DKI/0417");
  expect(detail?.skbcb.hasScan).toBe(true);
  expect(detail?.skbcb.scanUrl).toBe(
    "https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto,c_limit,w_1200,h_1200/antiques/certificates/scan-1.jpg"
  );

  // The gate now opens.
  const listed = await transitionItem(
    { error: null },
    form({ itemId: id, to: "LISTED", channel: "international" })
  );
  expect(listed.error).toBeNull();
  expect((await getItem(id))?.state).toBe("LISTED");
});

test("a certificate number without a scan does not clear the gate — the pair is what proves clearance", async () => {
  await signInAsOwner();
  const id = await catalogedItem(CABINET_FORM);

  const recorded = await recordSkbcb(
    { error: null },
    form({ itemId: id, certificateNumber: "SKBCB/2026/DKI/0417" })
  );
  expect(recorded.error).toBeNull();

  const detail = await getItem(id);
  expect(detail?.skbcb.certificateNumber).toBe("SKBCB/2026/DKI/0417");
  expect(detail?.skbcb.hasScan).toBe(false);

  const blocked = await transitionItem(
    { error: null },
    form({ itemId: id, to: "LISTED", channel: "international" })
  );
  expect(blocked.error).toContain("SKBCB");
  expect((await getItem(id))?.state).toBe("CATALOGED");
});

test("certificate recording rejects an empty number and a non-image scan, storing nothing", async () => {
  await signInAsOwner();
  configurePhotoStorage();
  const calls = stubCloudinaryApi();
  const id = await catalogedItem(CABINET_FORM);

  const noNumber = await recordSkbcb({ error: null }, form({ itemId: id }));
  expect(noNumber.error).toBeTruthy();

  const notAnImage = await recordSkbcb(
    { error: null },
    formWithFile(
      { itemId: id, certificateNumber: "SKBCB/2026/DKI/0417" },
      new File([new Uint8Array(10)], "letter.txt", { type: "text/plain" })
    )
  );
  expect(notAnImage.error).toContain("not an image");

  expect(calls).toHaveLength(0);
  const detail = await getItem(id);
  expect(detail?.skbcb.certificateNumber).toBeNull();
  expect(detail?.skbcb.hasScan).toBe(false);
});

test("recording a replacement scan cleans up the previous stored original", async () => {
  await signInAsOwner();
  configurePhotoStorage();
  const calls = stubCloudinaryApi();
  const id = await catalogedItem(CABINET_FORM);

  await recordSkbcb(
    { error: null },
    formWithFile({ itemId: id, certificateNumber: "SKBCB/2026/DKI/0417" }, imageFile())
  );
  await recordSkbcb(
    { error: null },
    formWithFile(
      { itemId: id, certificateNumber: "SKBCB/2026/DKI/0417" },
      imageFile("skbcb-scan-replacement.jpg")
    )
  );

  const destroyCall = calls.find((call) => call.url.endsWith("/image/destroy"));
  expect(destroyCall?.body.get("public_id")).toBe("antiques/certificates/scan-1");
  // The item points at the replacement.
  expect((await getItem(id))?.skbcb.scanUrl).toContain("antiques/certificates/scan-2");
});

test("domestic listing is never blocked by the export gate, with or without a certificate", async () => {
  await signInAsOwner();
  // Flagged, no SKBCB — the exact situation the gate exists for.
  const id = await catalogedItem(CABINET_FORM);

  const domestic = await transitionItem(
    { error: null },
    form({ itemId: id, to: "LISTED", channel: "domestic" })
  );
  expect(domestic.error).toBeNull();
  expect((await getItem(id))?.state).toBe("LISTED");

  // And listing at all requires choosing a channel.
  const otherId = await catalogedItem({
    ...CABINET_FORM,
    name: "Second Cabinet",
  });
  const noChannel = await transitionItem(
    { error: null },
    form({ itemId: otherId, to: "LISTED" })
  );
  expect(noChannel.error).toContain("domestic");
  expect((await getItem(otherId))?.state).toBe("CATALOGED");
});

test("the needs-clearance checklist shows flagged items whose SKBCB is not fully recorded", async () => {
  await signInAsOwner();
  configurePhotoStorage();
  stubCloudinaryApi();

  // Four items: flagged with nothing recorded, flagged with number only,
  // flagged and fully cleared, and unflagged.
  const nothingId = await catalogedItem({ ...CABINET_FORM, name: "Uncleared Cabinet" });
  const numberOnlyId = await catalogedItem({
    ...CABINET_FORM,
    name: "Half-cleared Cabinet",
  });
  await recordSkbcb(
    { error: null },
    form({ itemId: numberOnlyId, certificateNumber: "SKBCB/2026/DKI/0417" })
  );
  const clearedId = await catalogedItem({ ...CABINET_FORM, name: "Cleared Cabinet" });
  await recordSkbcb(
    { error: null },
    formWithFile(
      { itemId: clearedId, certificateNumber: "SKBCB/2026/DKI/0418" },
      imageFile()
    )
  );
  await catalogedItem({
    ...CABINET_FORM,
    name: "Modern Cabinet",
    fiftyYearsOld: "off",
  });

  const checklist = await listNeedsClearance();

  const names = checklist.map((entry) => entry.name);
  expect(names).toEqual(["Half-cleared Cabinet", "Uncleared Cabinet"]);
  const half = checklist.find((entry) => entry.id === numberOnlyId);
  expect(half?.hasCertificateNumber).toBe(true);
  expect(half?.hasScan).toBe(false);
  const nothing = checklist.find((entry) => entry.id === nothingId);
  expect(nothing?.hasCertificateNumber).toBe(false);
  expect(nothing?.hasScan).toBe(false);

  // Recording the missing scan removes an item from the checklist.
  await recordSkbcb(
    { error: null },
    formWithFile(
      { itemId: numberOnlyId, certificateNumber: "SKBCB/2026/DKI/0417" },
      imageFile()
    )
  );
  expect((await listNeedsClearance()).map((entry) => entry.name)).toEqual([
    "Uncleared Cabinet",
  ]);
});

test("selling steps are Owner-only on the server; recording an SKBCB is not", async () => {
  await signInAsOwner();
  const id = await catalogedItem({ ...CABINET_FORM, fiftyYearsOld: "off" });

  cookieStore.clear();
  await signInAsCataloger();

  // The Cataloger cannot move an item into the selling lifecycle —
  // rejected by the server, not just hidden in the UI.
  await expect(
    transitionItem(
      { error: null },
      form({ itemId: id, to: "LISTED", channel: "domestic" })
    )
  ).rejects.toBeInstanceOf(ForbiddenError);
  expect((await getItem(id))?.state).toBe("CATALOGED");

  // But recording certificate evidence is family cataloging work.
  const recorded = await recordSkbcb(
    { error: null },
    form({ itemId: id, certificateNumber: "SKBCB/2026/DKI/0417" })
  );
  expect(recorded.error).toBeNull();
  expect((await getItem(id))?.skbcb.certificateNumber).toBe("SKBCB/2026/DKI/0417");

  // And nobody unsigned-in moves anything.
  cookieStore.clear();
  await expect(
    transitionItem(
      { error: null },
      form({ itemId: id, to: "LISTED", channel: "domestic" })
    )
  ).rejects.toBeInstanceOf(ForbiddenError);
  await expect(
    recordSkbcb(
      { error: null },
      form({ itemId: id, certificateNumber: "SKBCB/2026/DKI/0417" })
    )
  ).rejects.toBeInstanceOf(ForbiddenError);
  await expect(listNeedsClearance()).rejects.toBeInstanceOf(ForbiddenError);
});

function formWithFile(fields: Record<string, string>, file: File) {
  const fd = form(fields);
  fd.set("scan", file);
  return fd;
}
