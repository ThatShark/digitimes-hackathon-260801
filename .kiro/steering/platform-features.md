# 交易平台功能對照表 — 適用性篩選

本文件列出完整虛擬貨幣交易平台的標準功能模組，並標註哪些適用於「智慧投資 L.I.V.E.」專案、哪些由 MAX 交易所本身負責。

---

## 篩選原則

我們是 **AI 投資助理工具**，串接 MAX 交易所 API，而非自建交易所。因此：
- ✅ 適用：可提升用戶體驗、與我們的 AI/社群核心相關的功能
- ⚠️ 部分適用：可簡化實作或作為展示加分項
- ❌ 不適用：屬於交易所基礎建設，由 MAX 負責

---

## 1. 用戶身份與安全管理

| 功能 | 適用性 | 說明 | 安置位置 |
|------|--------|------|----------|
| 註冊/登入 | ⚠️ 簡化版 | Demo 用簡易身份識別（CSV 上傳即建立 session） | `backend/src/handlers/init.py` |
| KYC 身分認證 | ❌ | MAX 交易所負責 | — |
| 2FA 多因素驗證 | ❌ | MAX 交易所負責 | — |
| 防釣魚碼 | ❌ | MAX 交易所負責 | — |
| API 金鑰管理 | ⚠️ 部分 | 用戶提供 MAX API Key 讓我們代理下單 | `backend/src/services/max_api.py` |
| 裝置管理/異常警報 | ❌ | 超出 scope | — |

---

## 2. 交易業務模組

### A. 現貨交易

| 功能 | 適用性 | 說明 | 安置位置 |
|------|--------|------|----------|
| 市價單 | ✅ | 透過 MAX Skill 執行 | `backend/src/handlers/allow_trade.py` |
| 限價單 | ✅ | 透過 MAX Skill 執行 | `backend/src/handlers/allow_trade.py` |
| 止盈止損單 (TP/SL) | ✅ 新增 | AI 可建議設定，前端顯示設定面板 | `frontend/src/components/trend/TradePanel.jsx` |
| OCO 組合單 | ⚠️ 展示 | 若 MAX API 支援則串接，否則 AI 模擬提醒 | `backend/src/handlers/allow_trade.py` |
| 法幣買幣 | ❌ | MAX 交易所負責 | — |
| P2P 交易 | ❌ | MAX 交易所負責 | — |

### B. 衍生品與槓桿

| 功能 | 適用性 | 說明 | 安置位置 |
|------|--------|------|----------|
| 槓桿/合約/期權 | ❌ | MAX 目前以現貨為主，超出 scope | — |
| 風險/強平機制 | ❌ | 交易所負責 | — |

---

## 3. 行情與分析圖表

| 功能 | 適用性 | 說明 | 安置位置 |
|------|--------|------|----------|
| K 線圖 (多時間週期) | ✅ 已有 | lightweight-charts，支援日/月/年 | `frontend/src/components/trend/KLineChart.jsx` |
| 技術指標 (MACD, RSI等) | ✅ 已有 | IndicatorPanel，預設關閉 | `frontend/src/components/trend/IndicatorPanel.jsx` |
| 深度圖 (Order Book) | ✅ 新增 | 串接 MAX API depth endpoint | `frontend/src/components/trend/DepthChart.jsx` |
| 最新成交明細 | ✅ 新增 | 串接 MAX API trades endpoint | `frontend/src/components/trend/RecentTrades.jsx` |
| 行情看板 (漲跌幅榜) | ✅ 新增 | 主頁面增加市場概覽區塊 | `frontend/src/components/main/MarketOverview.jsx` |
| 自選幣種 (Watchlist) | ✅ 新增 | 用戶可自定義關注清單 | `frontend/src/components/main/Watchlist.jsx` |
| 恐懼貪婪指數 | ✅ 已有 | CoinMarketCap API | `backend/src/services/coinmarketcap.py` |

---

## 4. 資產與錢包管理

| 功能 | 適用性 | 說明 | 安置位置 |
|------|--------|------|----------|
| 充值/提現 | ❌ | MAX 交易所負責 | — |
| 多鏈錢包 | ❌ | MAX 交易所負責 | — |
| 資產總覽 (持倉) | ✅ 新增 | 從 CSV 計算持倉 × MAX 即時價格 | `frontend/src/pages/ProfilePage.jsx` |
| 歷史帳單/損益 | ✅ 新增 | 從 CSV 計算，顯示在 Profile | `frontend/src/components/profile/TradeHistory.jsx` |
| 帳戶間劃轉 | ❌ | MAX 交易所負責 | — |

