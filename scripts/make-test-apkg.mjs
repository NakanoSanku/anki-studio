import { writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import initSqlJs from "sql.js"
import JSZip from "jszip"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const SQL = await initSqlJs({
  locateFile: () => join(root, "public", "sql-wasm.wasm"),
})
const db = new SQL.Database()
db.run(`
CREATE TABLE col (
    id integer primary key, crt integer not null, mod integer not null, scm integer not null,
    ver integer not null, dty integer not null, usn integer not null, ls integer not null,
    conf text not null, models text not null, decks text not null, dconf text not null, tags text not null
);
CREATE TABLE notes (
    id integer primary key, guid text not null, mid integer not null, mod integer not null,
    usn integer not null, tags text not null, flds text not null, sfld integer not null,
    csum integer not null, flags integer not null, data text not null
);
CREATE TABLE cards (
    id integer primary key, nid integer not null, did integer not null, ord integer not null,
    mod integer not null, usn integer not null, type integer not null, queue integer not null,
    due integer not null, ivl integer not null, factor integer not null, reps integer not null,
    lapses integer not null, left integer not null, odue integer not null, odid integer not null,
    flags integer not null, data text not null
);
CREATE TABLE revlog (
    id integer primary key, cid integer not null, usn integer not null, ease integer not null,
    ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null
);
CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
`)

const now = Date.now()
const modelId = now
const deckId = now + 1
const models = {
  [modelId]: {
    id: modelId,
    name: "Vocabulary",
    type: 0,
    mod: Math.floor(now / 1000),
    usn: -1,
    sortf: 0,
    did: deckId,
    tmpls: [
      {
        name: "Card 1",
        ord: 0,
        qfmt: "<div class='word'>{{Word}}</div>",
        afmt: "{{FrontSide}}<hr id=answer>{{Meaning}}",
        bqfmt: "",
        bafmt: "",
        did: null,
        bfont: "",
        bsize: 0,
      },
    ],
    flds: [
      { name: "Word", ord: 0, sticky: false, rtl: false, font: "Arial", size: 20 },
      { name: "Meaning", ord: 1, sticky: false, rtl: false, font: "Arial", size: 20 },
    ],
    css: ".card { font-family: sans-serif; text-align: center; }",
    latexPre: "",
    latexPost: "",
    req: [[0, "any", [0]]],
    tags: [],
    vers: [],
  },
}
const decks = {
  1: { id: 1, name: "Default", dyn: 0, usn: 0, mod: 0 },
  [deckId]: { id: deckId, name: "APKG导入本", dyn: 0, usn: -1, mod: Math.floor(now / 1000) },
}

db.run(
  `INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, '{}', '{}')`,
  [
    Math.floor(now / 1000),
    now,
    now,
    JSON.stringify({ curDeck: deckId, curModel: String(modelId) }),
    JSON.stringify(models),
    JSON.stringify(decks),
  ]
)
db.run(
  `INSERT INTO notes VALUES (?, 'abc123guid', ?, ?, -1, '', ?, ?, 0, 0, '')`,
  [now + 10, modelId, Math.floor(now / 1000), ["quixotic", "不切实际的"].join("\x1f"), "quixotic"]
)
db.run(
  `INSERT INTO cards VALUES (?, ?, ?, 0, ?, -1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, '')`,
  [now + 11, now + 10, deckId, Math.floor(now / 1000)]
)

const zip = new JSZip()
zip.file("collection.anki2", db.export())
zip.file("media", "{}")
const bytes = await zip.generateAsync({ type: "uint8array" })
const out = join(root, "tmp-import-deck.apkg")
writeFileSync(out, bytes)
console.log(out)
