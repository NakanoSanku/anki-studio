const DATA_SHEET_NAME = "_anki_studio_sync"
const SCHEMA_VERSION = 1
const CHUNK_SIZE = 40000
const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024
const HEADERS = [
  "deck_id",
  "revision",
  "updated_at",
  "deleted_at",
  "name",
  "card_count",
  "part_index",
  "part_count",
  "payload_base64",
  "schema_version",
]

/**
 * Run once from a script bound to the destination Google Sheet.
 * Copy the logged web app secret into GOOGLE_SHEETS_SYNC_SECRET.
 */
function setupGoogleSheetsSync() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
  if (!spreadsheet) throw new Error("请从目标 Google Sheet 的 Apps Script 编辑器运行此函数")

  const properties = PropertiesService.getScriptProperties()
  properties.setProperty("SPREADSHEET_ID", spreadsheet.getId())
  if (!properties.getProperty("SYNC_SECRET")) {
    properties.setProperty("SYNC_SECRET", createSecret_())
  }

  ensureDataSheet_(true)
  const result = {
    spreadsheetId: spreadsheet.getId(),
    secret: properties.getProperty("SYNC_SECRET"),
  }
  console.log("Anki Studio Google Sheets 同步配置：%s", JSON.stringify(result))
  return result
}

/** Run this to invalidate the previous Cloudflare secret. */
function resetGoogleSheetsSyncSecret() {
  const properties = PropertiesService.getScriptProperties()
  if (!properties.getProperty("SPREADSHEET_ID")) {
    throw new Error("请先运行 setupGoogleSheetsSync")
  }
  const secret = createSecret_()
  properties.setProperty("SYNC_SECRET", secret)
  console.log("新的 Anki Studio 同步密钥：%s", secret)
  return secret
}

function doGet() {
  return json_({ ok: false, error: "此 Web App 仅接受 Anki Studio 的 POST 请求" })
}

function doPost(event) {
  try {
    const request = JSON.parse(event && event.postData ? event.postData.contents : "{}")
    authenticate_(request.secret)

    if (request.action === "status") {
      ensureDataSheet_()
      return json_({
        ok: true,
        schemaVersion: SCHEMA_VERSION,
      })
    }
    if (request.action === "index") {
      return json_({ ok: true, decks: listIndex_() })
    }
    if (request.action === "get") {
      validateDeckId_(request.id)
      const version = findCurrentVersion_(readRows_(ensureDataSheet_()), request.id)
      return json_({ ok: true, payload: version ? decodePayload_(version) : null })
    }
    if (request.action === "put") {
      validateDeckId_(request.id)
      return json_({ ok: true, result: putDeck_(request.id, request.body) })
    }
    throw new Error("不支持的同步操作")
  } catch (error) {
    console.error(error && error.stack ? error.stack : String(error))
    return json_({ ok: false, error: safeError_(error) })
  }
}

