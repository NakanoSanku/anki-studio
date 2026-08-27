import { describe, expect, it } from "vitest"

import { decodeImportBytes, looksLikeBinary, looksLikeMojibake } from "@/lib/encoding"

function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

describe("decodeImportBytes", () => {
  it("reads UTF-8", () => {
    const result = decodeImportBytes(bytesOf("Word,中文\n"))
    expect(result.encoding).toBe("utf-8")
    expect(result.text).toContain("中文")
    expect(result.warnings).toEqual([])
  })

  it("strips UTF-8 BOM", () => {
    const body = bytesOf("hello")
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...body])
    const result = decodeImportBytes(bytes)
    expect(result.encoding).toBe("utf-8-bom")
    expect(result.text).toBe("hello")
  })

  it("reads UTF-16 LE with BOM", () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0x42, 0x00])
    const result = decodeImportBytes(bytes)
    expect(result.encoding).toBe("utf-16le")
    expect(result.text).toBe("AB")
  })

  it("rejects an empty buffer", () => {
    expect(() => decodeImportBytes(new Uint8Array())).toThrow("文件是空的")
  })

  it("decodes GBK when UTF-8 is invalid", () => {
    const ascii = bytesOf("Word,Translation\n")
    const gbkChinese = [0xd6, 0xd0, 0xce, 0xc4]
    const bytes = Uint8Array.from([...ascii, ...gbkChinese, ...bytesOf(",hi\n")])
    try {
      new TextDecoder("gbk")
    } catch {
      expect(() => decodeImportBytes(bytes)).toThrow(/编码/)
      return
    }
    const result = decodeImportBytes(bytes)
    expect(result.encoding).toMatch(/gbk|gb18030/)
    expect(result.text).toContain("中文")
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it("rejects a UTF-8 BOM that is not valid UTF-8", () => {
    expect(() => decodeImportBytes(Uint8Array.from([0xef, 0xbb, 0xbf, 0xff, 0xfe]))).toThrow(/UTF-8/)
  })
})

describe("looksLikeBinary", () => {
  it("flags buffers with many null bytes", () => {
    expect(looksLikeBinary(new TextEncoder().encode("hello,world"))).toBe(false)
    expect(looksLikeBinary(new Uint8Array(32))).toBe(true)
  })
})

describe("looksLikeMojibake", () => {
  it("detects latin-1 mojibake without CJK", () => {
    expect(looksLikeMojibake("ä¸­æ–‡æµ‹è¯•")).toBe(true)
    expect(looksLikeMojibake("中文测试")).toBe(false)
  })
})
