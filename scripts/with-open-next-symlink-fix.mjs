import { spawn } from "node:child_process"
import { fixOpenNextSymlinks } from "./fix-open-next-symlinks.mjs"

const timer = setInterval(() => {
  fixOpenNextSymlinks()
}, 40)

const child = spawn(process.execPath, ["./node_modules/@opennextjs/cloudflare/dist/cli/index.js", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
})

child.on("exit", (code) => {
  clearInterval(timer)
  fixOpenNextSymlinks()
  process.exit(code ?? 1)
})
