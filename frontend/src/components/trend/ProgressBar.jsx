import { useState, useRef, useEffect, useCallback } from 'react'
import './ProgressBar.css'

// Format timestamp to MM/DD HH:mm
function formatTime(ts) {
  const d = new Date(ts * 1000)
  const M = d.getMonth() + 1
  const D = d.getDate()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${M}/${D} ${h}:${m}`
}

// Format timestamp to short label
function formatShort(ts) {
  const d = new Date(ts * 1000)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function ProgressBar({
  dataFrom,     // earliest timestamp in data
  dataTo,       // latest timestamp in data (now)
  visibleFrom,  // current chart visible start (0-1 fraction of data range)
  visibleTo,    // current chart visible end (0-1 fraction of data range)
  onRangeCommit, // called with (fromFraction, toFraction) when user RELEASES the handle
}) {
  const trackRef = useRef(null)
  const [dragging, setDragging] = useState(null) // 'left' | 'right' | null
  const [localLeft, setLocalLeft] = useState(visibleFrom)
  const [localRight, setLocalRight] = useState(visibleTo)

  // Sync local state with props when not dragging
  useEffect(() => {
    if (!dragging) {
      setLocalLeft(visibleFrom)
      setLocalRight(visibleTo)
    }
  }, [visibleFrom, visibleTo, dragging])

  const getPositionFromEvent = useCallback((e) => {
    if (!trackRef.current) return 0
    const rect = trackRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }, [])

  // Mouse/touch move during drag — only update local visual state
  useEffect(() => {
    if (!dragging) return

    const handleMove = (e) => {
      const pos = getPositionFromEvent(e)
      if (dragging === 'left') {
        setLocalLeft(Math.min(pos, localRight - 0.02))
      } else {
        setLocalRight(Math.max(pos, localLeft + 0.02))
      }
    }

    const handleUp = () => {
      // Commit the change to the chart only on release
      if (onRangeCommit) {
        onRangeCommit(localLeft, localRight)
      }
      setDragging(null)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    document.addEventListener('touchmove', handleMove)
    document.addEventListener('touchend', handleUp)

    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('touchend', handleUp)
    }
  }, [dragging, localLeft, localRight, getPositionFromEvent, onRangeCommit])

  const handleDragStart = (which) => (e) => {
    e.preventDefault()
    setDragging(which)
  }

  // Calculate timestamps for tooltips
  const totalSpan = (dataTo || 0) - (dataFrom || 0)
  const leftTime = (dataFrom || 0) + totalSpan * localLeft
  const rightTime = (dataFrom || 0) + totalSpan * localRight

  const leftPercent = Math.round(localLeft * 100)
  const rightPercent = Math.round(localRight * 100)

  return (
    <div className="progress-bar-v2">
      <span className="progress-label">{dataFrom ? formatShort(dataFrom) : '—'}</span>

      <div className="progress-track-v2" ref={trackRef}>
        {/* Filled area between handles */}
        <div
          className="progress-range"
          style={{ left: `${leftPercent}%`, right: `${100 - rightPercent}%` }}
        />

        {/* Left handle */}
        <div
          className={`progress-handle-v2 handle-left ${dragging === 'left' ? 'dragging' : ''}`}
          style={{ left: `${leftPercent}%` }}
          onMouseDown={handleDragStart('left')}
          onTouchStart={handleDragStart('left')}
        >
          {dragging === 'left' && (
            <div className="handle-tooltip">{formatTime(leftTime)}</div>
          )}
        </div>

        {/* Right handle */}
        <div
          className={`progress-handle-v2 handle-right ${dragging === 'right' ? 'dragging' : ''}`}
          style={{ left: `${rightPercent}%` }}
          onMouseDown={handleDragStart('right')}
          onTouchStart={handleDragStart('right')}
        >
          {dragging === 'right' && (
            <div className="handle-tooltip">{formatTime(rightTime)}</div>
          )}
        </div>
      </div>

      <span className="progress-label">{dataTo ? formatShort(dataTo) : '—'}</span>
    </div>
  )
}
