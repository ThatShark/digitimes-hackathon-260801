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
 * @param {string} path - 例如 '/coin/price?currency=BTC'
 * @param {object} [options]
 * @param {'GET'|'POST'|'PUT'|'DELETE'} [options.method]
 * @param {object} [options.body] - 會自動 JSON.stringify
 * @param {object} [options.headers]
 * @param {number} [options.timeoutMs] - 預設 10 秒逾時
 * @returns {Promise<any>}
 */
export async function apiFetch(path, options = {}) {
  if (!BASE_URL) {
    throw new ApiError(
      '尚未設定 VITE_API_BASE_URL，無法連接後端（目前使用 mock 資料）'
    )
  }

  const { method = 'GET', body, headers = {}, timeoutMs = 10000 } = options

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
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
