const WMF_FONT_PX = 18
const MJ_UNITS_PER_EM = 1000
const GLYPH_SCALE = 1.15
const MIN_EM = 1.0
const MAX_EM = 6

const emCache = new Map<string, number | null>()

export function equationHeightEm(svgText: string): number | null {
  const vbH = Number(
    svgText.match(/viewBox\s*=\s*["'][-\d.]+[ ,]+[-\d.]+[ ,]+[\d.]+[ ,]+([\d.]+)["']/i)?.[1],
  )
  if (!Number.isFinite(vbH) || vbH <= 0) return null
  const isMathJax = /<svg\b[^>]*\bheight\s*=\s*["'][\d.]+ex["']/i.test(svgText)
  const em = (isMathJax ? vbH / MJ_UNITS_PER_EM : vbH / WMF_FONT_PX) * GLYPH_SCALE
  return Math.round(Math.min(MAX_EM, Math.max(MIN_EM, em)) * 10) / 10
}

export function decodeSvgDataUri(src: string): string | null {
  const b64 = src.match(/^data:image\/svg\+xml;base64,(.+)$/i)?.[1]
  if (!b64) return null
  try {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

export function equationHeightEmFromSrc(src: string): number | null {
  if (emCache.has(src)) return emCache.get(src) ?? null
  const svg = decodeSvgDataUri(src)
  const em = svg ? equationHeightEm(svg) : null
  emCache.set(src, em)
  return em
}
