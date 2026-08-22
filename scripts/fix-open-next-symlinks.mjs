import fs from "node:fs"
import path from "node:path"

const root = path.resolve(".open-next")

function convert(dir) {
  if (!fs.existsSync(dir)) return 0
  let converted = 0
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    try {
      const lstat = fs.lstatSync(full)
      if (lstat.isSymbolicLink()) {
        const target = path.resolve(path.dirname(full), fs.readlinkSync(full))
        let targetIsDir = false
        try {
          targetIsDir = fs.statSync(target).isDirectory()
        } catch {
          try {
            targetIsDir = fs.lstatSync(target).isDirectory()
          } catch {
            continue
          }
        }
        if (targetIsDir) {
          fs.unlinkSync(full)
          fs.symlinkSync(target, full, "junction")
          converted += 1
          continue
        }
      }
      if (lstat.isDirectory()) converted += convert(full)
    } catch {
      // racing with the bundler
    }
  }
  return converted
}

export function fixOpenNextSymlinks() {
  return convert(root)
}
