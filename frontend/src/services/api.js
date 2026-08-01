/**
 * 基礎 API client — 所有 services/*.js 都透過這裡發送請求。
 *
 * 設定方式：
 *   在 frontend/.env（本地）或部署平台的環境變數設定：
 *     VITE_API_BASE_URL=https://xxxx.execute-api.ap-northeast-1.amazonaws.com/prod
 *   （複製 .env.example 為 .env 並填入趙文睿提供的 API Gateway Invoke URL）
 *
 * 若沒有設定 VITE_API_BASE_URL，apiFetch 會直接拋出 ApiError，
 * 讓呼叫端可以 fallback 回 mock 資料，不會讓整個頁面掛掉。
 */

import { getCacheEntry, setCacheEntry, getPendingRequest, setPendingRequest, clearPendingRequest } from './apiCache'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export class ApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/**
 * 送出一個 API 請求並回傳解析後的 JSON。
 *
 * GET 請求預設會套用 30 秒的全域快取（見 services/apiCache.js）：同一個
 * path（含 query string）在 30 秒內重複呼叫會直接回傳快取值，不會真正
 * 發送網路請求；跨頁面共享（MainPage 幣種卡片、CoinTrendPage 直播頁等
 * 只要打同一個幣種同一個 API，就只會有一份快取）。若同一瞬間有多處同時
 * 請求同一筆還沒回來的資料，只會真正發出一次網路請求，其餘呼叫者共用
 * 同一個 Promise。
 *
 * 需要跳過快取（例如未來要加「強制刷新」按鈕）時傳 `{ skipCache: true }`。
 * K 線圖（/candlestick_chart）等本來就要求即時性、參數幾乎每次都不同的
 * API，呼叫端也應該用 `skipCache: true`。
 *
 * @param {string} path - 例如 '/coin/price?currency=BTC'
 * @param {object} [options]
 * @param {'GET'|'POST'|'PUT'|'DELETE'} [options.method]
 * @param {object} [options.body] - 會自動 JSON.stringify
 * @param {object} [options.headers]
 * @param {number} [options.timeoutMs] - 預設 10 秒逾時
 * @param {boolean} [options.skipCache] - 跳過快取，強制發送真正的請求
 * @returns {Promise<any>}
 */
export async function apiFetch(path, options = {}) {
  if (!BASE_URL) {
    throw new ApiError(
      '尚未設定 VITE_API_BASE_URL，無法連接後端（目前使用 mock 資料）'
    )
  }

  const { method = 'GET', body, headers = {}, timeoutMs = 10000, rawBody = false, skipCache = false } = options
  const isCacheable = method === 'GET' && !skipCache

  if (isCacheable) {
    const cached = getCacheEntry(path)
    if (cached !== undefined) return cached

    const inFlight = getPendingRequest(path)
    if (inFlight) return inFlight
  }

  const requestPromise = _doFetch(path, { method, body, headers, timeoutMs, rawBody })

  if (isCacheable) {
    setPendingRequest(path, requestPromise)
    requestPromise
      .then((data) => setCacheEntry(path, data))
      .catch(() => { /* 失敗不快取，下次重試 */ })
      .finally(() => clearPendingRequest(path))
  }

  return requestPromise
}

async function _doFetch(path, { method, body, headers, timeoutMs, rawBody }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const defaultContentType = body && !rawBody ? { 'Content-Type': 'application/json' } : {}
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...defaultContentType,
        ...headers,
      },
      body: body ? (rawBody ? body : JSON.stringify(body)) : undefined,
      signal: controller.signal,
    })

    const text = await res.text()
    const data = text ? JSON.parse(text) : null

    if (!res.ok) {
      throw new ApiError(data?.message || `API 錯誤 (${res.status})`, {
        status: res.status,
        body: data,
      })
    }

    return data
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError('請求逾時，請稍後再試')
    }
    if (err instanceof ApiError) throw err
    throw new ApiError(err.message || '網路連線失敗')
  } finally {
    clearTimeout(timer)
  }
}

export const isBackendConfigured = () => Boolean(BASE_URL)