function putDeck_(id, body) {
  if (!body || typeof body !== "object") throw new Error("请求无效")
  const expectedRev = Number(body.expectedRev)
  if (!Number.isInteger(expectedRev) || expectedRev < 0) throw new Error("版本无效")

  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    const sheet = ensureDataSheet_()
    const allRows = readRows_(sheet)
    const current = findCurrentVersion_(allRows, id)
    const currentPayload = current ? decodePayload_(current) : null
    const currentRev = currentPayload ? Number(currentPayload.rev) : 0
    if (currentRev !== expectedRev) {
      return {
        ok: false,
        conflict: true,
        server: currentPayload || emptyPayload_(),
      }
    }

    const deletedAt = positiveNumberOrNull_(body.deletedAt)
    const deck = body.deck || (currentPayload ? currentPayload.deck : null)
    if (!deletedAt && !deck) throw new Error("缺少卡包内容")

    const nextRev = currentRev + 1
    const updatedAt = Date.now()
    const payload = {
      rev: nextRev,
      updatedAt: updatedAt,
      deletedAt: deletedAt,
      deck: deck,
      editorState: deletedAt
        ? null
        : body.editorState || (currentPayload ? currentPayload.editorState : null),
    }
    const encoded = encodePayload_(payload)
    const chunks = chunk_(encoded, CHUNK_SIZE)
    const name = deck && typeof deck.name === "string" && deck.name.trim()
      ? deck.name.trim().slice(0, 200)
      : "未命名卡包"
    const cardCount = deck && Array.isArray(deck.cards) ? deck.cards.length : 0
    const rows = chunks.map(function (part, index) {
      return [
        id,
        nextRev,
        updatedAt,
        deletedAt || "",
        name,
        cardCount,
        index,
        chunks.length,
        part,
        SCHEMA_VERSION,
      ]
    })

    const startRow = Math.max(2, sheet.getLastRow() + 1)
    const requiredRows = startRow + rows.length - 1
    if (requiredRows > sheet.getMaxRows()) {
      sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows())
    }
    sheet.getRange(startRow, 1, rows.length, HEADERS.length).setValues(rows)
    SpreadsheetApp.flush()
    PropertiesService.getScriptProperties().setProperty("HAS_WRITTEN_DATA", "1")

    const oldRows = allRows.filter(function (row) { return row.id === id }).map(function (row) {
      return row.rowNumber
    })
    try {
      deleteRows_(sheet, oldRows)
    } catch (cleanupError) {
      console.error("旧同步分块清理失败：%s", String(cleanupError))
    }

    return { ok: true, rev: nextRev, updatedAt: updatedAt }
  } finally {
    lock.releaseLock()
  }
}

function listIndex_() {
  const rows = readRows_(ensureDataSheet_())
  const ids = {}
  rows.forEach(function (row) { ids[row.id] = true })
  return Object.keys(ids).map(function (id) {
    const current = findCurrentVersion_(rows, id)
    if (!current) return null
    const first = current.rows[0]
    return {
      id: id,
      rev: current.revision,
      name: first.name || "未命名卡包",
      cardCount: Math.max(0, Number(first.cardCount) || 0),
      updatedAt: Math.max(0, Number(first.updatedAt) || 0),
      deletedAt: positiveNumberOrNull_(first.deletedAt),
    }
  }).filter(function (entry) { return entry !== null })
}

function findCurrentVersion_(rows, id) {
  const matching = rows.filter(function (row) { return row.id === id })
  if (!matching.length) return null
  const revision = matching.reduce(function (latest, row) {
    return Math.max(latest, Number(row.revision) || 0)
  }, 0)
  return {
    revision: revision,
    rows: matching.filter(function (row) { return Number(row.revision) === revision }),
  }
}

function decodePayload_(version) {
  const rows = version.rows.slice().sort(function (left, right) {
    return left.partIndex - right.partIndex
  })
  const partCount = rows.length ? Number(rows[0].partCount) : 0
  if (!partCount || rows.length !== partCount) throw new Error("Google Sheet 中的卡包分块不完整")
  for (let index = 0; index < rows.length; index += 1) {
    if (
      rows[index].partIndex !== index ||
      Number(rows[index].partCount) !== partCount ||
      Number(rows[index].schemaVersion) !== SCHEMA_VERSION
    ) {
      throw new Error("Google Sheet 中的卡包分块无效")
    }
  }
  const bytes = Utilities.base64DecodeWebSafe(rows.map(function (row) {
    return row.payload
  }).join(""))
  const payload = JSON.parse(Utilities.newBlob(bytes).getDataAsString("UTF-8"))
  if (!payload || Number(payload.rev) !== version.revision) {
    throw new Error("Google Sheet 中的卡包版本无效")
  }
  return payload
}

function encodePayload_(payload) {
  const json = JSON.stringify(payload)
  if (Utilities.newBlob(json).getBytes().length > MAX_PAYLOAD_BYTES) {
    throw new Error("卡包太大，无法同步")
  }
  return Utilities.base64EncodeWebSafe(json, Utilities.Charset.UTF_8)
}

