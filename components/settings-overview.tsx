"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { SETTINGS_ROWS } from "@/lib/app-paths"

export function SettingsOverview() {
  return (
    <section className="mx-auto w-full max-w-lg" aria-labelledby="settings-title">
      <h2 id="settings-title" className="sr-only">
        设置
      </h2>
      <ul className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/70">
        {SETTINGS_ROWS.map((row, index) => (
          <li key={row.href} className={index === 0 ? undefined : "border-t border-border/70"}>
            <Link
              href={row.href}
              className="flex items-center gap-3 px-4 py-3.5 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{row.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{row.hint}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
