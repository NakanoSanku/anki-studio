import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Anki Studio",
    short_name: "Anki Studio",
    description: "用 FSRS、模板与 AI 制作并复习自己的闪卡。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fffaf5",
    theme_color: "#fffaf5",
    lang: "zh-CN",
    categories: ["education", "productivity"],
    shortcuts: [
      {
        name: "开始学习",
        short_name: "学习",
        description: "打开今日学习首页",
        url: "/",
      },
      {
        name: "笔记",
        short_name: "笔记",
        description: "打开卡片与笔记库",
        url: "/notes",
      },
      {
        name: "设置",
        short_name: "设置",
        description: "打开 Anki Studio 设置",
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