function readRows_(sheet) {
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) {
    if (PropertiesService.getScriptProperties().getProperty("HAS_WRITTEN_DATA") === "1") {
      throw new Error("Google Sheet 同步数据已被清空，请先从备份恢复")
    }
    return []
  }
  return sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues().map(function (values, index) {
    return {
      rowNumber: index + 2,
      id: String(values[0] || ""),
      revision: Number(values[1]),
      updatedAt: Number(values[2]),
      deletedAt: values[3],
      name: String(values[4] || ""),
      cardCount: Number(values[5]),
      partIndex: Number(values[6]),
      partCount: Number(values[7]),
      payload: String(values[8] || ""),
      schemaVersion: Number(values[9]),
    }
  }).filter(function (row) {
    return /^[a-zA-Z0-9_-]{6,80}$/.test(row.id) && Number.isInteger(row.revision) && row.revision > 0
  })
}

function ensureDataSheet_(allowInitialize) {
  const spreadsheet = SpreadsheetApp.openById(requiredProperty_("SPREADSHEET_ID"))
  let sheet = spreadsheet.getSheetByName(DATA_SHEET_NAME)
  if (!sheet) {
    if (!allowInitialize) throw new Error("Google Sheet 同步工作表不存在，请先从备份恢复")
    sheet = spreadsheet.insertSheet(DATA_SHEET_NAME)
  }

  const currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0]
  const isBlank = currentHeaders.every(function (value) { return value === "" })
  if (isBlank) {
    if (!allowInitialize) throw new Error("Google Sheet 同步表头已被清空，请先从备份恢复")
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    sheet.setFrozenRows(1)
  } else if (currentHeaders.join("\n") !== HEADERS.join("\n")) {
    throw new Error("Google Sheet 同步表结构不兼容")
  }
  try {
    if (!sheet.isSheetHidden()) sheet.hideSheet()
  } catch (error) {
    console.warn("无法隐藏同步工作表：%s", String(error))
  }
  return sheet
}

function deleteRows_(sheet, rowNumbers) {
  if (!rowNumbers.length) return
  const rows = rowNumbers.slice().sort(function (left, right) { return right - left })
  let rangeEnd = rows[0]
  let rangeStart = rows[0]
  for (let index = 1; index <= rows.length; index += 1) {
    const row = rows[index]
    if (row === rangeStart - 1) {
      rangeStart = row
      continue
    }
    sheet.deleteRows(rangeStart, rangeEnd - rangeStart + 1)
    rangeStart = row
    rangeEnd = row
  }
}

function chunk_(value, size) {
  const chunks = []
  for (let offset = 0; offset < value.length; offset += size) {
    chunks.push(value.slice(offset, offset + size))
  }
  return chunks.length ? chunks : [""]
}

function authenticate_(provided) {
  const expected = requiredProperty_("SYNC_SECRET")
  if (!constantTimeEqual_(String(provided || ""), expected)) throw new Error("同步密钥不正确")
}

function constantTimeEqual_(left, right) {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return mismatch === 0
}

function validateDeckId_(id) {
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{6,80}$/.test(id)) {
    throw new Error("卡包 id 无效")
  }
}

function requiredProperty_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name)
  if (!value) throw new Error("Google Sheets 同步尚未初始化")
  return value
}

function positiveNumberOrNull_(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function emptyPayload_() {
  return { rev: 0, updatedAt: 0, deletedAt: null, deck: null, editorState: null }
}

function createSecret_() {
  const seed = Utilities.getUuid() + Utilities.getUuid() + Date.now()
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, seed)
  ).replace(/=+$/, "")
}

function safeError_(error) {
  return error && typeof error.message === "string" ? error.message.slice(0, 240) : "同步失败"
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON)
}
