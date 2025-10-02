"use client"

import { useEffect, useRef, useState } from "react"

export default function DotMatrixUFO() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    canvas.width = 320
    canvas.height = 120

    // Clear canvas with transparent background
    ctx.clearRect(0, 0, 320, 120)

    const img = new Image()
    img.crossOrigin = "anonymous"

    img.onload = () => {
      console.log("[v0] Image loaded, processing pixels...")

      // Create a temporary canvas to read pixel data
      const tempCanvas = document.createElement("canvas")
      const tempCtx = tempCanvas.getContext("2d")
      if (!tempCtx) return

      // Set temp canvas to original image size
      tempCanvas.width = img.width
      tempCanvas.height = img.height

      // Draw image to temp canvas
      tempCtx.drawImage(img, 0, 0)

      // Get image data
      const imageData = tempCtx.getImageData(0, 0, img.width, img.height)
      const pixels = imageData.data

      console.log("[v0] Image dimensions:", img.width, "x", img.height)

      // Calculate sampling parameters
      const dotSize = 2 // Size of each dot
      const spacing = 4 // Spacing between dots
      const dotsX = Math.floor(320 / spacing)
      const dotsY = Math.floor(120 / spacing)

      console.log("[v0] Dot grid:", dotsX, "x", dotsY)

      // Sample pixels and draw dots
      for (let dotY = 0; dotY < dotsY; dotY++) {
        for (let dotX = 0; dotX < dotsX; dotX++) {
          // Calculate source pixel position
          const srcX = Math.floor((dotX / dotsX) * img.width)
          const srcY = Math.floor((dotY / dotsY) * img.height)

          // Get pixel data (RGBA)
          const pixelIndex = (srcY * img.width + srcX) * 4
          const r = pixels[pixelIndex]
          const g = pixels[pixelIndex + 1]
          const b = pixels[pixelIndex + 2]
          const a = pixels[pixelIndex + 3]

          // Only draw dot if pixel is not transparent
          if (a > 128) {
            // Alpha threshold
            // Calculate dot position on target canvas
            const dotPosX = dotX * spacing + spacing / 2
            const dotPosY = dotY * spacing + spacing / 2

            // Set color based on sampled pixel
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`
            ctx.beginPath()
            ctx.arc(dotPosX, dotPosY, dotSize, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }

      console.log("[v0] Dot matrix rendering complete")
      setIsLoaded(true)
    }

    img.onerror = () => {
      console.log("[v0] Failed to load image, using fallback")
      drawFallbackUFO(ctx)
      setIsLoaded(true)
    }

    // Load the UFO image
    img.src = "/go1.png"
  }, [])

  const drawFallbackUFO = (ctx: CanvasRenderingContext2D) => {
    const dotSize = 2
    const spacing = 4

    // Simple UFO shape as fallback
    const centerX = 160
    const centerY = 60

    // Main body
    for (let x = centerX - 60; x <= centerX + 60; x += spacing) {
      for (let y = centerY - 20; y <= centerY + 20; y += spacing) {
        const dx = (x - centerX) / 60
        const dy = (y - centerY) / 20

        if (dx * dx + dy * dy <= 1) {
          ctx.fillStyle = "#f8f9fa"
          ctx.beginPath()
          ctx.arc(x, y, dotSize, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    // Blue window
    for (let x = centerX - 15; x <= centerX + 15; x += spacing) {
      for (let y = centerY - 15; y <= centerY + 15; y += spacing) {
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)
        if (distance <= 15) {
          ctx.fillStyle = "#1e40af"
          ctx.beginPath()
          ctx.arc(x, y, dotSize, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    // Pink antenna
    ctx.fillStyle = "#ec4899"
    ctx.beginPath()
    ctx.arc(centerX, centerY - 35, dotSize, 0, Math.PI * 2)
    ctx.fill()
  }

  return (
      <canvas
        ref={canvasRef}
        width={320}
        height={120}
        className="border border-border rounded-lg"
        style={{
          imageRendering: "pixelated",
          backgroundColor: "transparent",
          opacity: isLoaded ? 1 : 0.5,
        }}
      />
  )
}
