import { useState, useEffect, useCallback, useRef } from 'react'
import './DanmakuOverlay.css'

const TRACK_COUNT = 6

// Position presets: what percentage range of the chart height to use
const POSITION_MAP = {
  top20: { start: 2, range: 18 },
  top40: { start: 2, range: 38 },
  full: { start: 5, range: 85 },
}

// Speed multiplier (higher = slower)
const SPEED_MAP = {
  slow: 1.8,
  normal: 1.3,
  fast: 1,
}

// Font size map
const SIZE_MAP = {
  small: 12,
  medium: 14,
  large: 18,
}

let idCounter = 0

export default function DanmakuOverlay({
  enabled,
  messages: externalMessages,
  speed = 'normal',
  size = 'medium',
  position = 'top',
}) {
  const [bullets, setBullets] = useState([])
  const trackRef = useRef(Array(TRACK_COUNT).fill(null).map(() => ({ assignedAt: 0, estimatedClearTime: 0, textLength: 0 })))
  // 已經渲染過的訊息 ID，避免同一則訊息重複產生彈幕
  const processedIdsRef = useRef(new Set())

  const posConfig = POSITION_MAP[position] || POSITION_MAP.top
  const speedMult = SPEED_MAP[speed] || SPEED_MAP.normal
  const fontSize = SIZE_MAP[size] || SIZE_MAP.medium

  // Find the least recently used track with clearance check
  const getTrack = useCallback((textLength, isUserMessage = false) => {
    const now = Date.now()
    const clearTracks = []

    // Find tracks where the previous bullet has cleared the entry area
    for (let i = 0; i < TRACK_COUNT; i++) {
      const track = trackRef.current[i]
      if (now > track.estimatedClearTime) {
        clearTracks.push({ index: i, assignedAt: track.assignedAt })
      }
    }

    // If no clear track found: drop mock messages, force-assign user messages
    if (clearTracks.length === 0) {
      // Mock messages are dropped silently
      if (!isUserMessage) {
        return null
      }
      // User messages force-assign to the track with the soonest estimatedClearTime
      let soonestTrack = 0
      let soonestTime = Infinity
      for (let i = 0; i < TRACK_COUNT; i++) {
        if (trackRef.current[i].estimatedClearTime < soonestTime) {
          soonestTime = trackRef.current[i].estimatedClearTime
          soonestTrack = i
        }
      }
      // Update the track with the new assignment
      const duration = (8 + textLength * 0.12) * speedMult
      const estimatedClearTime = now + duration * 0.4 * 1000
      trackRef.current[soonestTrack] = { assignedAt: now, estimatedClearTime, textLength }
      return soonestTrack
    }

    // Among clear tracks, select the one with lowest assignedAt (LRU)
    clearTracks.sort((a, b) => a.assignedAt - b.assignedAt)
    const bestTrackIndex = clearTracks[0].index

    // Calculate duration and clearance time for the new bullet
    const duration = (8 + textLength * 0.12) * speedMult
    const estimatedClearTime = now + duration * 0.4 * 1000

    // Update the track info
    trackRef.current[bestTrackIndex] = { assignedAt: now, estimatedClearTime, textLength }

    return bestTrackIndex
  }, [speedMult])

  // Add a bullet
  const addBullet = useCallback((user, text, isUserMessage = false) => {
    const track = getTrack(text.length, isUserMessage)
    if (track === null) return // Skip if no clear track available (mock messages are dropped silently)

    const id = ++idCounter
    const baseDuration = 8 + text.length * 0.12
    const duration = baseDuration * speedMult

    setBullets((prev) => [
      ...prev,
      { id, user, text, track, duration },
    ])
  }, [getTrack, speedMult])

  // 渲染尚未處理過的外部訊息（唯一的彈幕來源）
  useEffect(() => {
    if (!enabled || !externalMessages || externalMessages.length === 0) return

    for (const msg of externalMessages) {
      if (processedIdsRef.current.has(msg.id)) continue
      processedIdsRef.current.add(msg.id)
      addBullet(msg.user, msg.text, true)
    }

    // 限制已處理 ID 集合大小，避免無限成長
    if (processedIdsRef.current.size > 200) {
      const ids = Array.from(processedIdsRef.current)
      processedIdsRef.current = new Set(ids.slice(-100))
    }
  }, [externalMessages, addBullet, enabled])

  // Remove bullet after animation ends
  const handleAnimationEnd = (id) => {
    setBullets((prev) => prev.filter((b) => b.id !== id))
  }

  if (!enabled) return null

  return (
    <div className="danmaku-overlay">
      {bullets.map((bullet) => {
        const topPercent =
          posConfig.start + (bullet.track / TRACK_COUNT) * posConfig.range
        return (
          <span
            key={bullet.id}
            className="danmaku-bullet"
            style={{
              top: `${topPercent}%`,
              animationDuration: `${bullet.duration}s`,
              fontSize: `${fontSize}px`,
            }}
            onAnimationEnd={() => handleAnimationEnd(bullet.id)}
          >
            <span className="danmaku-user">{bullet.user}</span>
            {bullet.text}
          </span>
        )
      })}
    </div>
  )
}
