/**
 * POST /upload_csv — 對應 backend/api.yaml operationId uploadCsv
 * 上傳 CSV 後觸發人格分析，回傳 AI 生成的人格描述
 * GET /init — 對應 operationId getInit（檢查使用者是否已上傳過 CSV）
 * GET /personality — 對應 operationId getPersonality（讀取已存的人格分析結果）
 * GET /portfolio — 對應 operationId getPortfolio（持倉 x 即時價格）
 * GET /trade_history — 對應 operationId getTradeHistory（交易摘要 + 交易歷史）
 */
import { apiFetch } from './api'
import { CURRENT_USER_ID } from '../utils/currentUser'

/**
 * 上傳 CSV 檔案到後端（CSV 內容放在 body，後端會存到 S3 並分析）
 * @param {File} file - CSV 檔案
 * @param {string} [userId]
 * @returns {Promise<{status, currencies, personality_description, scores}>}
 */
export async function uploadCsvFile(file, userId = CURRENT_USER_ID) {
  const text = await file.text()
  return apiFetch(`/upload_csv?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/csv' },
    body: text,
    rawBody: true,
    timeoutMs: 60000,
  })
}

/**
 * 觸發人格分析（CSV 已在 S3）
 * @param {string} [userId]
 * @returns {Promise<{status, currencies, personality_description, scores}>}
 */
export function analyzePersonality(userId = CURRENT_USER_ID) {
  return apiFetch(`/upload_csv?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
    timeoutMs: 60000,
  })
}

/**
 * 儲存問卷結果到後端（會觸發 AI 生成人格描述並存到 S3）
 * @param {object} personality - { code, name, axes: {R, E, F, S} }
 * @param {string} [userId]
 * @returns {Promise<{status, personality_description, personality_analysis, scores}>}
 */
export function savePersonality(personality, userId = CURRENT_USER_ID) {
  return apiFetch(`/personality?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
    body: { personality },
    timeoutMs: 60000,
  })
}

/**
 * 檢查使用者是否已經上傳過 CSV（不會觸發重新分析，單純讀取存在與否）
 * @param {string} [userId]
 * @returns {Promise<{status: 'need_csv'|'ready', currencies?: string[]}>}
 */
export function getInitStatus(userId = CURRENT_USER_ID) {
  return apiFetch(`/init?user_id=${encodeURIComponent(userId)}`)
}

/**
 * 讀取已經存在 S3 的人格分析結果（不會重新呼叫 Bedrock，速度快）
 * 404（need_csv）代表使用者還沒上傳 CSV 或還沒跑過分析。
 * @param {string} [userId]
 * @returns {Promise<{status, personality_description, personality_analysis, scores}>}
 */
export function getPersonalityStatus(userId = CURRENT_USER_ID) {
  return apiFetch(`/personality?user_id=${encodeURIComponent(userId)}`)
}

/**
 * 取得使用者持倉總覽（後端用 CSV 算持有量，即時價格來自 MAX API）
 * @param {string} [userId]
 * @param {string} [quote] - 報價幣種，預設 TWD
 * @returns {Promise<{status, total_value, total_pnl_pct, holdings}>}
 */
export function getPortfolio(userId = CURRENT_USER_ID, quote = 'TWD') {
  const params = new URLSearchParams({ user_id: userId, quote })
  return apiFetch(`/portfolio?${params}`)
}

/**
 * 取得交易摘要 + 交易歷史（後端從 CSV 計算）
 * @param {string} [userId]
 * @param {number} [limit] - 交易歷史最多回傳幾筆，預設 50
 * @returns {Promise<{status, summary, history}>}
 */
export function getTradeHistory(userId = CURRENT_USER_ID, limit) {
  const params = new URLSearchParams({ user_id: userId })
  if (limit != null) params.set('limit', String(limit))
  return apiFetch(`/trade_history?${params}`)
}
