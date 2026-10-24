"use client";

// Phone photos are 3–8 MB; the Server Action transport that carries them
// caps request bodies (and Vercel caps them harder in production). The fix
// is to resize in the browser before anything is submitted: the original
// that reaches Cloudinary is already a sane-size JPEG, and the derived
// marketplace variants are produced from it as before.
//
// 1600px covers eBay's largest listing photo; Etsy's 2000px variant simply
// uses this original without upscaling (c_limit never enlarges).

const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.82;
const FALLBACK_MIME = "image/jpeg";

export async function downscaleImage(file: File): Promise<File> {
  // Non-decodable files (or anything unexpected) pass through untouched;
  // the server-side guards still validate type and size.
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === FALLBACK_MIME) {
      // Already a small-enough JPEG — no re-encode, no quality loss.
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, FALLBACK_MIME, JPEG_QUALITY)
    );
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, { type: FALLBACK_MIME });
  } catch {
    // Undecodable in this browser (e.g. some HEIC) — send the original.
    return file;
  }
}

export async function downscaleImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map(downscaleImage));
}
