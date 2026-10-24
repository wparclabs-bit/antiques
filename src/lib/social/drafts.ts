import { templateFor } from "@/lib/catalog/categories";
import {
  draftBody,
  identifyingSummary,
  oneLineOpening,
  photoBundleSection,
  plainMoneyText,
  type DraftItemInput,
} from "@/lib/listings/drafts";
import { photoVariantUrl } from "@/lib/photos/cloudinary";

// The social drafts (ticket 08, spec stories 33–34) — deterministic
// assembly from the Item and its Listing, no AI anywhere. The body comes
// from the Item's own record (the same sections the marketplace drafts
// paste), the offer from the Listing (price, marketplace). One format per
// platform:
//
//   Instagram caption — one-line opening, price line, the item's body, a
//                       call to action, hashtags. Captions cannot carry
//                       links, so the call points at the marketplace by
//                       name.
//   Instagram story   — three short lines: the piece, its identifying
//                       summary, the offer. Story text is an overlay on a
//                       photo; it stays minimal.
//   Facebook post     — the caption's pieces without hashtags, and a call
//                       to action that can say "here", since Facebook
//                       posts carry links.
//
// The formats are pinned by golden tests (actions.test.ts); changing a
// format is a deliberate act that updates them.

export type SocialDraft = {
  // What the platform's composer receives.
  text: string;
  // The one-action clipboard block: the text plus the photo bundle a post
  // needs, at display size.
  copyText: string;
};

export type SocialDraftInput = {
  item: DraftItemInput;
  listing: { marketplaceName: string; price: number; currency: string };
};

export type SocialDrafts = {
  instagramCaption: SocialDraft;
  instagramStory: SocialDraft;
  facebookPost: SocialDraft;
};

function offerLine(input: SocialDraftInput): string {
  return `Offered at ${plainMoneyText(
    input.listing.price,
    input.listing.currency
  )} on ${input.listing.marketplaceName}.`;
}

// Sections that have nothing to say are dropped, not left as gaps.
function joinSections(parts: (string | null)[]): string {
  return parts.filter((part) => part !== null).join("\n\n");
}

const MAX_HASHTAGS = 12;

// A hashtag: lowercase letters and digits only, at least one letter (a
// number alone is not a tag anyone follows), and never longer than a tag
// a person would type or search. Null means "not tag material".
function toTag(raw: string): string | null {
  const tag = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (tag.length < 3 || tag.length > 30 || !/[a-z]/.test(tag)) return null;
  return tag;
}

// Hashtags from the record, in a fixed order: the evergreen antique tags,
// the category's words plus its antique compound for single-word
// categories (#antiquefurniture — multi-word labels like "Ceramics &
// Porcelain" skip it), then each identifying value squashed into one tag
// (#early20thcentury). Deduped and capped.
function hashtags(item: DraftItemInput): string {
  const tags: string[] = [];
  const push = (tag: string | null) => {
    if (tag && !tags.includes(tag)) tags.push(tag);
  };

  for (const base of ["antique", "vintage", "forsale"]) push(base);

  const categoryTags = templateFor(item.category)
    .label.split(/\s+/)
    .map((word) => (word.toLowerCase() === "other" ? null : toTag(word)))
    .filter((tag): tag is string => tag !== null);
  for (const tag of categoryTags) push(tag);
  if (categoryTags.length === 1) push(toTag(`antique${categoryTags[0]}`));

  for (const value of identifyingSummary(item)) push(toTag(value));

  return tags
    .slice(0, MAX_HASHTAGS)
    .map((tag) => `#${tag}`)
    .join(" ");
}

export function buildInstagramCaption(input: SocialDraftInput): string {
  const body = draftBody(input.item);
  return joinSections([
    oneLineOpening(input.item),
    offerLine(input),
    body || null,
    `Interested? Message us — the listing is on ${input.listing.marketplaceName}.`,
    hashtags(input.item),
  ]);
}

export function buildInstagramStory(input: SocialDraftInput): string {
  const summary = identifyingSummary(input.item).join(" · ");
  return [
    input.item.name,
    summary,
    `${plainMoneyText(
      input.listing.price,
      input.listing.currency
    )} on ${input.listing.marketplaceName}`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function buildFacebookPost(input: SocialDraftInput): string {
  const body = draftBody(input.item);
  return joinSections([
    oneLineOpening(input.item),
    offerLine(input),
    body || null,
    `Interested? Message us here or on ${input.listing.marketplaceName}.`,
  ]);
}

// One draft per platform, each copy-ready as a single block — a labeled
// text section plus its photo bundle at display size (social platforms
// take the app's own views, not a marketplace's sized bundle).
export function buildSocialDrafts(input: SocialDraftInput): SocialDrafts {
  const photoUrls = input.item.photos.map((photo) =>
    photoVariantUrl(photo, "display")
  );
  const withPhotos = (
    header: "CAPTION" | "TEXT" | "POST",
    text: string,
    label: string
  ): SocialDraft => ({
    text,
    copyText: [
      `${header}\n${text}`,
      photoBundleSection(label, photoUrls, "display"),
    ].join("\n\n"),
  });

  return {
    instagramCaption: withPhotos(
      "CAPTION",
      buildInstagramCaption(input),
      "Instagram"
    ),
    instagramStory: withPhotos("TEXT", buildInstagramStory(input), "Instagram"),
    facebookPost: withPhotos("POST", buildFacebookPost(input), "Facebook"),
  };
}
