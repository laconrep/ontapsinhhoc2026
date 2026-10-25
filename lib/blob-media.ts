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

/** §26: ngưỡng nén ảnh lúc nạp — học sinh xem ảnh trong khung
 * max-h-48 / max-w-full nên ảnh rộng hơn mức này chỉ tốn băng thông
 * mà không nét hơn trên màn hình. WebP q80 giữ sơ đồ đủ nét. */
export const MAX_IMAGE_WIDTH = 1200
export const IMAGE_WEBP_QUALITY = 80

/**
 * §26: tối ưu ảnh raster trước khi đưa lên Blob: PNG/JPEG -> WebP
 * (giữ alpha), chiều rộng tối đa MAX_IMAGE_WIDTH (không phóng to ảnh
 * nhỏ). GIF giữ nguyên để không mất ảnh động; WebP đã đủ nhỏ thì giữ
 * nguyên tránh nén lại làm giảm chất lượng. Mọi lỗi (kể cả thiếu
 * sharp) đều trả về bytes gốc — tối ưu không bao giờ được làm hỏng
 * việc nạp bài.
 */
export async function optimizeRaster(
  bytes: Buffer,
  contentType: string,
): Promise<{ bytes: Buffer; contentType: string }> {
  const type = contentType.toLowerCase().split(";", 1)[0].trim()
  if (type === "image/gif") return { bytes, contentType: type }
  if (type !== "image/png" && type !== "image/jpeg" && type !== "image/jpg" && type !== "image/webp") {
    return { bytes, contentType: type }
  }
  try {
    const sharp = (await import("sharp")).default
    if (type === "image/webp") {
      const meta = await sharp(bytes).metadata()
      if (meta.width != null && meta.width <= MAX_IMAGE_WIDTH) return { bytes, contentType: type }
    }
    const out = await sharp(bytes)
      .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
      .webp({ quality: IMAGE_WEBP_QUALITY })
      .toBuffer()
    return { bytes: out, contentType: "image/webp" }
  } catch {
    return { bytes, contentType: type }
  }
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
  options: {
    access: "public"
    addRandomSuffix: false
    contentType: string
    token: string
    /** §26: blob đặt tên theo hash nội dung nên bất biến — cache 1 năm an toàn. */
    cacheControlMaxAge: number
  },
) => Promise<{ url: string }>

/**
 * Upload raster bytes to Vercel Blob (public). Trả về URL kèm số byte
 * THỰC ĐÃ UPLOAD (sau tối ưu §26) để khâu trích tính đúng băng thông
 * học sinh sẽ tải; hoặc null khi Blob chưa cấu hình, loại ảnh không
 * upload được, hay upload lỗi (caller fallback sang base64 cho ảnh đó,
 * nên lỗi upload KHÔNG BAO GIỜ làm hỏng việc nạp).
 * `putImpl` is injectable for tests only; production always uses
 * @vercel/blob's put.
 */
export async function uploadRasterToBlob(
  bytes: Buffer,
  contentType: string,
  putImpl?: BlobPutFn,
): Promise<{ url: string; bytes: number } | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return null
  // §26: tối ưu trước, rồi mới băm tên file từ bytes CUỐI — hai ảnh gốc
  // khác nhau mà nén ra cùng một file thì dedupe thành một URL.
  const optimized = await optimizeRaster(bytes, contentType)
  const pathname = blobPathnameFor(optimized.bytes, optimized.contentType)
  if (!pathname) return null
  try {
    const put: BlobPutFn =
      putImpl ??
      ((await import("@vercel/blob")).put as unknown as BlobPutFn)
    const blob = await put(pathname, optimized.bytes, {
      access: "public",
      addRandomSuffix: false,
      contentType: optimized.contentType,
      token,
      cacheControlMaxAge: 31536000,
    })
    return { url: blob.url, bytes: optimized.bytes.length }
  } catch (err) {
    console.error("[blob-media] upload failed, falling back to base64", err)
    return null
  }
}
