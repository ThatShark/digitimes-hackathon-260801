/**
 * POST /ai_chat — 對應 backend/api.yaml operationId aiChat
 * POST /allow_trade — 對應 backend/api.yaml operationId allowTrade
 */
import { apiFetch } from './api'
import { getUserPersonality } from '../utils/userPersonality'

/**
 * 傳送訊息給 AI 投資助理
 * @param {string} message
 * @param {string} [currency] - 目前所在幣種頁面（提供上下文）
 * @returns {Promise<{status, message, investment_suggestion: {currency, action, amount} | null}>}
 */
export function sendAiChat(message, currency) {
  const personality = getUserPersonality()
  return apiFetch('/ai_chat?user_id=demo-user', {
    method: 'POST',
    body: {
      message,
      ...(currency ? { currency } : {}),
      ...(personality && personality.code !== '????' ? { personality } : {}),
    },
    timeoutMs: 30000,
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
