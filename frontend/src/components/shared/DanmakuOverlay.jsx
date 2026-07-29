import { useState, useEffect, useCallback, useRef } from 'react'
import './DanmakuOverlay.css'

const TRACK_COUNT = 6
const MOCK_MESSAGES = [
  { user: '安保計追', text: 'BTC 要起飛了吧' },
  { user: '熱冒渾逆', text: '剛剛進場 SOL' },
  { user: '安保計追', text: '恐懼指數 35，可以買？' },
  { user: '熱冒計逆', text: '我覺得再等等比較好' },
  { user: '安冒渾追', text: '這波多頭不會那麼快結束' },
  { user: '熱保計追', text: '停損設好就不怕' },
  { user: '安冒計逆', text: 'ETH 看起來要突破了' },
  { user: '熱保渾追', text: '大家小心槓桿' },
  { user: '熱冒計追', text: '剛獲利了結一半' },
  { user: '安保渾逆', text: '穩定幣先放著觀望' },
]

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
  const mockTimerRef = useRef(null)
  const recentTextsRef = useRef([])

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
    // Content deduplication — skip duplicate mock messages
    if (!isUserMessage) {
      if (recentTextsRef.current.includes(text)) {
        return // Skip duplicate mock message
      }
    }

    // Add text to recent window (for both user and mock, to track what's been shown)
    recentTextsRef.current.push(text)
    if (recentTextsRef.current.length > 5) {
      recentTextsRef.current.shift() // Keep only last 5
    }

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

  // Handle external messages (from send button)
  useEffect(() => {
    if (externalMessages && externalMessages.length > 0) {
      const latest = externalMessages[externalMessages.length - 1]
      addBullet(latest.user, latest.text, true)
    }
  }, [externalMessages, addBullet])

  // Mock message simulator
  useEffect(() => {
    if (!enabled) return

    const sendMock = () => {
      const msg = MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)]
      addBullet(msg.user, msg.text)
    }

    sendMock()
    setTimeout(sendMock, 600)
    setTimeout(sendMock, 1400)

    mockTimerRef.current = window.setInterval(() => {
      sendMock()
    }, 2500 + Math.random() * 2000)

    return () => {
      if (mockTimerRef.current) {
        clearInterval(mockTimerRef.current)
      }
    }
  }, [enabled, addBullet])

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
