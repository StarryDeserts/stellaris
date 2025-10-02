"use client"

import { useState, useEffect } from "react"
import DotMatrixUFO from "../Markets/spaceship"

interface CarouselSlide {
  title: string
  subtitle: string
  image: string
  cta: string
}

const carouselSlides: CarouselSlide[] = [
  {
    title: "高收益理财",
    subtitle: "专业DeFi投资策略",
    image: "/bg2.png",
    cta: "了解更多",
  },
  {
    title: "安全稳健",
    subtitle: "智能风险管控",
    image: "/bg1.png",
    cta: "立即开始",
  },
]

export function CryptoAPYBanner() {
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % carouselSlides.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length)
  }

  return (
    <div className="w-full h-[210px] bg-[var(--color-financial-dark)] rounded-xl overflow-hidden flex my-10">
      {/* 左侧轮播图 */}
      <div className="flex-1 relative">
        {carouselSlides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
              index === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
          >
            <div className="relative h-full bg-gradient-to-br from-[var(--color-financial-green)] to-[var(--color-financial-dark)]">
              <img
                src={slide.image}
                alt={slide.title}
                className="absolute inset-0 w-full h-full object-cover opacity-20"
              />
              <div className="relative z-10 h-full flex flex-col justify-center px-6 text-white">
                <h3 className="text-xl font-bold mb-2 text-balance">{slide.title}</h3>
                <p className="text-sm opacity-90 mb-4 text-pretty">{slide.subtitle}</p>
                <button className="w-fit px-4 py-2 text-sm font-medium bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-md transition-colors">
                  {slide.cta}
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* 轮播控制按钮 */}
        <button
          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/20 hover:bg-black/40 text-white rounded-md transition-colors flex items-center justify-center"
          onClick={prevSlide}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/20 hover:bg-black/40 text-white rounded-md transition-colors flex items-center justify-center"
          onClick={nextSlide}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* 轮播指示器 */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
          {carouselSlides.map((_, index) => (
            <button
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentSlide ? "bg-white" : "bg-white/40"
              }`}
              onClick={() => setCurrentSlide(index)}
            />
          ))}
        </div>
      </div>

      {/* 右侧APY推荐 */}
      <DotMatrixUFO />
    </div>
  )
}
