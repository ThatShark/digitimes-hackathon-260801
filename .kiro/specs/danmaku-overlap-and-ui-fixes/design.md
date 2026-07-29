# Danmaku Overlap & UI Fixes — Bugfix Design

## Overview

This design addresses three UI bugs: (1) danmaku bullets overlapping because `getTrack()` uses LRU timestamps without checking visual clearance, (2) the avatar button positioned relative to the header instead of the viewport's absolute top-right corner, and (3) the search bar placeholder not changing contextually on the CoinTrendPage. The fix approach introduces track clearance estimation with content deduplication for danmaku, CSS `position: fixed` for the avatar, and a route-aware `placeholder` prop for SearchBar.

## Glossary

- **Bug_Condition (C)**: The set of conditions under which each bug manifests — track overlap on assignment, avatar misplacement, or incorrect placeholder text
- **Property (P)**: The desired correct behavior — no visual overlap, viewport-fixed avatar, contextual placeholder
- **Preservation**: Existing behaviors that must remain unchanged — danmaku animation, sidebar toggle, mouse interactions, mock message timing
- **`getTrack()`**: The function in `DanmakuOverlay.jsx` that selects which of the 6 vertical tracks to assign a new bullet to
- **`trackRef`**: A ref holding per-track timestamps, currently used for LRU selection
- **Clearance time**: The estimated time after which a bullet on a given track has scrolled far enough past the entry point that a new bullet can safely enter without overlapping

## Bug Details

### Bug Condition

The bugs manifest in three independent scenarios:

1. **Danmaku overlap**: When a new bullet is assigned to a track where the previous bullet has not yet scrolled far enough to clear the entry area, causing two bullets to visually overlap on the same vertical position.
2. **Avatar position**: When the Layout renders, the avatar button is positioned inside `.layout-header` with `padding: 12px 24px`, placing it relative to the header content flow rather than at the viewport's absolute top-right corner.
3. **SearchBar placeholder**: When the user navigates to `/coin/:symbol`, the placeholder remains "搜尋幣種..." instead of changing to "搜尋其他幣種..." to reflect the current context.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { bugType: 'danmaku' | 'avatar' | 'placeholder', context: Object }
  OUTPUT: boolean

  IF input.bugType == 'danmaku' THEN
    RETURN input.context.trackAssigned == true
           AND input.context.previousBulletOnTrack != null
           AND input.context.previousBulletElapsedTime < input.context.estimatedClearanceTime
  END IF

  IF input.bugType == 'avatar' THEN
    RETURN input.context.avatarPosition != 'fixed'
           OR input.context.avatarTop != '12px'
           OR input.context.avatarRight != '12px'
  END IF

  IF input.bugType == 'placeholder' THEN
    RETURN input.context.currentRoute MATCHES '/coin/:symbol'
           AND input.context.placeholderText == '搜尋幣種...'
  END IF

  RETURN false
