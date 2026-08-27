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
          background: "#F8F7F3",
          borderRadius: 38,
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 92,
            height: 92,
            borderRadius: 999,
            background: "rgba(199, 248, 90, 0.16)",
            left: -30,
            top: -24,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 104,
            height: 104,
            borderRadius: 999,
            background: "rgba(21, 21, 21, 0.05)",
            right: -38,
            bottom: -34,
          }}
        />

        <div
          style={{
            position: "absolute",
            width: 82,
            height: 98,
            borderRadius: 23,
            background: "#D9DDD8",
            transform: "translate(-4px, 5px) rotate(-7deg)",
          }}
        />
        <div
          style={{
            width: 82,
            height: 98,
            borderRadius: 23,
            background: "#151515",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              width: 64,
              height: 78,
              borderRadius: 17,
              background: "#F8F7F3",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "0 12px",
              gap: 7,
            }}
          >
            <div style={{ width: 39, height: 5, borderRadius: 999, background: "#151515" }} />
            <div style={{ width: 28, height: 4, borderRadius: 999, background: "#7D837E" }} />
            <div style={{ width: 34, height: 4, borderRadius: 999, background: "#B7BBB7" }} />
          </div>
          <div
            style={{
              position: "absolute",
              width: 15,
              height: 15,
              borderRadius: 999,
              background: "#C7F85A",
              right: 13,
              top: 13,
            }}
          />
        </div>
      </div>
    ),
    size
  )
}
