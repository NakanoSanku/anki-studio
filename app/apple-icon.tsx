import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          background: "#fffaf5",
          borderRadius: 38,
        }}
      >
        <div style={{ position: "absolute", width: 86, height: 72, borderRadius: 999, background: "#c8f889", left: -24, top: 16, transform: "rotate(-18deg)" }} />
        <div style={{ position: "absolute", width: 82, height: 72, borderRadius: 999, background: "#ffaaa0", right: -22, top: 31, transform: "rotate(18deg)" }} />
        <div style={{ position: "absolute", width: 78, height: 72, borderRadius: 999, background: "#9dceff", left: -20, bottom: 10, transform: "rotate(22deg)" }} />
        <div style={{ position: "absolute", width: 76, height: 68, borderRadius: 999, background: "#ffe08d", right: -15, bottom: 4, transform: "rotate(-12deg)" }} />

        <div
          style={{
            width: 90,
            height: 112,
            borderRadius: 29,
            background: "#090909",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: "rotate(-5deg)",
          }}
        >
          <div
            style={{
              width: 70,
              height: 91,
              borderRadius: 22,
              background: "#fffdf9",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 13,
            }}
          >
            <div style={{ display: "flex", gap: 20 }}>
              <div style={{ width: 7, height: 7, borderRadius: 999, background: "#090909" }} />
              <div style={{ width: 7, height: 7, borderRadius: 999, background: "#090909" }} />
            </div>
            <div style={{ width: 29, height: 12, borderBottom: "5px solid #090909", borderRadius: 999 }} />
          </div>
        </div>
      </div>
    ),
    size
  )
}
