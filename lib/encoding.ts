export type ImportEncoding =
  | "utf-8"
  | "utf-8-bom"
  | "utf-16le"
  | "utf-16be"
  | "gbk"
  | "gb18030"

export type DecodeResult = {
  text: string
  encoding: ImportEncoding
  encodingLabel: string
  warnings: string[]
}

export const ENCODING_LABELS: Record<ImportEncoding, string> = {
  "utf-8": "UTF-8",
  "utf-8-bom": "UTF-8（带 BOM）",
  "utf-16le": "UTF-16 LE",
  "utf-16be": "UTF-16 BE",
  gbk: "GBK",
  gb18030: "GB18030",
}

function hasPrefix(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value)
}

function tryDecode(bytes: Uint8Array, label: string, fatal: boolean): string | null {
  try {
    return new TextDecoder(label, { fatal }).decode(bytes)
  } catch {
    return null
  }
}

function supportsEncoding(label: string): boolean {
  try {
    new TextDecoder(label)
    return true
  } catch {
    return false
  }
}

export function replacementCount(text: string): number {
  let count = 0
  for (const char of text) {
    if (char === "\uFFFD") count += 1
  }
  return count
}

export function looksLikeBinary(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096))
  if (sample.length === 0) return false
  let control = 0
  for (const value of sample) {
    if (value === 0 || (value < 0x09) || (value > 0x0d && value < 0x20)) {
      control += 1
    }
  }
  return control / sample.length > 0.25
}

export function looksLikeMojibake(text: string): boolean {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
  const latin = (text.match(/[\u00A0-\u00FF]/g) ?? []).length
  return latin >= 6 && cjk === 0 && latin > text.length * 0.15
}

export function decodeLegacyChinese(bytes: Uint8Array): { text: string; encoding: "gbk" | "gb18030" } | null {
  if (supportsEncoding("gbk")) {
    const text = tryDecode(bytes, "gbk", false)
    if (text !== null) return { text, encoding: "gbk" }
  }
  if (supportsEncoding("gb18030")) {
    const text = tryDecode(bytes, "gb18030", false)
    if (text !== null) return { text, encoding: "gb18030" }
  }
  return null
}

export function decodeImportBytes(bytes: Uint8Array): DecodeResult {
  if (bytes.length === 0) {
    throw new Error("文件是空的")
  }

  if (hasPrefix(bytes, [0xef, 0xbb, 0xbf])) {
    const text = tryDecode(bytes.subarray(3), "utf-8", true)
    if (text === null) {
      throw new Error("文件声明为 UTF-8（BOM），但内容不是合法 UTF-8")
    }
    return {
      text,
      encoding: "utf-8-bom",
      encodingLabel: ENCODING_LABELS["utf-8-bom"],
      warnings: [],
    }
  }

  if (hasPrefix(bytes, [0xff, 0xfe])) {
    const text = tryDecode(bytes, "utf-16le", true)
    if (text === null) {
      throw new Error("文件不是合法的 UTF-16 LE")
    }
    return {
      text: text.replace(/^\uFEFF/, ""),
      encoding: "utf-16le",
      encodingLabel: ENCODING_LABELS["utf-16le"],
      warnings: ["已按 UTF-16 LE 解码，建议另存为 UTF-8"],
    }
  }

  if (hasPrefix(bytes, [0xfe, 0xff])) {
    const text = tryDecode(bytes, "utf-16be", true)
    if (text === null) {
      throw new Error("文件不是合法的 UTF-16 BE")
    }
    return {
      text: text.replace(/^\uFEFF/, ""),
      encoding: "utf-16be",
      encodingLabel: ENCODING_LABELS["utf-16be"],
      warnings: ["已按 UTF-16 BE 解码，建议另存为 UTF-8"],
    }
  }

  const utf8 = tryDecode(bytes, "utf-8", true)
  if (utf8 !== null) {
    const warnings: string[] = []
    if (looksLikeMojibake(utf8)) {
      warnings.push("文本可能是错误编码（乱码），请确认中文是否正常")
    }
    return {
      text: utf8,
      encoding: "utf-8",
      encodingLabel: ENCODING_LABELS["utf-8"],
      warnings,
    }
  }

  const legacy = decodeLegacyChinese(bytes)
  if (legacy && replacementCount(legacy.text) <= Math.max(2, bytes.length * 0.02)) {
    return {
      text: legacy.text,
      encoding: legacy.encoding,
      encodingLabel: ENCODING_LABELS[legacy.encoding],
      warnings: [`文件不是合法 UTF-8，已按 ${ENCODING_LABELS[legacy.encoding]} 解码，请确认中文是否正常`],
    }
  }

  throw new Error("无法识别文件编码。请将文件另存为 UTF-8 后重试")
}
