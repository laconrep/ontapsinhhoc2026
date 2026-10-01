import { execFile } from "node:child_process"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"

/**
 * Chuyen anh cong thuc MathType (OLE) dang metafile WMF/EMF sang SVG.
 * Server-only: chi dung Node APIs (fs, os, child_process).
 */

interface WmfState {
  Font?: { Height?: number; Name?: string; Weight?: number; Italic?: boolean; Angle?: number }
  TextColor?: number
  Pen?: { Color?: number; Width?: number; Style?: number }
  Brush?: { Color?: number; Style?: number }
  Extent?: [number, number]
  Origin?: [number, number]
}

interface WmfAction {
  t: "text" | "poly" | "cpy" | "str" | string
  v?: string
  p?: number[][]
  g?: boolean
  s?: WmfState
}

interface WmfModule {
  get_actions(buffer: Buffer | Uint8Array): WmfAction[]
  image_size(buffer: Buffer | Uint8Array): [number, number]
}

const META_ESCAPE = 1574
const WMF_PLACEABLE_MAGIC = 0x9ac6cdd7
const WMF_PLACEABLE_HEADER_SIZE = 22
const WMF_HEADER_SIZE = 18
const WMF2SVG_MAX_BUFFER = 64 * 1024 * 1024

let cachedWmf: WmfModule | null | undefined

async function loadWmf(): Promise<WmfModule | null> {
  if (cachedWmf !== undefined) return cachedWmf
  try {
    const mod = (await import("wmf")) as { default?: WmfModule } & WmfModule
    cachedWmf = (mod.default ?? mod) as WmfModule
  } catch {
    cachedWmf = null
  }
  return cachedWmf
}

/** WMF/EMF la metafile co the chuyen bang wmf2svg. */
export function isConvertibleMetafile(contentType: string): boolean {
  const t = (contentType || "").toLowerCase().trim()
  return t === "image/x-wmf" || t === "image/wmf" || t === "image/x-emf" || t === "image/emf"
}

/**
 * Chuyen buffer WMF thanh data URI SVG.
 * Uu tien wmf2svg (libwmf-bin); neu thieu/loi thi dung fallback JS (goi npm `wmf`).
 * Khong nem loi: tra null khi khong the chuyen.
 */
export async function wmfToSvg(buffer: Buffer): Promise<string | null> {
  if (!buffer || buffer.length === 0) return null

  let dir: string | null = null
  try {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "wmf2svg-"))
    const inPath = path.join(dir, "input.wmf")
    await fs.writeFile(inPath, buffer)
    const svg = await runWmf2Svg(inPath)
    if (svg && svg.includes("<svg")) {
      const normalized = ensureSvgNamespace(svg)
      return `data:image/svg+xml;base64,${Buffer.from(normalized, "utf8").toString("base64")}`
    }
  } catch {
    // wmf2svg khong co hoac loi -> roi xuong fallback JS.
  } finally {
    if (dir) await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }

  return wmfToSvgFallback(buffer)
}

function runWmf2Svg(inPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "wmf2svg",
      [inPath],
      { maxBuffer: WMF2SVG_MAX_BUFFER, encoding: "utf8" },
      (err, stdout) => {
        if (err) reject(err)
        else resolve(stdout)
      },
    )
  })
}

