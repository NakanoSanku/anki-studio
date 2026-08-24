import { redirect } from "next/navigation"

import { PATHS, resolveLegacyPathname } from "@/lib/app-paths"

export default function SettingsTemplatesRedirectPage() {
  redirect(resolveLegacyPathname("/settings/templates") ?? PATHS.settingsTemplates)
}
