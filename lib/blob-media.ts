import { createHash } from "node:crypto"

/**
 * Vercel Blob (test phase, user decision 2026-10-24): raster images extracted
 * from docx are uploaded here instead of being embedded as base64 data URIs.
 *
 * - Env-gated: without BLOB_READ_WRITE_TOKEN the app behaves exactly as
 *   before (base64 data URIs) — uploadRasterToBlob returns null.
 * - Upload failure for any image also returns null — the caller falls back
 *   to base64 for that image, so an upload problem NEVER breaks an import.
 * - Pathname = sha256(content) + extension, addRandomSuffix: false, so
 *   identical content dedupes to one object/URL across imports.
 * - Equation SVGs NEVER go through here (they stay inline data URIs: the
 *   equation sizing code reads the SVG content from the src).
 */

/** Public host suffix of Vercel Blob object URLs. */
export const BLOB_PUBLIC_HOST_SUFFIX = ".public.blob.vercel-storage.com"

/** True for https URLs served from a Vercel Blob public host — nothing broader. */
export function isBlobPublicUrl(src: string): boolean {
  try {
    const u = new URL(src.trim())
    return u.protocol === "https:" && u.hostname.endsWith(BLOB_PUBLIC_HOST_SUFFIX)
  } catch {
    return false
  }
}

const RASTER_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
}

/** Blob pathname for raster bytes, or null for content types we never upload. */
export function blobPathnameFor(bytes: Buffer, contentType: string): string | null {
  const ext = RASTER_EXT[contentType.toLowerCase().split(";", 1)[0].trim()]
  if (!ext) return null
  return createHash("sha256").update(bytes).digest("hex") + ext
}

export type BlobPutFn = (
  pathname: string,
  body: Buffer,
  options: { access: "public"; addRandomSuffix: false; contentType: string; token: string },
) => Promise<{ url: string }>

/**
 * Upload raster bytes to Vercel Blob (public). Returns the Blob URL, or null
 * when Blob is not configured, the type is not an uploadable raster, or the
 * upload fails (caller falls back to base64). `putImpl` is injectable for
 * tests only; production always uses @vercel/blob's put.
 */
export async function uploadRasterToBlob(
  bytes: Buffer,
  contentType: string,
  putImpl?: BlobPutFn,
): Promise<string | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return null
  const pathname = blobPathnameFor(bytes, contentType)
  if (!pathname) return null
  try {
    const put: BlobPutFn =
      putImpl ??
      ((await import("@vercel/blob")).put as unknown as BlobPutFn)
    const blob = await put(pathname, bytes, {
      access: "public",
      addRandomSuffix: false,
      contentType: contentType.toLowerCase().split(";", 1)[0].trim(),
      token,
    })
    return blob.url
  } catch (err) {
    console.error("[blob-media] upload failed, falling back to base64", err)
    return null
  }
}
