import { getGoogleSheetsAuthorization } from "@/lib/sync-server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export type DriveSpreadsheetItem = {
  id: string
  name: string
  modifiedTime?: string
  webViewLink?: string
}

export async function GET(request: Request) {
  const authorization = await getGoogleSheetsAuthorization(request)
  if (!authorization.ok) return authorization.response

  const url = new URL(request.url)
  const query = url.searchParams.get("q")?.trim() || ""

  try {
    let q = "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false"
    if (query) {
      const sanitized = query.replace(/'/g, "\\'")
      q += ` and name contains '${sanitized}'`
    }

    const driveUrl = new URL("https://www.googleapis.com/drive/v3/files")
    driveUrl.searchParams.set("q", q)
    driveUrl.searchParams.set("orderBy", "modifiedTime desc")
    driveUrl.searchParams.set("pageSize", "30")
    driveUrl.searchParams.set("fields", "files(id, name, modifiedTime, webViewLink)")

    const response = await fetch(driveUrl.toString(), {
      headers: {
        Authorization: `Bearer ${authorization.accessToken}`,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.warn("Drive files list warning:", response.status, errorText)
      return Response.json(
        { files: [], error: "无法直接列出云端硬盘文件，您可以使用上方新建表格或直接粘贴表格链接" },
        { status: 200 }
      )
    }

    const data = (await response.json()) as { files?: DriveSpreadsheetItem[] }
    return Response.json({ files: data.files || [] })
  } catch (error) {
    console.error("Error fetching spreadsheets from drive:", error)
    return Response.json(
      { files: [], error: "列出表格时发生错误" },
      { status: 200 }
    )
  }
}