END FUNCTION
```

### Examples

- **Danmaku overlap**: User sends "BTC 要起飛了" while a mock message "剛剛進場 SOL" is still within the first 30% of its scroll on track 2. The LRU algorithm picks track 2 (oldest timestamp), causing both bullets to overlap visually.
- **Danmaku all tracks full**: 6 mock messages fire in rapid succession (initial burst of 3 + timer). All 6 tracks have bullets still visible. The 7th message gets assigned to the LRU track, overlapping with an existing bullet.
- **Avatar**: On a 1920×1080 viewport with sidebar open, the avatar sits at `right: 24px` relative to header content area (offset by sidebar width), not at the viewport's absolute right edge.
- **Placeholder**: User clicks a coin card on MainPage, navigates to `/coin/BTC`. The search bar still shows "搜尋幣種..." instead of "搜尋其他幣種...".

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Danmaku bullets continue to animate right-to-left using CSS `@keyframes danmaku-scroll`
- When danmaku is disabled, the overlay returns `null`
- Bullets are removed from DOM via `onAnimationEnd` callback
- Mock messages continue to fire at 2.5–4.5 second intervals with the same random selection logic
- User-sent danmaku continues to display with user label "我" and the provided text
- Mouse clicks and chart interactions beneath the overlay continue to work (`pointer-events: none`)
- Sidebar toggle continues to work and layout responds to collapsed state
- Avatar button click/title behavior ("設定 / 個人資料") remains unchanged
- On MainPage (`/`), search bar placeholder remains "搜尋幣種..."

**Scope:**
All inputs that do NOT involve the three bug conditions should be completely unaffected by this fix. This includes:
- Danmaku rendering when tracks are genuinely clear
- Avatar hover and click interactions
- SearchBar styling, focus behavior, and input functionality
- Chart controls (interval change, danmaku toggle, settings popover)
- DanmakuOverlay speed/size/position configuration

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Danmaku Overlap — No clearance check in `getTrack()`**: The current implementation only tracks when a track was last assigned (LRU timestamp) but never estimates whether the previous bullet has scrolled far enough. The `trackRef` stores assignment time but doesn't account for bullet width/duration. Additionally, there is no deduplication logic — identical mock messages can fire in rapid succession.

2. **Danmaku Overlap — No drop/queue mechanism**: When all 6 tracks are occupied, the system has no fallback behavior. It always assigns to the LRU track regardless of visual clearance. There's no distinction between mock messages (droppable) and user messages (must display).

3. **Avatar Position — CSS relative to header flow**: The `.avatar-btn` has no explicit positioning. It sits in the normal flex flow of `.layout-header`, which means its position shifts with sidebar state and header padding. It needs `position: fixed` to break out of the flow.

4. **SearchBar Placeholder — No prop or route awareness**: `SearchBar` has a hardcoded placeholder string `"搜尋幣種..."`. The component accepts no props, and `Layout.jsx` has no route detection logic via `useLocation()`.

## Correctness Properties

Property 1: Bug Condition - Danmaku Track Clearance

_For any_ new bullet assignment where a previous bullet exists on the selected track and has not scrolled past the clearance threshold, the fixed `getTrack()` function SHALL either select a different clear track, drop the message (if mock), or queue/force-assign to the soonest-clearing track (if user message), preventing visual overlap.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Existing Danmaku and UI Behavior

_For any_ input where all tracks have sufficient clearance (no overlap condition), or where the input is unrelated to the three bugs (mouse clicks, chart interactions, sidebar toggle, disabled danmaku, MainPage placeholder), the fixed code SHALL produce exactly the same behavior as the original code, preserving animation timing, DOM cleanup, mock message scheduling, and layout responsiveness.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `frontend/src/components/shared/DanmakuOverlay.jsx`

**Function**: `getTrack()` → refactored to `getTrack(textLength, isUserMessage)`

**Specific Changes**:

1. **Track clearance estimation**: Replace simple LRU timestamp with a clearance time model. Store `{ assignedAt, estimatedClearTime }` per track. `estimatedClearTime = assignedAt + (charWidth * textLength + viewportWidth) / scrollSpeed` (approximated from animation duration). Before assigning, check if `Date.now() > track.estimatedClearTime`.

2. **Drop logic for mock messages**: If no track is clear and the message is a mock message, skip/drop it entirely. Return `null` from `getTrack()` and guard `addBullet()` accordingly.

3. **Force-assign for user messages**: If no track is clear and the message is from the user, pick the track with the soonest `estimatedClearTime` (best available) to guarantee display.

4. **Content deduplication**: Maintain a sliding window (Set or array) of recent bullet texts (last N messages or last T seconds). Before adding a mock message, check if its text is already in the window. If duplicate, skip.

5. **`addBullet` signature update**: Pass `isUserMessage` flag to distinguish mock vs user messages for drop/force logic.

---

**File**: `frontend/src/components/layout/Layout.css`

**Changes**:

1. **Avatar fixed positioning**: Add `position: fixed; top: 12px; right: 12px; z-index: 100;` to `.avatar-btn`. Remove it from the header flex flow.

---

**File**: `frontend/src/components/layout/Layout.jsx`

**Changes**:

1. **Move avatar outside header**: Move the `<button className="avatar-btn">` element outside of `.layout-header` (or keep it inside but rely on `position: fixed` to break out of flow).
2. **Import `useLocation`**: Add `import { Outlet, useLocation } from 'react-router-dom'`.
3. **Detect coin route**: Use `useLocation()` to check if pathname matches `/coin/` prefix.
4. **Pass placeholder prop**: Pass `placeholder="搜尋其他幣種..."` to `<SearchBar>` when on coin route, otherwise pass `"搜尋幣種..."`.

---

**File**: `frontend/src/components/layout/SearchBar.jsx`

**Changes**:

1. **Accept placeholder prop**: Change function signature to `SearchBar({ placeholder = '搜尋幣種...' })`.
2. **Use prop in input**: Replace hardcoded placeholder string with the prop value.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests that simulate rapid bullet assignment and assert no two active bullets share the same track within clearance time. Test avatar computed position and placeholder text on different routes. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Rapid fire overlap test**: Add 7 bullets in < 500ms, assert no two active bullets on the same track are within clearance distance (will fail on unfixed code)
2. **All tracks full — mock drop test**: Fill all 6 tracks, add another mock message, assert it is dropped (will fail on unfixed code — currently assigns anyway)
3. **All tracks full — user message test**: Fill all 6 tracks, send user message, assert it still displays (will fail on unfixed code if overlap is the only option)
4. **Avatar position test**: Render Layout, assert `.avatar-btn` has `position: fixed` and `right: 12px` (will fail on unfixed code)
5. **Placeholder route test**: Render Layout at `/coin/BTC`, assert SearchBar placeholder is "搜尋其他幣種..." (will fail on unfixed code)

**Expected Counterexamples**:
- Multiple bullets rendered at the same `top` percentage within overlapping time windows
- Avatar `right` value offset by sidebar width and header padding instead of fixed to viewport
- Placeholder text always "搜尋幣種..." regardless of route

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed functions produce the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  IF input.bugType == 'danmaku' AND input.isUserMessage == false THEN
    result := addBullet_fixed(input)
    ASSERT result == null (dropped) OR noOverlapOnAssignedTrack(result)
  END IF
  IF input.bugType == 'danmaku' AND input.isUserMessage == true THEN
    result := addBullet_fixed(input)
    ASSERT result != null AND bulletIsDisplayed(result)
  END IF
  IF input.bugType == 'avatar' THEN
    ASSERT computedStyle(avatarBtn).position == 'fixed'
    ASSERT computedStyle(avatarBtn).right == '12px'
    ASSERT computedStyle(avatarBtn).top == '12px'
  END IF
  IF input.bugType == 'placeholder' THEN
    ASSERT searchBarPlaceholder == '搜尋其他幣種...'
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed functions produce the same result as the original functions.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalBehavior(input) == fixedBehavior(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (various track states, text lengths, timing intervals)
- It catches edge cases that manual unit tests might miss (boundary conditions on clearance time)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for scenarios where tracks are clear, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Clear track assignment preservation**: When tracks are available, bullets are still assigned using a reasonable distribution (no starvation of tracks)
2. **Animation duration preservation**: Bullet animation duration still scales with text length × speed multiplier
3. **Mock timer preservation**: Mock messages continue to fire at 2.5–4.5s intervals
4. **Sidebar toggle preservation**: Avatar remains visible and clickable after sidebar toggle
5. **MainPage placeholder preservation**: On `/` route, placeholder remains "搜尋幣種..."
6. **DanmakuOverlay disabled preservation**: When `enabled=false`, component returns `null`

### Unit Tests

- Test `getTrack()` returns a clear track when one is available
- Test `getTrack()` returns `null` for mock messages when all tracks occupied
- Test `getTrack()` returns best-available track for user messages when all tracks occupied
- Test content deduplication skips duplicate mock messages within the sliding window
- Test content deduplication does NOT skip user messages even if duplicate
- Test SearchBar renders with default placeholder when no prop passed
- Test SearchBar renders with custom placeholder when prop is provided
- Test avatar has fixed positioning styles applied

### Property-Based Tests

- Generate random sequences of bullet additions with varying text lengths and timing, verify no two active bullets on the same track overlap within clearance window
- Generate random track states and verify user messages are never dropped
- Generate random route paths and verify placeholder text matches expected value for each route pattern
- Generate random sidebar states and verify avatar position remains fixed at viewport top-right

### Integration Tests

- Test full CoinTrendPage render with danmaku enabled: verify no visible overlap after 10 seconds of mock messages
- Test navigation from MainPage to CoinTrendPage: verify placeholder text changes
- Test navigation from CoinTrendPage back to MainPage: verify placeholder reverts
- Test Layout with sidebar collapsed and expanded: verify avatar stays at viewport top-right in both states
- Test user sending danmaku when all tracks are full: verify the message eventually displays
