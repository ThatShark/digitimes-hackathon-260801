/**
 * 全域 GET 請求快取（module-level，跨頁面共享）。
 *
 * 用途：MainPage 的幣種卡片跟 CoinTrendPage 直播頁常常會請求同一筆資料
 * （例如同一幣種的即時價格），沒有快取的話同一份資料會被重複打好幾次 API。
 * 這裡用一個存在於 module 層級（不隨元件卸載而消失）的 Map 來存放結果，
 * 只要是同一個 path（含 query string）在 TTL 內重複請求，就直接回傳快取值。
 *
 * 同時處理「同一瞬間多個地方要同一筆還沒回來的資料」的狀況：
 * 用 `pending` 這個 Map 記錄「正在飛行中」的 Promise，第二個呼叫者不會
 * 再發一次一樣的請求，而是等同一個 Promise resolve。
 */

const CACHE_TTL_MS = 30000

// key（= API path，含 query string）-> { value, expiresAt }
const cache = new Map()

// key -> 尚未 resolve 的 Promise（同一 key 同時只會有一個真正的網路請求在飛）
const pending = new Map()

/** 讀取快取值；不存在或已過期回傳 undefined */
export function getCacheEntry(key) {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return undefined
  }
  return entry.value
}

/** 寫入快取值，TTL 固定 30 秒 */
export function setCacheEntry(key, value) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
}

export function getPendingRequest(key) {
  return pending.get(key)
}

export function setPendingRequest(key, promise) {
  pending.set(key, promise)
}

export function clearPendingRequest(key) {
  pending.delete(key)
}

/**
 * 清除某個 API path 底下的所有快取（不含 query string 比對，前綴符合就清）。
 * 用於「寫入類」API（例如上傳 CSV、儲存人格問卷）成功後，讓相關的 GET
 * 快取立刻失效，下次讀取就會拿到最新資料，不用等 30 秒 TTL 過期。
 *
 * @param {string} pathPrefix - 例如 '/personality'（會清掉 '/personality' 跟
 *   '/personality?user_id=xxx' 等所有帶這個 pathname 的 entry）
 */
export function invalidateCache(pathPrefix) {
  for (const key of cache.keys()) {
    const pathname = key.split('?')[0]
    if (pathname === pathPrefix) {
      cache.delete(key)
    }
  }
}

/** 清空全部快取（測試用／預留） */
export function clearAllCache() {
  cache.clear()
  pending.clear()
}
