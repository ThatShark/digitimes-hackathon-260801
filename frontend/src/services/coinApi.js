/**
 * GET /coin/price — 對應 backend/api.yaml operationId getCoinPrice
 * GET /market/fear-greed — 對應 backend/api.yaml operationId getFearGreed
 * GET /candlestick_chart — 對應 backend/api.yaml operationId getCandlestickChart
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
  return apiFetch(`/candlestick_chart?${params}`)
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
