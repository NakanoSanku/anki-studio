import { redirect } from "next/navigation"

import { firstSearchParam, homeTabRedirect } from "@/lib/app-paths"

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const params = await searchParams
  const dest = homeTabRedirect(firstSearchParam(params.tab))
  if (dest) redirect(dest)
  return null
}