---

## 5. 理財與資產增值

| 功能 | 適用性 | 說明 | 安置位置 |
|------|--------|------|----------|
| Staking/Earn | ❌ | 超出 scope | — |
| 借貸 | ❌ | 超出 scope | — |
| 網格交易/量化機器人 | ⚠️ 概念 | AI 的買賣建議 = 簡化版量化策略 | `backend/src/handlers/ai_chat.py` |
| 定投計劃 (DCA) | ⚠️ 展示 | AI 可建議 DCA 策略，但不自動執行 | AI 對話建議 |
| Launchpad/IEO | ❌ | 超出 scope | — |

---

## 6. 技術核心

| 功能 | 適用性 | 說明 | 安置位置 |
|------|--------|------|----------|
| 撮合引擎 | ❌ | MAX 交易所負責 | — |
| 清算/風控 | ❌ | MAX 交易所負責 | — |
| 熱/冷錢包 | ❌ | MAX 交易所負責 | — |
| 多重簽名/MPC | ❌ | MAX 交易所負責 | — |

---

## 7. 客服與用戶運營

| 功能 | 適用性 | 說明 | 安置位置 |
|------|--------|------|----------|
| AI 聊天機器人 | ✅ 已有 | 我們的核心功能 — AI 投資助理 | `CustomerSupport/`, `AIChatPanel.jsx` |
| 公告/幫助中心 | ⚠️ 簡化 | 系統通知（新幣上架、市場異動） | `frontend/src/components/shared/NotificationBanner.jsx` |
| 邀請獎勵 (Referral) | ⚠️ 展示 | 社群擴散機制，邀請好友看人格分析 | `frontend/src/pages/ProfilePage.jsx` |
| VIP 體系 | ⚠️ 概念 | 人格系統 = 我們的社交身份系統 | 人格徽章即為 VIP 替代 |

---

## 8. 合規與後台

| 功能 | 適用性 | 說明 | 安置位置 |
|------|--------|------|----------|
| Proof of Reserves | ❌ | MAX 交易所負責 | — |
| 審計日誌 | ❌ | 超出 scope | — |
| 合規報表 | ❌ | 超出 scope | — |

---

## 篩選結果摘要

### ✅ 新增功能（建議實作）

| 功能 | 優先度 | 理由 |
|------|--------|------|
| 止盈止損單 (TP/SL) | P1 | 提升交易面板專業度，AI 可主動建議設定 |
| 深度圖 (Depth Chart) | P2 | 展示 MAX API 整合深度，評審加分 |
| 最新成交明細 | P2 | 直播頁面資訊完整度 |
| 行情看板 (Market Overview) | P1 | 主頁增加市場數據，非只有幣種卡片 |
| 自選清單 (Watchlist) | P1 | 用戶個人化，搭配推薦算法 |
| 資產總覽 (Portfolio) | P1 | Profile 頁核心數據，展示損益 |
| 交易歷史明細 | P1 | Profile 頁完整度 |
| 系統通知 | P2 | 市場異動推播，AI 提醒機制 |

### ⚠️ 可展示但簡化的功能

| 功能 | 展示方式 |
|------|----------|
| API Key 管理 | 設定頁面讓用戶輸入 MAX API Key |
| OCO 組合單 | AI 對話中建議，實際仍用 limit order |
| DCA 定投建議 | AI 對話中建議策略，不自動執行 |
| 邀請好友 | Profile 頁分享連結 |

### ❌ 不實作（MAX 交易所負責 or 超出 scope）

- KYC、2FA、防釣魚碼
- 法幣買幣、P2P
- 槓桿、合約、期權
- 充值、提現、多鏈錢包
- Staking、借貸、Launchpad
- 撮合引擎、清算、冷熱錢包
- Proof of Reserves、合規報表


---

## 9. 社群進階功能 (Social Trading & Community Tools)

### A. 實盤社交與一鍵跟單 (Social Copy Trading)

