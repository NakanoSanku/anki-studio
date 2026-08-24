import Link from "next/link"
import { ShieldX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function GoogleAuthErrorPage() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background p-5">
      <Card className="w-full max-w-md border-border/70 shadow-none">
        <CardHeader className="items-center text-center">
          <span className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldX className="size-5" />
          </span>
          <CardTitle>无法连接 Google 帐号</CardTitle>
          <CardDescription className="leading-5">
            请使用管理员允许的 Google 帐号；本机卡包不会受到影响。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/settings/sync">返回同步设置</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
