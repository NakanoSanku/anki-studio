import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..")

export function sourcePath(...segments: string[]): string {
  return join(repoRoot, ...segments)
}

export function readSource(...segments: string[]): string {
  return readFileSync(sourcePath(...segments), "utf8")
}

export function sourceExists(...segments: string[]): boolean {
  return existsSync(sourcePath(...segments))
}
