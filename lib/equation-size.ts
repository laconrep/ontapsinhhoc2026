const WMF_FONT_PX = 18
const MJ_UNITS_PER_EM = 1000
const GLYPH_SCALE = 1.15
const MIN_EM = 1.0
const MAX_EM = 6

const emCache = new Map<string, number | null>()

export function equationHeightEm(svgText: string): number | null {
  const isMathJax = /<svg\b[^>]*\bheight\s*=\s*["'][\d.]+ex["']/i.test(svgText)
  if (isMathJax) {
    const vbH = Number(
      svgText.match(/viewBox\s*=\s*["'][-\d.]+[ ,]+[-\d.]+[ ,]+[\d.]+[ ,]+([\d.]+)["']/i)?.[1],
    )
    if (!Number.isFinite(vbH) || vbH <= 0) return null
    const em = (vbH / MJ_UNITS_PER_EM) * GLYPH_SCALE
    return Math.round(Math.min(MAX_EM, Math.max(MIN_EM, em)) * 10) / 10
  }
  const fontSize = Number(svgText.match(/\bfont-size\s*=\s*["']([\d.]+)["']/i)?.[1])
  const vbH = Number(
    svgText.match(/viewBox\s*=\s*["'][-\d.]+[ ,]+[-\d.]+[ ,]+[\d.]+[ ,]+([\d.]+)["']/i)?.[1],
  )
  const glyph = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : WMF_FONT_PX
  if (!Number.isFinite(vbH) || vbH <= 0) return null
  const em = (vbH / glyph) * GLYPH_SCALE
  return Math.round(Math.min(MAX_EM, Math.max(MIN_EM, em)) * 10) / 10
}

export function decodeSvgDataUri(src: string): string | null {
  const raw = src.replace(/&amp;/g, "&")
  const b64 = raw.match(/^data:image\/svg\+xml(?:;charset=[^;,]+)?;base64,(.+)$/i)?.[1]
  if (!b64) return null
  try {
    const bin = atob(b64.replace(/\s/g, ""))
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

export function isSvgDataUri(src: string): boolean {
  return /^data:image\/svg\+xml/i.test(src)
}
