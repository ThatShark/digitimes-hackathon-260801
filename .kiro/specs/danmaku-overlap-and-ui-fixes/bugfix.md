# Bugfix Requirements Document

## Introduction

This document addresses three UI bugs in the frontend application: (1) danmaku bullets overlapping due to inadequate track availability checking, (2) avatar button not positioned at the viewport's absolute top-right corner, and (3) the search bar placeholder text not changing contextually on the CoinTrendPage. These bugs degrade readability, visual polish, and user orientation.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN multiple danmaku bullets are assigned to the same track and the previous bullet has not yet scrolled off-screen THEN the system renders them overlapping at the same vertical position, making text unreadable

1.2 WHEN all 6 tracks are occupied by bullets still visible on screen AND a new mock/external message arrives THEN the system assigns the new bullet to the least-recently-used track regardless, causing overlap

1.3 WHEN the user sends a danmaku via the send button AND all tracks are occupied THEN the system may overlap the user's bullet with existing bullets (same defect as mock messages)

1.4 WHEN the Layout renders the avatar button THEN the system positions it inside the header bar with `padding: 12px 24px`, placing it relative to the content area rather than at the absolute top-right corner of the viewport

1.5 WHEN the user navigates to the CoinTrendPage (`/coin/:symbol`) THEN the search bar placeholder displays "搜尋幣種..." identical to all other pages, providing no contextual awareness

### Expected Behavior (Correct)

2.1 WHEN a new danmaku bullet is assigned to a track THEN the system SHALL verify the track is visually clear (previous bullet has scrolled far enough) before assigning, preventing any two bullets from overlapping on the same vertical position

2.2 WHEN all 6 tracks are occupied by bullets still visible on screen AND a new mock message arrives THEN the system SHALL drop/skip that message rather than rendering an overlapping bullet

2.3 WHEN the user sends a danmaku via the send button THEN the system SHALL ALWAYS display the user's bullet (never drop it), waiting for the next available track or using a priority mechanism to guarantee display

2.4 WHEN the Layout renders the avatar button THEN the system SHALL position the avatar circle at the absolute top-right corner of the entire viewport (fixed or absolute to viewport edge, ignoring header padding)

2.5 WHEN the user is on the CoinTrendPage (`/coin/:symbol`) THEN the search bar placeholder SHALL display "搜尋其他幣種..." to indicate the user is already viewing a specific coin

### Unchanged Behavior (Regression Prevention)

3.1 WHEN danmaku is enabled and tracks are available THEN the system SHALL CONTINUE TO assign bullets to tracks and animate them scrolling right-to-left across the chart area

3.2 WHEN danmaku is disabled THEN the system SHALL CONTINUE TO render nothing (return null)

3.3 WHEN the bullet animation ends THEN the system SHALL CONTINUE TO remove the bullet from the DOM via the onAnimationEnd callback

3.4 WHEN the user is on the MainPage (`/`) THEN the search bar placeholder SHALL CONTINUE TO display "搜尋幣種..."

3.5 WHEN the sidebar is toggled open/closed THEN the layout, header, and avatar SHALL CONTINUE TO respond to sidebar state transitions without breaking

3.6 WHEN the avatar button is clicked THEN the system SHALL CONTINUE TO trigger its existing click/title behavior ("設定 / 個人資料")

3.7 WHEN mock danmaku messages are generated at 2.5–4.5 second intervals THEN the system SHALL CONTINUE TO use the same timing and random message selection logic

3.8 WHEN the user sends a danmaku message via the send button THEN the system SHALL CONTINUE TO display it with the user label "我" and the provided text content
