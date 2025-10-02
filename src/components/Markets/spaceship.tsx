"use client"

import { useEffect, useRef, useState, useCallback } from "react"

interface Dot {
  x: number
  y: number
  originalX: number
  originalY: number
  color: string
  alpha: number
}

export default function DotMatrixUFO() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [dots, setDots] = useState<Dot[]>([])
  const mousePos = useRef({ x: 0, y: 0 })
  const animationRef = useRef<number>(0)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    mousePos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }, [])

  const animate = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || dots.length === 0) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    dots.forEach((dot) => {
      const dx = mousePos.current.x - dot.originalX
      const dy = mousePos.current.y - dot.originalY
      const distance = Math.sqrt(dx * dx + dy * dy)

      const maxDistance = 100 // Maximum influence distance
      const force = Math.max(0, 1 - distance / maxDistance)
      const floatStrength = force * force * 15 // Quadratic falloff for smoother effect

      // Apply floating offset
      const offsetX = (dx / distance || 0) * floatStrength * -0.3
      const offsetY = (dy / distance || 0) * floatStrength * -0.3

      dot.x = dot.originalX + offsetX
      dot.y = dot.originalY + offsetY

      const sizeMultiplier = 1 + force * 0.8 // Increased from 0.5
      ctx.fillStyle = dot.color
      ctx.beginPath()
      ctx.arc(dot.x, dot.y, 2 * sizeMultiplier, 0, Math.PI * 2) // Increased base size for better visibility with larger spacing
      ctx.fill()
    })

    animationRef.current = requestAnimationFrame(animate)
  }, [dots])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = 600 // Increased from 400
    canvas.height = 400 // Increased from 150

    // Clear canvas with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const img = new Image()
    img.crossOrigin = "anonymous"

    img.onload = () => {
      console.log("[v0] Image loaded, processing pixels...")

      // Create a temporary canvas to read pixel data
      const tempCanvas = document.createElement("canvas")
      const tempCtx = tempCanvas.getContext("2d")
      if (!tempCtx) return

      const drawWidth = canvas.width
      const drawHeight = canvas.height
      const offsetX = 0
      const offsetY = 0

      tempCanvas.width = drawWidth
      tempCanvas.height = drawHeight

      // Draw image to fill entire canvas
      tempCtx.drawImage(img, 0, 0, drawWidth, drawHeight)

      // Get image data from scaled image
      const imageData = tempCtx.getImageData(0, 0, drawWidth, drawHeight)
      const pixels = imageData.data

      console.log("[v0] Image dimensions:", img.width, "x", img.height)
      console.log("[v0] Scaled dimensions:", drawWidth, "x", drawHeight)

      const spacing = 4 // Increased spacing for more pixel separation
      const dotsX = Math.floor(drawWidth / spacing)
      const dotsY = Math.floor(drawHeight / spacing)

      console.log("[v0] Dot grid:", dotsX, "x", dotsY)

      const newDots: Dot[] = []

      // Sample pixels and create dot data
      for (let dotY = 0; dotY < dotsY; dotY++) {
        for (let dotX = 0; dotX < dotsX; dotX++) {
          // Calculate source pixel position in scaled image
          const srcX = Math.floor((dotX / dotsX) * drawWidth)
          const srcY = Math.floor((dotY / dotsY) * drawHeight)

          // Get pixel data (RGBA)
          const pixelIndex = (srcY * drawWidth + srcX) * 4
          const r = pixels[pixelIndex]
          const g = pixels[pixelIndex + 1]
          const b = pixels[pixelIndex + 2]
          const a = pixels[pixelIndex + 3]

          if (a > 80) {
            // Adjusted threshold to show more pixels while maintaining spacing
            // Calculate dot position on target canvas with centering offset
            const dotPosX = offsetX + dotX * spacing + spacing / 2
            const dotPosY = offsetY + dotY * spacing + spacing / 2

            newDots.push({
              x: dotPosX,
              y: dotPosY,
              originalX: dotPosX,
              originalY: dotPosY,
              color: `rgba(${r}, ${g}, ${b}, ${a / 255})`,
              alpha: a / 255,
            })
          }
        }
      }

      setDots(newDots)
      console.log("[v0] Dot matrix rendering complete")
      setIsLoaded(true)
    }

    img.onerror = () => {
      console.log("[v0] Failed to load image, using fallback")
      drawFallbackUFO()
      setIsLoaded(true)
    }

    img.src = "/go1.png"
  }, [])

  const drawFallbackUFO = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const spacing = 8 // Increased spacing for fallback UFO as well
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const newDots: Dot[] = []

    // Simple UFO shape as fallback
    for (let x = centerX - 80; x <= centerX + 80; x += spacing) {
      for (let y = centerY - 30; y <= centerY + 30; y += spacing) {
        const dx = (x - centerX) / 80
        const dy = (y - centerY) / 30

        if (dx * dx + dy * dy <= 1) {
          newDots.push({
            x,
            y,
            originalX: x,
            originalY: y,
            color: "#f8f9fa",
            alpha: 1,
          })
        }
      }
    }

    // Blue window
    for (let x = centerX - 20; x <= centerX + 20; x += spacing) {
      for (let y = centerY - 20; y <= centerY + 20; y += spacing) {
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)
        if (distance <= 20) {
          newDots.push({
            x,
            y,
            originalX: x,
            originalY: y,
            color: "#1e40af",
            alpha: 1,
          })
        }
      }
    }

    // Pink antenna
    newDots.push({
      x: centerX,
      y: centerY - 45,
      originalX: centerX,
      originalY: centerY - 45,
      color: "#ec4899",
      alpha: 1,
    })

    setDots(newDots)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.addEventListener("mousemove", handleMouseMove)

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove)
    }
  }, [handleMouseMove])

  useEffect(() => {
    if (dots.length > 0) {
      animationRef.current = requestAnimationFrame(animate)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [animate, dots])

  return (
    <canvas
      ref={canvasRef}
      className="cursor-none" // Hide cursor for better effect
    />
  )
}