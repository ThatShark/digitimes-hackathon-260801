/**
 * POST /ai_chat — 對應 backend/api.yaml operationId aiChat
 * POST /allow_trade — 對應 backend/api.yaml operationId allowTrade
 */
import { apiFetch } from './api'
import { getUserPersonality } from '../utils/userPersonality'

const HISTORY_KEY = 'ai_chat_history'

/**
 * Lambda Function URL for AI chat — bypasses API Gateway 29s timeout.
 * Falls back to API Gateway route if not set.
 */
const AI_CHAT_FUNCTION_URL = import.meta.env.VITE_AI_CHAT_URL || ''

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
  const payload = {
    message,
    ...(currency ? { currency } : {}),
    ...(personality && personality.code !== '????' ? { personality } : {}),
    ...(history.length > 0 ? { before_messages: history.slice(-3) } : {}),
  }

  // Use Lambda Function URL if configured (no 29s API Gateway timeout)
  if (AI_CHAT_FUNCTION_URL) {
    return _fetchAiChatDirect(payload)
  }

  // Fallback: go through API Gateway
  return apiFetch('/ai_chat?user_id=demo-user', {
    method: 'POST',
    body: payload,
    timeoutMs: 120000,
  })
}

/**
 * Direct call to Lambda Function URL (bypasses API Gateway 29s limit).
 */
async function _fetchAiChatDirect(payload) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120000)

  try {
    const res = await fetch(`${AI_CHAT_FUNCTION_URL}?user_id=demo-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    const text = await res.text()
    const data = text ? JSON.parse(text) : null

    if (!res.ok) {
      throw new Error(data?.message || `AI 服務錯誤 (${res.status})`)
    }
    return data
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('AI 回覆逾時，請稍後再試')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
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
