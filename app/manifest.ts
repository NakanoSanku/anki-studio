import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Anki Studio",
    short_name: "Anki Studio",
    description: "Create and review your own flashcards with FSRS, templates, and AI.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fffaf5",
    theme_color: "#fffaf5",
    lang: "en",
    categories: ["education", "productivity"],
    shortcuts: [
      {
        name: "Start studying",
        short_name: "Study",
        description: "Open today’s study overview",
        url: "/",
      },
      {
        name: "Notes",
        short_name: "Notes",
        description: "Open your cards and notes",
        url: "/notes",
      },
      {
        name: "Settings",
        short_name: "Settings",
        description: "Open Anki Studio settings",
        url: "/settings",
      },
    ],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  }
}
