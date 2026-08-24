import { redirect } from "next/navigation"

import { PATHS, resolveLegacyPathname } from "@/lib/app-paths"

export default function TemplatesRedirectPage() {
  redirect(resolveLegacyPathname("/templates") ?? PATHS.settingsTemplates)
}
