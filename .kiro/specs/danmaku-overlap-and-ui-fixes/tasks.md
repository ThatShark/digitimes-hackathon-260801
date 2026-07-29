# Implementation Plan

- [x] 1. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Danmaku & UI Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `getTrack()` assigns bullets to tracks in LRU order when tracks are clear
  - Observe: Bullet animation duration = `(8 + text.length * 0.12) * speedMult`
  - Observe: Mock messages fire at 2.5–4.5s intervals via `setInterval`
  - Observe: `DanmakuOverlay` returns `null` when `enabled=false`
  - Observe: SearchBar renders with placeholder "搜尋幣種..." (default)
  - Observe: Avatar button renders with title "設定 / 個人資料"
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Verify tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 2. Fix for Danmaku overlap — refactor track assignment with clearance logic

  - [x] 2.1 Refactor `getTrack()` to include clearance time estimation
    - Replace `trackRef` from simple timestamps to `{ assignedAt, estimatedClearTime, textLength }` per track
    - Calculate `estimatedClearTime = assignedAt + duration * 0.4 * 1000` (40% of animation = entry clearance)
    - Before assigning, check `Date.now() > track.estimatedClearTime` for each track
    - Select the first clear track; if multiple clear, use LRU among them
    - _Bug_Condition: isBugCondition(input) where previousBulletElapsedTime < estimatedClearanceTime_
    - _Expected_Behavior: No two bullets overlap on same track within clearance window_
    - _Preservation: When tracks are genuinely clear, assignment still distributes evenly (LRU among clear tracks)_
    - _Requirements: 2.1_

  - [x] 2.2 Add drop logic for mock messages when all tracks are full
    - If no track has `Date.now() > estimatedClearTime` AND message is mock → return `null` from `getTrack()`
    - Guard `addBullet()` to skip when `getTrack()` returns `null`
    - _Bug_Condition: All 6 tracks occupied AND message is mock_
    - _Expected_Behavior: Mock message is dropped silently, no overlap rendered_
    - _Requirements: 2.2_

  - [x] 2.3 Add force-assign for user messages (never drop)
    - If no track is clear AND message is from user → pick the track with soonest `estimatedClearTime`
    - User messages always display (guarantee via force-assign to best-available track)
    - _Bug_Condition: All 6 tracks occupied AND message is from user_
    - _Expected_Behavior: User message is always displayed on the soonest-clearing track_
    - _Requirements: 2.3_

  - [x] 2.4 Add content deduplication (sliding window of recent texts)
    - Maintain a `Set` or array of last 5 bullet texts (sliding window)
    - Before adding a mock message, check if text is already in the recent window
    - If duplicate mock → skip. User messages bypass deduplication check
    - _Preservation: User messages are never deduplicated_
    - _Requirements: 2.1, 2.2_

  - [x] 2.5 Update `addBullet` signature to distinguish user vs mock messages
    - Change signature to `addBullet(user, text, isUserMessage = false)`
    - Pass `isUserMessage: true` from the external messages effect (user-sent danmaku)
    - Pass `isUserMessage: false` from mock message simulator
    - Pass `isUserMessage` and `text.length` to `getTrack()` for drop/force logic
    - _Requirements: 2.2, 2.3_

  - [x] 2.6 Verify preservation tests still pass after danmaku fix
    - **Property 2: Preservation** - Danmaku Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - Run preservation tests to confirm no regressions in animation timing, mock scheduling, disabled state
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.7, 3.8_

- [x] 3. Fix for Avatar position — CSS fixed positioning

  - [x] 3.1 Update `.avatar-btn` CSS to use fixed positioning
    - Add `position: fixed; top: 12px; right: 12px; z-index: 100;` to `.avatar-btn` in `Layout.css`
    - Ensure it doesn't interfere with header flex flow (element remains in DOM but breaks out of flow)
    - _Bug_Condition: avatarPosition != 'fixed' OR avatarTop != '12px' OR avatarRight != '12px'_
    - _Expected_Behavior: Avatar renders at viewport top-right regardless of sidebar state_
    - _Preservation: Avatar click/title behavior unchanged, sidebar toggle unaffected_
    - _Requirements: 2.4, 3.5, 3.6_

- [x] 4. Fix for SearchBar placeholder — route-aware prop

  - [x] 4.1 Add `placeholder` prop to SearchBar component
    - Change `SearchBar()` to `SearchBar({ placeholder = '搜尋幣種...' })`
    - Replace hardcoded placeholder string in `<input>` with the prop value
    - File: `frontend/src/components/layout/SearchBar.jsx`
    - _Preservation: Default placeholder remains "搜尋幣種..." when no prop passed_
    - _Requirements: 2.5, 3.4_

  - [x] 4.2 Add route detection in Layout.jsx and pass placeholder
    - Import `useLocation` from `react-router-dom`
    - Use `useLocation()` to get current pathname
    - Detect if pathname starts with `/coin/` → pass `placeholder="搜尋其他幣種..."` to SearchBar
    - Otherwise pass default `"搜尋幣種..."`
    - File: `frontend/src/components/layout/Layout.jsx`
    - _Bug_Condition: currentRoute matches '/coin/:symbol' AND placeholderText == '搜尋幣種...'_
    - _Expected_Behavior: Placeholder shows "搜尋其他幣種..." on coin route_
    - _Requirements: 2.5, 3.4_

- [x] 5. Checkpoint — Ensure all tests pass
  - Run all preservation tests from task 1
  - Verify danmaku no longer overlaps with rapid mock message bursts
  - Verify avatar is fixed at viewport top-right in both sidebar states
  - Verify placeholder changes on `/coin/:symbol` route and reverts on `/`
  - Ensure all tests pass, ask the user if questions arise.
