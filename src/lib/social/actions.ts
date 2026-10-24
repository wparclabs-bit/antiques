"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOwner, requireUser } from "@/lib/auth/session";
import { revalidateItemPages } from "@/lib/revalidate";

// The Posting Log (ticket 08, spec story 34) — where and when each Item
// was posted, so marketing effort is visible and never repeated by
// accident. The family records together (ADR-0003, one role): writes and
// reads need a signed-in family login. The social drafts themselves are
// generated, not stored; only the log rows live here.

export type ActionState = { error: string | null };

const MAX_PLATFORM_LENGTH = 60;
const MAX_TEXT_LENGTH = 200;
const MAX_URL_LENGTH = 500;

export type SocialPostView = {
  id: string;
  platform: string;
  postedOn: Date;
  url: string | null;
  notes: string | null;
};

// The form's platform select suggests the drafted platforms; "Other" opens
// a free-text field, and the free text wins when given — the log records
// wherever the family actually posted, not just what we draft for.
function platformFrom(formData: FormData): string | null {
  const chosen = String(formData.get("platform") ?? "").trim();
  const free = String(formData.get("platformOther") ?? "").trim();
  const platform = chosen === "OTHER" ? free : chosen;
  if (!platform || platform.length > MAX_PLATFORM_LENGTH) return null;
  return platform;
}

// The posting date arrives as YYYY-MM-DD from a date input. The future
// slack is the sale date's rule: the family records from Indonesia
// (UTC+7), where an early-morning "today" is still ahead of a UTC server
// clock. A typo'd future year is still caught.
function parsePostedOn(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function recordSocialPost(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireOwner();

  const itemId = String(formData.get("itemId") ?? "");
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) {
    return { error: "Item not found." };
  }

  const platform = platformFrom(formData);
  if (!platform) {
    return { error: "Enter where this was posted (e.g. Instagram)." };
  }

  const postedOn = parsePostedOn(String(formData.get("postedOn") ?? "").trim());
  if (!postedOn) {
    return { error: "Enter the date this was posted." };
  }
  if (postedOn.getTime() > Date.now() + 14 * 60 * 60 * 1000) {
    return { error: "The posting date cannot be in the future." };
  }

  const url = String(formData.get("url") ?? "").trim();
  // The host is required: "https://" alone is a typo, not a link.
  if (url && (!/^https?:\/\/\S+$/.test(url) || url.length > MAX_URL_LENGTH)) {
    return { error: "The link must start with http:// or https://." };
  }

  const notes = String(formData.get("notes") ?? "").trim();
  if (notes.length > MAX_TEXT_LENGTH) {
    return { error: "Notes are limited to 200 characters." };
  }

  await prisma.socialPost.create({
    data: {
      itemId,
      platform,
      postedOn,
      url: url || null,
      notes: notes || null,
    },
  });

  revalidateItemPages(itemId);
  return { error: null };
}

export async function removeSocialPost(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireOwner();

  const postId = String(formData.get("postId") ?? "");
  const post = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!post) {
    return { error: "Log entry not found." };
  }

  await prisma.socialPost.delete({ where: { id: postId } });
  revalidateItemPages(post.itemId);
  return { error: null };
}

// The Item's posting history, newest first (same-day entries read in the
// order they were recorded, most recent first).
export async function getSocialPosts(
  itemId: string
): Promise<SocialPostView[]> {
  await requireUser();

  const rows = await prisma.socialPost.findMany({
    where: { itemId },
    orderBy: [{ postedOn: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    platform: row.platform,
    postedOn: row.postedOn,
    url: row.url,
    notes: row.notes,
  }));
}

// ---------------------------------------------------------------------------
// The social-platform list (ticket 10): the Settings-managed choices the
// posting log's picker offers. It seeds itself with the three platforms
// the app drafts for; the log's "Other…" stays open for one-offs and never
// writes into this list.
// ---------------------------------------------------------------------------

export type SocialPlatformView = { id: string; name: string };

const SEEDED_PLATFORMS = ["Instagram", "Instagram Story", "Facebook"];

async function ensurePlatformsSeeded() {
  if ((await prisma.socialPlatform.count()) === 0) {
    await prisma.socialPlatform.createMany({
      data: SEEDED_PLATFORMS.map((name) => ({ name })),
    });
  }
}

export async function getSocialPlatforms(): Promise<SocialPlatformView[]> {
  await requireUser();
  await ensurePlatformsSeeded();
  const rows = await prisma.socialPlatform.findMany({
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

export async function addSocialPlatform(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireOwner();

  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > MAX_PLATFORM_LENGTH) {
    return {
      error: `Enter the platform name (up to ${MAX_PLATFORM_LENGTH} characters).`,
    };
  }

  const existing = await prisma.socialPlatform.findUnique({ where: { name } });
  if (existing) {
    return { error: `"${name}" is already in the list.` };
  }

  await prisma.socialPlatform.create({ data: { name } });
  revalidatePath("/settings");
  return { error: null };
}

export async function removeSocialPlatform(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireOwner();

  const platformId = String(formData.get("platformId") ?? "");
  const row = await prisma.socialPlatform.findUnique({ where: { id: platformId } });
  if (!row) {
    return { error: "Platform not found." };
  }

  // Log entries keep their recorded platform text; removing the platform
  // only retires it from the picker.
  await prisma.socialPlatform.delete({ where: { id: platformId } });
  revalidatePath("/settings");
  return { error: null };
}
