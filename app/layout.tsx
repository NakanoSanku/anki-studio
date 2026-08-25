import type { ReactNode } from "react"
import type { Metadata, Viewport } from "next"

import { MotionProvider } from "@/components/motion-provider"
import { OfflineBanner } from "@/components/offline-banner"
import { PwaRegister } from "@/components/pwa-register"
import { SystemTheme } from "@/components/system-theme"
import { TooltipProvider } from "@/components/ui/tooltip"

import "./globals.css"

export const metadata: Metadata = {
  title: "Anki Studio",
  applicationName: "Anki Studio",
  description: "用 FSRS、模板与 AI 制作并复习自己的闪卡。",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Anki Studio",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1c1e" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.classList.toggle('dark',window.matchMedia('(prefers-color-scheme: dark)').matches)}catch(e){}",
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <MotionProvider>
          <TooltipProvider>
            {children}
            <OfflineBanner />
            <PwaRegister />
            <SystemTheme />
          </TooltipProvider>
        </MotionProvider>
      </body>
    </html>
  )
}
