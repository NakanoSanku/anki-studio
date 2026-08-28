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
  description: "Create and review your own flashcards with FSRS, templates, and AI.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Anki Studio",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f9fb" },
    { media: "(prefers-color-scheme: dark)", color: "#141620" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.classList.toggle('dark',window.matchMedia('(prefers-color-scheme: dark)').matches)}catch(e){}",
          }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-[#f8f9fb] dark:bg-[#141620]">
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
