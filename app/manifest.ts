import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Anki Studio",
    short_name: "Anki Studio",
    description: "用 FSRS、模板与 AI 制作并复习自己的闪卡。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f3ec",
    theme_color: "#4f46e5",
    lang: "zh-CN",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  }
}
