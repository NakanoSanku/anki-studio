import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { OfflineBanner } from "@/components/offline-banner"
import { PwaRegister } from "@/components/pwa-register"
import { SystemTheme } from "@/components/system-theme"
import { TooltipProvider } from "@/components/ui/tooltip"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Anki Studio",
  applicationName: "Anki Studio",
  description: "用 FSRS、模板与 AI 制作并复习自己的闪卡。",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Anki Studio",
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  colorScheme: "light dark",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.classList.toggle('dark',window.matchMedia('(prefers-color-scheme: dark)').matches)}catch(e){}",
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>
          {children}
          <OfflineBanner />
          <PwaRegister />
          <SystemTheme />
        </TooltipProvider>
      </body>
    </html>
  )
}
