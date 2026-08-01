/**
 * GET /coin/price — 對應 backend/api.yaml operationId getCoinPrice
 * GET /market/fear-greed — 對應 backend/api.yaml operationId getFearGreed
 * GET /candlestick_chart — 對應 backend/api.yaml operationId getCandlestickChart
 */
import { apiFetch } from './api'

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
