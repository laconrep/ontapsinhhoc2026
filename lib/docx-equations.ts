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