| 功能 | 適用性 | 說明 | 安置位置 |
|------|--------|------|----------|
| 實盤驗證標籤 (Verified PnL) | ✅ 新增 | CSV 上傳 = 實盤數據來源，系統自動計算真實績效並標記 | `frontend/src/components/community/VerifiedBadge.jsx`; `backend/src/services/personality.py` |
| 貼文即訂單 (Post-to-Trade) | ✅ 新增 | 帶有交易建議的貼文生成「跟隨此策略」按鈕，粉絲設定金額後透過 MAX Skill 下單 | `frontend/src/components/community/CopyTradeButton.jsx`; `backend/src/handlers/copy_trade.py` |
| KOL 綁定交易所 API | ⚠️ 簡化 | Demo 階段用 CSV 數據模擬，未來可擴展為 API 綁定 | `backend/src/handlers/init.py` |

### B. 嵌入式加密貨幣工具箱 (Embedded Crypto Tools)

| 功能 | 適用性 | 說明 | 安置位置 |
|------|--------|------|----------|
| 動態幣種 Tag ($Ticker) | ✅ 新增 | 貼文/聊天中輸入 $BTC 自動轉為互動卡片（即時價格、24H漲跌、迷你K線） | `frontend/src/components/community/TickerCard.jsx`; `frontend/src/hooks/useTickerData.js` |
| 巨鯨警報 Bot (Whale Alert) | ⚠️ 展示 | 模擬鏈上大額轉帳警報，於社群/彈幕播報，附「一鍵追買」按鈕 | `frontend/src/components/community/WhaleAlertCard.jsx`; `backend/src/handlers/whale_alert.py` |
| 社群 AI 情緒分析 | ✅ 新增 | AI 掃描社群發言，計算幣種「群友看多/看空比例」；自動生成討論摘要 | `backend/src/services/sentiment.py`; `frontend/src/components/community/SentimentGauge.jsx` |

### C. P2P 微型經濟系統 (Micro-Economy)

| 功能 | 適用性 | 說明 | 安置位置 |
|------|--------|------|----------|
| 微額打賞 (Tipping) | ⚠️ 展示 | Demo 用虛擬積分模擬打賞（非真實鏈上代幣），獎勵優質分析內容 | `frontend/src/components/community/TipButton.jsx`; `backend/src/handlers/tipping.py` |
| 付費懸賞提問 (P2P Q&A) | ⚠️ 展示 | 積分賞金制：新手附賞金提問，回答被採納後積分自動划轉 | `frontend/src/components/community/BountyQuestion.jsx`; `backend/src/handlers/bounty.py` |
| 真實鏈上代幣轉帳 | ❌ | 需要錢包基礎建設，超出 hackathon scope | — |

---

### 社群功能篩選結果

#### ✅ 建議實作

| 功能 | 優先度 | 理由 |
|------|--------|------|
| 實盤驗證標籤 | P1 | 與人格系統結合，CSV 數據即為「實盤證明」，天然優勢 |
| 貼文即訂單 (Copy Trade) | P1 | 展示 MAX Skill 整合深度 + 社群閉環，評審加分 |
| $Ticker 動態卡片 | P1 | 視覺亮點，串接 MAX API 展示即時數據整合 |
| 社群 AI 情緒分析 | P1 | 直接用 Bedrock 分析，展示 AI 深度整合 |

#### ⚠️ 可展示但簡化

| 功能 | 展示方式 |
|------|----------|
| 巨鯨警報 | Mock 數據模擬，定時隨機播報 |
| 打賞系統 | 虛擬積分，不涉及真實代幣 |
| 懸賞提問 | 積分制模擬，展示 UX 流程 |

#### ❌ 不實作

- 真實鏈上代幣打賞/轉帳（需錢包基建）
- KOL 真實 API 綁定驗證（Demo 用 CSV 代替）


---

## 10. 幣種詳情六大分頁系統 (Coin Detail Tabs)

CoinTrendPage 改為六大分頁架構，每個幣種頁面包含：

### Tab 1: 行情 (Charts & Market) ✅ 已實作

