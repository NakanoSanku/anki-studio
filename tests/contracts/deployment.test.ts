import { describe, expect, it } from "vitest"

import { readSource } from "./helpers/source"

const nextConfig = readSource("next.config.ts")
const dockerfile = readSource("Dockerfile")

describe("deployment output modes", () => {
  it("keeps standalone output scoped to Docker builds", () => {
    expect(nextConfig).toContain('process.env.DOCKER_BUILD === "1"')
    expect(nextConfig).toContain('{ output: "standalone" as const }')
    expect(nextConfig).not.toContain('\n  output: "standalone",')
  })

  it("enables standalone output before the Docker production build", () => {
    const dockerFlag = dockerfile.indexOf("ENV DOCKER_BUILD=1")
    const buildCommand = dockerfile.indexOf("RUN npm run build")
    expect(dockerFlag).toBeGreaterThan(-1)
    expect(buildCommand).toBeGreaterThan(dockerFlag)
    expect(dockerfile).toContain("/app/.next/standalone")
  })
})
