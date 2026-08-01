/**
 * 用戶投資人格工具 — 從 localStorage 讀取（問卷或 CSV 分析後存入）
 * 若尚未做過分析則回傳預設值
 */

const STORAGE_KEY = 'user_personality'

const DEFAULT_PERSONALITY = {
  code: '????',
  name: '未分析',
  axes: { R: 50, E: 50, F: 50, S: 50 },
}

/**
 * 取得目前用戶的投資人格
 * @returns {{ code: string, name: string, axes: { R: number, E: number, F: number, S: number } }}
 */
export function getUserPersonality() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.code && parsed.axes) {
        return parsed
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_PERSONALITY
}

/**
 * 儲存用戶投資人格到 localStorage
 * @param {{ code: string, name: string, axes: object }} personality
 */
export function setUserPersonality(personality) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(personality))
  // 發送事件讓其他元件知道人格已更新
  window.dispatchEvent(new Event('personality-updated'))
}

/**
 * 是否已完成人格分析
 */
export function hasPersonality() {
  const p = getUserPersonality()
  return p.code !== '????' && p.code !== ''
}
