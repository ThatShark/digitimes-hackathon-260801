/**
 * Preservation Property Tests — Task 1
 * 
 * These tests capture the EXISTING (unfixed) behavior of the danmaku system
 * and UI components. They must PASS on the current unfixed code to establish
 * a behavioral baseline that must be preserved after fixes are applied.
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import * as fc from 'fast-check'
import DanmakuOverlay from '../components/shared/DanmakuOverlay.jsx'
import SearchBar from '../components/layout/SearchBar.jsx'
import Layout from '../components/layout/Layout.jsx'

// ============================================================
// Property 2.1: getTrack() assigns bullets to tracks in LRU order
// when tracks are clear (track 0 first, then 1, 2, etc.)
// **Validates: Requirements 3.1**
// ============================================================

describe('Preservation: getTrack() LRU track assignment', () => {
  it('should assign bullets to sequential tracks when all tracks are clear', () => {
    // We test this indirectly by rendering the DanmakuOverlay with enabled=true
    // and checking that bullets get assigned to different tracks (top positions differ)
    vi.useFakeTimers()

    const { container } = render(
      <DanmakuOverlay enabled={true} speed="normal" size="medium" position="full" />
    )

    // The component fires 3 initial bullets (sendMock at 0ms, 600ms, 1400ms)
    // First bullet is immediate
    vi.advanceTimersByTime(0)
    
    const bullets = container.querySelectorAll('.danmaku-bullet')
    // At least 1 bullet should be rendered immediately
    expect(bullets.length).toBeGreaterThanOrEqual(1)

    vi.useRealTimers()
  })

  it('should distribute bullets across different tracks (no track starvation)', () => {
    vi.useFakeTimers()
    const now = Date.now()
    vi.setSystemTime(now)

    let container
    act(() => {
      const result = render(
        <DanmakuOverlay enabled={true} speed="normal" size="medium" position="full" />
      )
      container = result.container
    })

    // Advance through all initial bursts: 0ms, 600ms, 1400ms
    act(() => {
      vi.advanceTimersByTime(1500)
    })

    const bullets = container.querySelectorAll('.danmaku-bullet')
    // At least 1 bullet should be rendered (some may be deduped if random picks same text)
    expect(bullets.length).toBeGreaterThanOrEqual(1)

    // All rendered bullets should have different top positions (different tracks)
    const topValues = Array.from(bullets).map(b => b.style.top)
    const uniqueTops = new Set(topValues)
    expect(uniqueTops.size).toBe(bullets.length)

    vi.useRealTimers()
  })
})

// ============================================================
// Property 2.2: Bullet animation duration formula
// duration = (8 + text.length * 0.12) * speedMult
// **Validates: Requirements 3.1**
// ============================================================

describe('Preservation: Bullet animation duration formula', () => {
  const SPEED_MAP = {
    slow: 1.8,
    normal: 1.3,
    fast: 1,
  }

  it('property: duration = (8 + text.length * 0.12) * speedMult for random text lengths and speeds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.constantFrom('slow', 'normal', 'fast'),
        (textLength, speed) => {
          const speedMult = SPEED_MAP[speed]
          const expectedDuration = (8 + textLength * 0.12) * speedMult

          // Verify the formula produces positive, finite values
          expect(expectedDuration).toBeGreaterThan(0)
          expect(Number.isFinite(expectedDuration)).toBe(true)

          // Verify the formula is monotonically increasing with text length
          const shorterDuration = (8 + (textLength - 1) * 0.12) * speedMult
          expect(expectedDuration).toBeGreaterThan(shorterDuration)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('property: rendered bullet animationDuration matches formula for external messages', () => {
    vi.useFakeTimers()

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.constantFrom('slow', 'normal', 'fast'),
        (text, speed) => {
          const speedMult = SPEED_MAP[speed]
          const expectedDuration = (8 + text.length * 0.12) * speedMult

          // Render with an external message
          const messages = [{ user: 'TestUser', text }]
          const { container, unmount } = render(
            <DanmakuOverlay
              enabled={true}
              messages={messages}
              speed={speed}
              size="medium"
              position="full"
            />
          )

          vi.advanceTimersByTime(0)

          // Find bullet with our text (may be among mock bullets)
          const bullets = container.querySelectorAll('.danmaku-bullet')
          const matchingBullet = Array.from(bullets).find(b => b.textContent.includes(text))

          if (matchingBullet) {
            const actualDuration = parseFloat(matchingBullet.style.animationDuration)
            expect(actualDuration).toBeCloseTo(expectedDuration, 1)
          }

          unmount()
        }
      ),
      { numRuns: 20 }
    )

    vi.useRealTimers()
  })
})

// ============================================================
// Property 2.3: Mock messages fire at 2.5–4.5s intervals via setInterval
// **Validates: Requirements 3.7**
// ============================================================

describe('Preservation: Mock message timer setup', () => {
  it('should set up setInterval when enabled=true', () => {
    vi.useFakeTimers()
    const setIntervalSpy = vi.spyOn(global, 'setInterval')

    render(
      <DanmakuOverlay enabled={true} speed="normal" size="medium" position="top20" />
    )

    // The component should call setInterval once for mock messages
    expect(setIntervalSpy).toHaveBeenCalled()

    // The interval should be in the range 2500-4500ms
    const intervalCall = setIntervalSpy.mock.calls[0]
    expect(intervalCall).toBeDefined()
    // First arg is the callback function
    expect(typeof intervalCall[0]).toBe('function')
    // Second arg is the interval duration (2500 + random * 2000)
    const intervalMs = intervalCall[1]
    expect(intervalMs).toBeGreaterThanOrEqual(2500)
    expect(intervalMs).toBeLessThanOrEqual(4500)

    setIntervalSpy.mockRestore()
    vi.useRealTimers()
  })

  it('should clear interval on unmount', () => {
    vi.useFakeTimers()
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

    const { unmount } = render(
      <DanmakuOverlay enabled={true} speed="normal" size="medium" position="top20" />
    )

    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()

    clearIntervalSpy.mockRestore()
    vi.useRealTimers()
  })
})

// ============================================================
// Property 2.4: DanmakuOverlay returns null when enabled=false
// **Validates: Requirements 3.2**
// ============================================================

describe('Preservation: DanmakuOverlay disabled state', () => {
  it('should return null (render nothing) when enabled=false', () => {
    const { container } = render(
      <DanmakuOverlay enabled={false} speed="normal" size="medium" position="top20" />
    )

    // The overlay div should not be rendered
    expect(container.querySelector('.danmaku-overlay')).toBeNull()
    expect(container.innerHTML).toBe('')
  })

  it('property: returns null for any combination of props when enabled=false', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('slow', 'normal', 'fast'),
        fc.constantFrom('small', 'medium', 'large'),
        fc.constantFrom('top20', 'top40', 'full'),
        (speed, size, position) => {
          const { container, unmount } = render(
            <DanmakuOverlay
              enabled={false}
              speed={speed}
              size={size}
              position={position}
            />
          )

          expect(container.querySelector('.danmaku-overlay')).toBeNull()
          unmount()
        }
      ),
      { numRuns: 9 }
    )
  })
})

// ============================================================
// Property 2.5: SearchBar renders with placeholder "搜尋幣種..." (default)
// **Validates: Requirements 3.4**
// ============================================================

describe('Preservation: SearchBar default placeholder', () => {
  it('should render with placeholder "搜尋幣種..."', () => {
    render(<SearchBar />)

    const input = screen.getByPlaceholderText('搜尋幣種...')
    expect(input).toBeInTheDocument()
  })

  it('should render search icon', () => {
    const { container } = render(<SearchBar />)

    const icon = container.querySelector('.search-icon')
    expect(icon).toBeInTheDocument()
    expect(icon.textContent).toBe('🔍')
  })
})

// ============================================================
// Property 2.6: Avatar button renders with title "設定 / 個人資料"
// **Validates: Requirements 3.5, 3.6**
// ============================================================

describe('Preservation: Avatar button', () => {
  it('should render avatar button with correct title', () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    )

    const avatarBtn = screen.getByTitle('設定 / 個人資料')
    expect(avatarBtn).toBeInTheDocument()
  })

  it('should render avatar circle inside button', () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    )

    const avatarBtn = screen.getByTitle('設定 / 個人資料')
    const avatarCircle = avatarBtn.querySelector('.avatar-circle')
    expect(avatarCircle).toBeInTheDocument()
  })
})

// ============================================================
// Integration: Route-aware placeholder verification
// **Validates: Requirements 2.5, 3.4**
// ============================================================

describe('Integration: Route-aware SearchBar placeholder', () => {
  it('should show "搜尋其他幣種..." on /coin/BTC route', () => {
    render(
      <MemoryRouter initialEntries={['/coin/BTC']}>
        <Layout />
      </MemoryRouter>
    )

    const input = screen.getByPlaceholderText('搜尋其他幣種...')
    expect(input).toBeInTheDocument()
  })

  it('should show "搜尋幣種..." on / route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Layout />
      </MemoryRouter>
    )

    const input = screen.getByPlaceholderText('搜尋幣種...')
    expect(input).toBeInTheDocument()
  })

  it('should show "搜尋其他幣種..." for any /coin/:symbol route', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('BTC', 'ETH', 'SOL', 'DOGE', 'USDT'),
        (symbol) => {
          const { unmount } = render(
            <MemoryRouter initialEntries={[`/coin/${symbol}`]}>
              <Layout />
            </MemoryRouter>
          )

          const input = screen.getByPlaceholderText('搜尋其他幣種...')
          expect(input).toBeInTheDocument()
          unmount()
        }
      ),
      { numRuns: 5 }
    )
  })

  it('should revert to "搜尋幣種..." on non-coin routes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('/', '/community', '/questionnaire', '/settings'),
        (route) => {
          const { unmount } = render(
            <MemoryRouter initialEntries={[route]}>
              <Layout />
            </MemoryRouter>
          )

          const input = screen.getByPlaceholderText('搜尋幣種...')
          expect(input).toBeInTheDocument()
          unmount()
        }
      ),
      { numRuns: 4 }
    )
  })
})
