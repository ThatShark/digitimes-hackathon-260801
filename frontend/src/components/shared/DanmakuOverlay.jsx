import { useState, useCallback, useRef, useImperativeHandle, forwardRef } from 'react'
import './DanmakuOverlay.css'

const TRACK_COUNT = 6
const MAX_BULLETS = 12 // 螢幕上同時最多顯示的彈幕數量
const POSITION_MAP = {
  top20: { start: 2, range: 18 },
  top40: { start: 2, range: 38 },
  full: { start: 5, range: 85 },
}
const SPEED_MAP = { slow: 1.8, normal: 1.3, fast: 1 }
const SIZE_MAP = { small: 12, medium: 14, large: 18 }

let idCounter = 0

/**
 * 彈幕飄動 Overlay
 * 父層透過 ref.addBullet(user, text) 新增彈幕。
 * 元件本身不監聽任何 props 來決定何時加彈幕。
 */
const DanmakuOverlay = forwardRef(function DanmakuOverlay(
  { speed = 'normal', size = 'medium', position = 'top' },
  ref
) {
  const [bullets, setBullets] = useState([])
  const trackRef = useRef(
    Array.from({ length: TRACK_COUNT }, () => ({ assignedAt: 0, estimatedClearTime: 0 }))
  )

  const posConfig = POSITION_MAP[position] || POSITION_MAP.top20
  const speedMult = SPEED_MAP[speed] || SPEED_MAP.normal
  const fontSize = SIZE_MAP[size] || SIZE_MAP.medium

  const getTrack = useCallback((textLength) => {
    const now = Date.now()
    const clear = []
    for (let i = 0; i < TRACK_COUNT; i++) {
      if (now > trackRef.current[i].estimatedClearTime) {
        clear.push({ i, at: trackRef.current[i].assignedAt })
      }
    }
    let chosen
    if (clear.length > 0) {
      clear.sort((a, b) => a.at - b.at)
      chosen = clear[0].i
    } else {
      // 所有軌道都忙碌，選最快結束的
      let best = 0, min = Infinity
      for (let i = 0; i < TRACK_COUNT; i++) {
        if (trackRef.current[i].estimatedClearTime < min) {
          min = trackRef.current[i].estimatedClearTime
          best = i
        }
      }
      chosen = best
    }
    const duration = (8 + textLength * 0.12) * speedMult
    trackRef.current[chosen] = { assignedAt: Date.now(), estimatedClearTime: Date.now() + duration * 400 }
    return chosen
  }, [speedMult])

  // 對外暴露 addBullet
  useImperativeHandle(ref, () => ({
    /**
     * @param {string} user - 發言者名稱
     * @param {string} text - 彈幕內容
     * @param {boolean} [priority=false] - 是否優先顯示（自己發的 = true）
     */
    addBullet(user, text, priority = false) {
      setBullets((prev) => {
        // 如果已達上限且非優先，丟棄
        if (prev.length >= MAX_BULLETS && !priority) return prev
        const track = getTrack(text.length)
        const duration = (8 + text.length * 0.12) * speedMult
        const newBullet = { id: ++idCounter, user, text, track, duration, priority }
        // 如果已達上限但是優先（自己發的），移除最舊的非優先彈幕
        if (prev.length >= MAX_BULLETS && priority) {
          const idx = prev.findIndex((b) => !b.priority)
          if (idx !== -1) {
            const trimmed = [...prev]
            trimmed.splice(idx, 1)
            return [...trimmed, newBullet]
          }
        }
        return [...prev, newBullet]
      })
    },
  }), [getTrack, speedMult])

  const handleAnimationEnd = (id) => {
    setBullets((prev) => prev.filter((b) => b.id !== id))
  }

  return (
    <div className="danmaku-overlay">
      {bullets.map((bullet) => {
        const topPct = posConfig.start + (bullet.track / TRACK_COUNT) * posConfig.range
        return (
          <span
            key={bullet.id}
            className="danmaku-bullet"
            style={{ top: `${topPct}%`, animationDuration: `${bullet.duration}s`, fontSize: `${fontSize}px` }}
            onAnimationEnd={() => handleAnimationEnd(bullet.id)}
          >
            <span className="danmaku-user">{bullet.user}</span>
            {bullet.text}
          </span>
        )
      })}
    </div>
  )
})

export default DanmakuOverlay
