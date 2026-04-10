import { ImageResponse } from "next/og"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          position: "relative",
        }}
      >
        {/* dot */}
        <div
          style={{
            position: "absolute",
            top: 2,
            left: "50%",
            transform: "translateX(-50%)",
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#3b82f6",
          }}
        />
        {/* stem */}
        <div
          style={{
            position: "absolute",
            bottom: 4,
            left: "50%",
            transform: "translateX(-50%)",
            width: 5,
            height: 16,
            borderRadius: 3,
            background: "#0f172a",
          }}
        />
      </div>
    ),
    { ...size },
  )
}
