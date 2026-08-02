/**
 * GET /coin/price — 對應 backend/api.yaml operationId getCoinPrice
 * GET /market/fear-greed — 對應 backend/api.yaml operationId getFearGreed
 * GET /market/overview — 對應 backend/api.yaml operationId getMarketOverview
 * GET /candlestick_chart — 對應 backend/api.yaml operationId getCandlestickChart
 * GET /notifications — 對應 backend/api.yaml operationId getNotifications
 */
import { apiFetch, isBackendConfigured } from './api'

/**
 * 取得單一幣種即時價格
 * @param {string} currency - 例如 'BTC'
 * @param {string} [quote] - 報價幣種，預設 TWD
 * @returns {Promise<{status, currency, market, last, buy, sell, open, high, low, vol, at}>}
 */
export function getCoinPrice(currency, quote = 'TWD') {
  const params = new URLSearchParams({ currency, quote })
  return apiFetch(`/coin/price?${params}`)
}

/**
 * 取得恐懼貪婪指數
 * @param {'latest'|'historical'} [mode]
 * @param {object} [opts] - { start, limit }（僅 historical 模式使用）
 */
export function getFearGreedIndex(mode = 'latest', opts = {}) {
  const params = new URLSearchParams({ mode, ...opts })
  return apiFetch(`/market/fear-greed?${params}`)
}

/**
 * 取得 K 線圖資料（含歷史買賣標記）
 * @param {string} currency
 * @param {number} start - Unix timestamp（秒）
 * @param {number} end - Unix timestamp（秒）
 * @param {'1d'|'1M'|'1Y'} [interval]
 */
export function getCandlestickChart(currency, start, end, interval = '1M') {
  const params = new URLSearchParams({
    currency,
    start: String(start),
    end: String(end),
    interval,
  })
  // start/end 幾乎每次都不同（拖動進度條、輪詢），快取命中率低又要求即時性，
  // 直接跳過全域快取，見 services/api.js 的 skipCache 說明。
  return apiFetch(`/candlestick_chart?${params}`, { skipCache: true })
}

/**
 * 取得行情看板資料（恐懼貪婪指數、BTC 佔比、全球市值、24H 成交量、漲跌幅榜）
 * @param {number} [topN] - 漲幅榜/跌幅榜各回傳幾筆，預設 3
 */
export function getMarketOverview(topN = 3) {
  const params = new URLSearchParams({ top_n: String(topN) })
  return apiFetch(`/market/overview?${params}`)
}

/**
 * 取得動態通知（漲跌幅異動、恐懼貪婪指數、巨鯨警報、社群討論量等）
 * @param {object} [opts]
 * @param {number} [opts.priceChangeThreshold] - 觸發 price_mover 通知的漲跌幅門檻（%），預設 10
 * @param {number} [opts.limit] - 最多回傳幾筆通知，預設 8
 * @returns {Promise<{status, notifications: Array<{id, type, icon, text, created_at}>}>}
 */
export function getNotifications({ priceChangeThreshold, limit } = {}) {
  const params = new URLSearchParams()
  if (priceChangeThreshold != null) params.set('price_change_threshold', String(priceChangeThreshold))
  if (limit != null) params.set('limit', String(limit))
  const query = params.toString()
  return apiFetch(`/notifications${query ? `?${query}` : ''}`)
}

/**
 * 嘗試向後端取得單一幣種的即時價格 + 24h 漲跌幅。
 * 後端未設定（VITE_API_BASE_URL 未填）或請求失敗時回傳 null，
 * 讓呼叫端可以 fallback 回 mock 資料或顯示「載入中」，不會讓畫面掛掉。
 *
 * MainPage（幣種卡片）與 CoinTrendPage（幣種頁上方數字）共用這個函式，
 * 確保兩處的即時價格資料來源一致。
 *
 * @param {string} symbol - 例如 'BTC'
 * @returns {Promise<{symbol: string, price: number, change: number} | null>}
 */
export async function fetchLivePriceInfo(symbol) {
  if (!isBackendConfigured()) return null
  try {
    const data = await getCoinPrice(symbol)
    const change = data.open ? ((data.last - data.open) / data.open) * 100 : 0
    return {
      symbol,
      price: data.last,
      change: Math.round(change * 10) / 10,
    }
  } catch {
    return null
  }
}

/**
 * 取得深度圖（訂單簿）資料
 * @param {string} currency - 例如 'BTC'
 * @param {number} [limit] - 每邊幾檔，預設 20
 * @returns {Promise<{bids: Array<[price, volume]>, asks: Array<[price, volume]>}>}
 */
export function getOrderBook(currency, limit = 20) {
  const params = new URLSearchParams({ currency, limit: String(limit) })
  return apiFetch(`/market/depth?${params}`)
}

/**
 * 取得最新成交明細
 * @param {string} currency - 例如 'BTC'
 * @param {number} [limit] - 幾筆，預設 20
 * @returns {Promise<{trades: Array<{price, volume, side, timestamp}>}>}
 */
export function getRecentTrades(currency, limit = 20) {
  const params = new URLSearchParams({ currency, limit: String(limit) })
  return apiFetch(`/market/trades?${params}`)
}

/**
 * 取得資金流向分析（特大單/大單/中單/小單分類 + 近 7 日淨資金流向）
 * 資料來自 MAX 真實成交紀錄與 K 線，不是假數據。
 * @param {string} currency - 例如 'BTC'
 * @param {'5m'|'1h'|'4h'|'1d'} [period] - 分類成交紀錄時往回抓多久，預設 '1h'
 * @returns {Promise<{status, period, buckets, net_inflow, trade_count, daily_net_flow}>}
 */
export function getFundFlow(currency, period = '1h') {
  const params = new URLSearchParams({ currency, period })
  return apiFetch(`/market/fund_flow?${params}`)
}

/**
 * 取得使用者可用台幣餘額
 * @param {string} [userId] - 使用者 ID
 * @returns {Promise<{status: string, twd_balance: number}>}
 */
export function getBalance(userId = 'default_user') {
  const params = new URLSearchParams({ user_id: userId })
  return apiFetch(`/balance?${params}`)
}

/**
 * AI 智慧推薦策略參數（呼叫 Bedrock）
 * @param {string} strategyType - grid | dca | martingale | arbitrage | basket | signal
 * @param {string} symbol - 幣種如 'BTC'
 * @param {string} [userId] - 使用者 ID
 * @returns {Promise<{status: string, params: object}>}
 */
export function getAiStrategyParams(strategyType, symbol, userId = 'default_user') {
  return apiFetch('/ai_strategy', {
    method: 'POST',
    body: { strategy_type: strategyType, symbol, user_id: userId },
    skipCache: true,
    timeoutMs: 60000,
  })
}