| 功能 | 狀態 | 安置位置 |
|------|------|----------|
| K 線圖 + 時間週期切換 | ✅ 已有 | `KLineChart.jsx` |
| 技術指標（VOL/MA/EMA/BOLL/SAR） | ✅ 已有 | `IndicatorPanel.jsx` |
| 深度圖 (累積面積圖 + hover + ratio bar) | ✅ 已有（真實 MAX 資料） | `DepthChart.jsx` + `backend/src/handlers/market_depth.py` |
| 最新成交明細 | ✅ 已有（真實 MAX 資料） | `RecentTrades.jsx` + `backend/src/handlers/market_trades.py` |
| 關鍵事件（鏈上大額轉帳 log） | ✅ 已有 | `KeyEvents.jsx` |
| 彈幕聊天 + AI 對話 | ✅ 已有 | `AIChatPanel.jsx` |
| 交易面板（市價/限價/TP-SL） | ✅ 已有 | `TradePanel.jsx` |

### Tab 2: 概況 (Overview) ✅ 已實作

| 功能 | 狀態 | 安置位置 |
|------|------|----------|
| 幣種基本數據（市值、流通量、排名等） | ✅ 已有 | `CoinOverview.jsx` |
| ATH / ATL 歷史價格 | ✅ 已有 | `CoinOverview.jsx` |
| 項目簡介 (About) | ✅ 已有 | `CoinOverview.jsx` |
| 標籤系統（主流幣 / Layer 1 等） | ✅ 已有 | `CoinOverview.jsx` |
| 交易規則（最小變動、精度、檔位表） | ❌ 未來 | — |
| 指數樣本（多交易所加權） | ❌ 未來 | — |

### Tab 3: 數據 (Data & Analytics) ✅ 已實作

| 功能 | 狀態 | 安置位置 |
|------|------|----------|
| 資金流向圓餅圖（特大/大/中/小單） | ✅ 已有（真實 MAX 成交資料，門檻分類見 `constants.py`） | `FundFlowChart.jsx` + `backend/src/handlers/market_fund_flow.py` |
| 淨資金流向柱狀圖（近 7 日） | ✅ 已有（K 線推算的近似值，非逐筆彙總，見 `fund_flow.py` docstring） | `FundFlowChart.jsx` + `backend/src/handlers/market_fund_flow.py` |
| 時間週期切換（5分/1H/4H/1日） | ✅ 已有（實際決定往回抓多久的成交紀錄） | `FundFlowChart.jsx` |
| 槓桿多空比曲線 | ❌ 未來 | — |
| 多空借幣量走勢 | ❌ 未來 | — |

### Tab 4: 動態 (Social & Feed) ✅ 已實作（復用 AIChatPanel）

| 功能 | 狀態 | 安置位置 |
|------|------|----------|
| AI 對話（全寬模式） | ✅ 已有 | `AIChatPanel.jsx` |
| 彈幕聊天室 | ✅ 已有 | `AIChatPanel.jsx` |
| AI 情緒分析摘要 | ⚠️ 未來整合 | `SentimentGauge.jsx` |
| KOL 社群貼文流 | ⚠️ 未來整合 | `PostCard.jsx` |

### Tab 5: 交易 (Trading & Products) ✅ 已實作

| 功能 | 狀態 | 安置位置 |
|------|------|----------|
| 現貨交易（市價/限價/TP-SL） | ✅ 已有 | `TradePanel.jsx` |
| 深度圖搭配下單 | ✅ 已有 | `DepthChart.jsx` |
| 永續合約 | ❌ MAX 不支援 | — |
| 期權 / 雙幣贏 | ❌ 超出 scope | — |
| 跟單交易（帶單交易員列表） | ⚠️ 未來 | — |

### Tab 6: 策略 (Trading Bots) ✅ 已實作

| 功能 | 狀態 | 安置位置 |
|------|------|----------|
| 策略建立入口（6 種類型卡片） | ✅ 已有 | `StrategyHub.jsx` |
| AI 網格模板推薦（短/中/長期） | ✅ 已有 | `StrategyHub.jsx` |
| 實盤賺取動態 | ✅ 已有 | `StrategyHub.jsx` |
| 策略回測工具 | ❌ 未來 | — |

### 全域功能

| 功能 | 狀態 | 安置位置 |
|------|------|----------|
| 分享按鈕（複製連結 / 長圖 / 社交分享） | ✅ 已有 | `ShareButton.jsx` |
| 自選收藏星星 | ⚠️ 已有 Watchlist | `Watchlist.jsx` |
| 即時新聞跑馬燈 | ✅ 已有 | `NotificationBanner.jsx` |
