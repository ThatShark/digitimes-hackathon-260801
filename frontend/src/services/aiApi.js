/**
 * POST /ai_chat — 對應 backend/api.yaml operationId aiChat
 * POST /allow_trade — 對應 backend/api.yaml operationId allowTrade
 */
import { apiFetch } from './api'
import { getUserPersonality } from '../utils/userPersonality'

const HISTORY_KEY = 'ai_chat_history'

/**
 * 讀取對話歷史（保留該段對話所有紀錄）
 */
function getChatHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []
  } catch {
    return []
  }
}

/**
 * 儲存對話歷史（保留所有紀錄）
 */
export function saveChatHistory(userMsg, aiReply) {
  const history = getChatHistory()
  history.push({ user: userMsg, ai: aiReply })
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

/**
 * 清除對話歷史（換頁或手動重置時呼叫）
 */
export function clearChatHistory() {
  localStorage.removeItem(HISTORY_KEY)
}

/**
 * 傳送訊息給 AI 投資助理
 * @param {string} message
 * @param {string} [currency] - 目前所在幣種頁面（提供上下文）
 * @returns {Promise<{status, message, investment_suggestion: {currency, action, amount} | null}>}
 */
export function sendAiChat(message, currency) {
  const personality = getUserPersonality()
  const history = getChatHistory()
  return apiFetch('/ai_chat?user_id=demo-user', {
    method: 'POST',
    body: {
      message,
      ...(currency ? { currency } : {}),
      ...(personality && personality.code !== '????' ? { personality } : {}),
      ...(history.length > 0 ? { before_messages: history } : {}),
    },
    timeoutMs: 120000,
  })
}

/**
 * 使用者確認執行 AI 建議的交易
 * @param {string} currency
 * @param {'buy'|'sell'} action
 * @param {number} amount - TWD 金額
 * @returns {Promise<{status, message, trade_id}>}
 */
export function allowTrade(currency, action, amount) {
  return apiFetch('/allow_trade', {
    method: 'POST',
    body: { currency, action, amount },
  })
}
