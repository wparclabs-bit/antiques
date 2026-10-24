import { createHash } from "node:crypto";

// Photo storage (spec: Cloudinary, free tier). One uploaded original per
// photo; every marketplace-sized variant is a derived URL transformation
// (c_limit = scale down only), so nothing is resized or stored twice.

export type StoredPhoto = {
  publicId: string;
  format: string;
  width: number;
  height: number;
};

// Longest-side pixel sizes. eBay asks for 1600px images, Etsy for 2000px;
// the app itself needs only smaller views. The listing-draft ticket will
// paste the marketplace URLs straight into its photo bundles.
export const PHOTO_VARIANTS = {
  thumbnail: 400,
  display: 1200,
  ebay: 1600,
  etsy: 2000,
} as const;

export type PhotoVariantName = keyof typeof PHOTO_VARIANTS;

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
// The browser resizes photos before upload (src/app/items/resize-photos.ts),
// so a full batch stays well inside the Server Action body limit. More
// photos can always go up in a second batch from the item page.
export const MAX_PHOTOS_PER_UPLOAD = 6;

// Thrown when uploads fail or the service is not set up; actions turn this
// into a form error instead of a crash.
export class PhotoStorageError extends Error {}

function storageConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export function isPhotoStorageConfigured(): boolean {
  return storageConfig() !== null;
}

// Cloudinary's signature: sha1 of the signed parameters sorted and joined
// "k=v&k=v", with the api secret appended.
function signParams(params: Record<string, string>, apiSecret: string) {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(toSign + apiSecret).digest("hex");
}

async function cloudinaryRequest(
  endpoint: string,
  params: Record<string, string>,
  file?: File
): Promise<Record<string, unknown>> {
  const config = storageConfig();
  if (!config) {
    throw new PhotoStorageError(
      "Photo storage is not configured yet — see README (Cloudinary)."
    );
  }

  const signed = { ...params, timestamp: Math.floor(Date.now() / 1000).toString() };
  const body = new FormData();
  for (const [key, value] of Object.entries(signed)) body.append(key, value);
  body.append("api_key", config.apiKey);
  body.append("signature", signParams(signed, config.apiSecret));
  if (file) body.append("file", file, file.name);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/${endpoint}`,
    { method: "POST", body }
  );
  if (!response.ok) {
    throw new PhotoStorageError(
      `Cloudinary rejected the request (${response.status}).`
    );
  }
  return response.json();
}

export async function uploadItemPhoto(file: File): Promise<StoredPhoto> {
  const json = (await cloudinaryRequest(
    "image/upload",
    { folder: "antiques/items" },
    file
  )) as {
    public_id: string;
    format: string;
    width: number;
    height: number;
  };

  return {
    publicId: json.public_id,
    format: json.format,
    width: json.width,
    height: json.height,
  };
}

// Best effort: if this fails the row is still gone from our database; the
// stored original is cleaned up on Cloudinary's side eventually or can be
// purged from their console. Never blocks the user's action.
export async function destroyItemPhoto(publicId: string): Promise<void> {
  try {
    await cloudinaryRequest("image/destroy", { public_id: publicId });
  } catch {
    // Intentionally swallowed — see above.
  }
}

export function photoVariantUrl(
  photo: { publicId: string; format: string },
  variant: PhotoVariantName
): string | null {
  const config = storageConfig();
  if (!config) return null;
  const max = PHOTO_VARIANTS[variant];
  return `https://res.cloudinary.com/${config.cloudName}/image/upload/f_auto,q_auto,c_limit,w_${max},h_${max}/${photo.publicId}.${photo.format}`;
}

// Client-side-of-the-API checks before any upload: the browser's file picker
// can be bypassed, so the server re-checks type, size, and count.
export function photoUploadProblem(files: File[]): string | null {
  if (files.length > MAX_PHOTOS_PER_UPLOAD) {
    return `Upload up to ${MAX_PHOTOS_PER_UPLOAD} photos at a time.`;
  }
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      return `"${file.name}" is not an image.`;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return `"${file.name}" is larger than 10 MB.`;
    }
  }
  return null;
}
