import { useEffect, useRef } from 'react'
import { useTheme } from './api'

/** Static star field behind the app. Deterministic (seeded) so stars don't jump between renders. */
export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null)
  const theme = useTheme()

  useEffect(() => {
    const cv = ref.current!
    const draw = () => {
      const dpr = Math.min(2, devicePixelRatio || 1)
      const w = innerWidth, h = innerHeight
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
      const ctx = cv.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      // colours chosen from the theme value directly: this effect runs before App updates data-theme
      const star = theme === 'dark' ? '#ffffff' : '#2b3550'
      const accent = theme === 'dark' ? '#a9c7ff' : '#2f4fc4'
      const [aMin, aMax] = theme === 'dark' ? [0.25, 0.95] : [0.22, 0.6]
      let seed = 20261114
      const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
      const count = Math.round((w * h) / 5200)
      for (let i = 0; i < count; i++) {
        const x = rnd() * w, y = rnd() * h
        const big = rnd() < 0.04
        const r = big ? 1.1 + rnd() * 0.8 : 0.35 + rnd() * 0.7
        ctx.globalAlpha = aMin + rnd() * (aMax - aMin)
        ctx.fillStyle = rnd() < 0.08 ? accent : star
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
        if (big && theme === 'dark') {
          // faint diffraction cross on the brightest stars
          ctx.globalAlpha *= 0.35
          ctx.fillRect(x - r * 3, y - 0.25, r * 6, 0.5)
          ctx.fillRect(x - 0.25, y - r * 3, 0.5, r * 6)
        }
      }
      ctx.globalAlpha = 1
    }
    draw()
    addEventListener('resize', draw)
    return () => removeEventListener('resize', draw)
  }, [theme])

  return <canvas ref={ref} className="starfield" aria-hidden="true" />
}
