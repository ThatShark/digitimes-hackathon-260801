/**
 * POST /upload_csv — 對應 backend/api.yaml operationId uploadCsv
 * 上傳 CSV 後觸發人格分析，回傳 AI 生成的人格描述
 */
import { apiFetch } from './api'

/**
 * 上傳 CSV 檔案到後端（CSV 內容放在 body，後端會存到 S3 並分析）
 * @param {File} file - CSV 檔案
 * @param {string} userId
 * @returns {Promise<{status, currencies, personality_description, scores}>}
 */
export async function uploadCsvFile(file, userId) {
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
 * @param {string} userId
 * @returns {Promise<{status, currencies, personality_description, scores}>}
 */
export function analyzePersonality(userId) {
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
export function savePersonality(personality, userId = 'demo-user') {
  return apiFetch(`/personality?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
    body: { personality },
    timeoutMs: 60000,
  })
}