/** Fallback thuan JS khi thieu wmf2svg: bo record MathType, dung text/poly de dung SVG toi gian. */
export async function wmfToSvgFallback(buffer: Buffer): Promise<string | null> {
  try {
    const wmf = await loadWmf()
    if (!wmf) return null

    const sanitized = removeEscapeRecords(stripPlaceableHeader(buffer))
    if (!sanitized || sanitized.length < WMF_HEADER_SIZE) return null

    const actions = callGetActions(wmf, sanitized)
    if (!actions || actions.length === 0) return null

    const textActions = actions.filter((a) => a.t === "text" && a.v)
    if (textActions.length > 0 && textsShareOrigin(textActions)) {
      const reconstructed = reconstructMathTypeSvg(textActions.map((a) => String(a.v)))
      if (reconstructed) return reconstructed
    }

    let [width, height] = wmf.image_size(sanitized)
    if (!Number.isFinite(width) || width <= 0) width = 100
    if (!Number.isFinite(height) || height <= 0) height = 100

    const parts: string[] = []
    for (const action of actions) {
      const state = action.s ?? {}
      if (action.t === "text" && action.v) {
        const x = action.p?.[0]?.[0] ?? 0
        const y = action.p?.[0]?.[1] ?? 0
        const fontHeight = Math.abs(state.Font?.Height ?? 0) || Math.round(height * 0.4)
        const fill = colorrefToHex(state.TextColor, "#000000")
        parts.push(
          `<text x="${x}" y="${height - y}" font-size="${fontHeight}"` +
            ` font-family="Times New Roman, serif" fill="${fill}">${escapeXml(action.v)}</text>`,
        )
      } else if (action.t === "poly" && action.p && action.p.length > 0) {
        const points = action.p.map(([px, py]) => `${px},${height - py}`).join(" ")
        const stroke = colorrefToHex(state.Pen?.Color, "#000000")
        const strokeWidth = state.Pen?.Width && state.Pen.Width > 0 ? state.Pen.Width : 1
        if (action.g) {
          parts.push(
            `<polygon points="${points}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
          )
        } else {
          parts.push(
            `<polyline points="${points}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
          )
        }
      }
    }

    if (parts.length === 0) return null

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"` +
      ` viewBox="0 0 ${width} ${height}">${parts.join("")}</svg>`
    return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`
  } catch {
    return null
  }
}

/** Goi get_actions nhung tam tat console.log (goi `wmf` log record la khong can thiet). */
function callGetActions(wmf: WmfModule, buffer: Buffer): WmfAction[] {
  const originalLog = console.log
  console.log = () => {}
  try {
    return wmf.get_actions(buffer)
  } finally {
    console.log = originalLog
  }
}

/** wmf2svg khong tu them xmlns SVG -> phai bo sung de browser render duoc. */
function ensureSvgNamespace(svg: string): string {
  const match = svg.match(/<svg\b([^>]*)>/)
  if (!match) return svg
  if (/\bxmlns\s*=/.test(match[1])) return svg
  return svg.replace(/<svg\b([^>]*)>/, `<svg xmlns="http://www.w3.org/2000/svg"$1>`)
}

function stripPlaceableHeader(buffer: Buffer): Buffer {
  if (buffer.length >= 4 && buffer.readUInt32LE(0) === WMF_PLACEABLE_MAGIC) {
    return buffer.subarray(WMF_PLACEABLE_HEADER_SIZE)
  }
  return buffer
}

/** Bo cac record META_ESCAPE (chua du lieu MathType) de parser JS khong nem loi. */
function removeEscapeRecords(buffer: Buffer): Buffer {
  if (buffer.length < WMF_HEADER_SIZE) return buffer
  const chunks: Buffer[] = [buffer.subarray(0, WMF_HEADER_SIZE)]
  let pos = WMF_HEADER_SIZE
  while (pos + 6 <= buffer.length) {
    const size = buffer.readUInt32LE(pos)
    const fn = buffer.readUInt16LE(pos + 4)
    if (fn === 0) {
      chunks.push(buffer.subarray(pos, pos + 6))
      break
    }
    const total = size * 2
    if (total < 6 || pos + total > buffer.length) {
      chunks.push(buffer.subarray(pos))
      break
    }
    if (fn !== META_ESCAPE) chunks.push(buffer.subarray(pos, pos + total))
    pos += total
  }
  return Buffer.concat(chunks)
}

function colorrefToHex(color: number | undefined, fallback: string): string {
  if (color === undefined || color === null || !Number.isFinite(color)) return fallback
  const r = color & 0xff
  const g = (color >> 8) & 0xff
  const b = (color >> 16) & 0xff
  const toHex = (v: number) => v.toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function textsShareOrigin(actions: WmfAction[]): boolean {
  if (actions.length === 0) return false
  const key = (a: WmfAction) => `${a.p?.[0]?.[0] ?? 0},${a.p?.[0]?.[1] ?? 0}`
  const first = key(actions[0])
  return actions.every((a) => key(a) === first)
}

const MATH_FS = 18
const MATH_CHAR_W = 11

function estimateTextWidth(s: string): number {
  return Math.max(1, s.length) * MATH_CHAR_W
}

function splitAlphaNum(token: string): { letters: string; digits: string } | null {
  const m = token.match(/^([A-Za-z][A-Za-z+\-\s]*?)(\d+)$/)
  if (!m) return null
  return { letters: m[1], digits: m[2] }
}

function fractionParts(
  num: string,
  den: string,
  cx: number,
  midY: number,
): { parts: string[]; halfW: number } {
  const halfW = Math.max(estimateTextWidth(num), estimateTextWidth(den)) / 2 + 6
  const numY = midY - MATH_FS * 0.55
  const denY = midY + MATH_FS * 1.05
  return {
    halfW,
    parts: [
      `<text x="${cx}" y="${numY}" font-size="${MATH_FS}" text-anchor="middle"` +
        ` font-family="Times New Roman, serif" fill="#000">${escapeXml(num)}</text>`,
      `<line x1="${cx - halfW}" y1="${midY}" x2="${cx + halfW}" y2="${midY}"` +
        ` stroke="#000" stroke-width="1.5"/>`,
      `<text x="${cx}" y="${denY}" font-size="${MATH_FS}" text-anchor="middle"` +
        ` font-family="Times New Roman, serif" fill="#000">${escapeXml(den)}</text>`,
    ],
  }
}

function wrapMathSvg(inner: string, width: number, height: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"` +
    ` viewBox="0 0 ${width} ${height}">${inner}</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`
}

function rowTokensSvg(tokens: string[]): string {
  const gap = 10
  let x = 12
  const parts: string[] = []
  const y = MATH_FS + 8
  for (const tok of tokens) {
    const w = estimateTextWidth(tok)
    const cx = x + w / 2
    parts.push(
      `<text x="${cx}" y="${y}" font-size="${MATH_FS}" text-anchor="middle"` +
        ` font-family="Times New Roman, serif" fill="#000">${escapeXml(tok)}</text>`,
    )
    x += w + gap
  }
  return wrapMathSvg(parts.join(""), Math.max(40, x), MATH_FS * 2 + 8)
}

function twoFractionsEqSvg(numL: string, denL: string, numR: string, denR: string): string {
  const pad = 14
  const midY = MATH_FS + 10
  const left = fractionParts(numL, denL, 0, midY)
  const right = fractionParts(numR, denR, 0, midY)
  const eqW = estimateTextWidth("=")
  const leftCx = pad + left.halfW
  const eqCx = leftCx + left.halfW + 10 + eqW / 2
  const rightCx = eqCx + eqW / 2 + 10 + right.halfW
  const width = rightCx + right.halfW + pad
  const height = MATH_FS * 3 + 16
  const leftShift = fractionParts(numL, denL, leftCx, midY)
  const rightShift = fractionParts(numR, denR, rightCx, midY)
  const eq = `<text x="${eqCx}" y="${midY + MATH_FS * 0.35}" font-size="${MATH_FS}" text-anchor="middle"` +
    ` font-family="Times New Roman, serif" fill="#000">=</text>`
  return wrapMathSvg([...leftShift.parts, eq, ...rightShift.parts].join(""), width, height)
}

function fractionEqValueSvg(num: string, den: string, value: string): string {
  const pad = 14
  const midY = MATH_FS + 10
  const frac = fractionParts(num, den, 0, midY)
  const eqW = estimateTextWidth("=")
  const valW = estimateTextWidth(value)
  const fracCx = pad + frac.halfW
  const eqCx = fracCx + frac.halfW + 10 + eqW / 2
  const valCx = eqCx + eqW / 2 + 8 + valW / 2
  const width = valCx + valW / 2 + pad
  const height = MATH_FS * 3 + 16
  const shifted = fractionParts(num, den, fracCx, midY)
  const eq = `<text x="${eqCx}" y="${midY + MATH_FS * 0.35}" font-size="${MATH_FS}" text-anchor="middle"` +
    ` font-family="Times New Roman, serif" fill="#000">=</text>`
  const val = `<text x="${valCx}" y="${midY + MATH_FS * 0.35}" font-size="${MATH_FS}" text-anchor="middle"` +
    ` font-family="Times New Roman, serif" fill="#000">${escapeXml(value)}</text>`
  return wrapMathSvg([...shifted.parts, eq, val].join(""), width, height)
}

function simpleFractionSvg(num: string, den: string): string {
  const pad = 10
  const midY = MATH_FS + 10
  const frac = fractionParts(num, den, 0, midY)
  const cx = pad + frac.halfW
  const shifted = fractionParts(num, den, cx, midY)
  const width = cx + frac.halfW + pad
  const height = MATH_FS * 3 + 16
  return wrapMathSvg(shifted.parts.join(""), width, height)
}

/**
 * Dung lai cong thuc MathType khi moi text WMF cung origin [0,0].
 * Tra data URI SVG (phan so dung, khong chong chu).
 */
export function reconstructMathTypeSvg(tokens: string[]): string | null {
  const raw = tokens.map((t) => t.trim()).filter((t) => t.length > 0)
  if (raw.length === 0) return null

  const hasEq = raw.includes("=")
  const rest = raw.filter((t) => t !== "=")

  if (!hasEq && rest.length === 2) {
    return simpleFractionSvg(rest[0], rest[1])
  }

  if (hasEq && rest.length === 2) {
    const s0 = splitAlphaNum(rest[0])
    const s1 = splitAlphaNum(rest[1])
    if (s0 && s1) {
      return twoFractionsEqSvg(s0.letters, s1.letters, s0.digits, s1.digits)
    }
  }

  if (hasEq && rest.length === 3) {
    return fractionEqValueSvg(rest[0], rest[2], rest[1])
  }

  if (hasEq) {
    const eqAt = Math.max(1, Math.ceil(rest.length / 2))
    const row = [...rest.slice(0, eqAt), "=", ...rest.slice(eqAt)]
    return rowTokensSvg(row)
  }
  return rowTokensSvg(rest)
}
