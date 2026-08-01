/**
 * GET /questionnaire, POST /questionnaire/submit
 * 對應 backend/api.yaml operationId getQuestionnaire / submitQuestionnaire
 */
import { apiFetch } from './api'

/**
 * 取得一份隨機抽樣的問卷（20 題，每軸 5 題，已打亂順序）
 * @param {string} [userId]
 * @returns {Promise<{id: string, questions: Array<{id, text, options}>}>}
 */
export function getQuestionnaire(userId = 'demo-user') {
  return apiFetch(`/questionnaire?user_id=${encodeURIComponent(userId)}`)
}

/**
 * 送出問卷作答，後端計分並存檔（含 AI 生成的人格描述）
 * @param {{questionnaire_id: string, answers: Array<{question_id: string, option_id: string}>}} payload
 * @param {string} [userId]
 * @returns {Promise<{status, personality: {code, name, axes}, personality_description, personality_analysis}>}
 */
export function submitQuestionnaire(payload, userId = 'demo-user') {
  return apiFetch(`/questionnaire/submit?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
    body: payload,
    timeoutMs: 60000,
  })
}

/**
 * 送出「風險承受度評估」或「市場情緒敏感度」的作答（單一維度計分，不涉及
 * R/E/F/S 人格），後端算分並存檔，回傳簡短的結果標籤與說明文字。
 * @param {{quiz_id: string, answers: Array<{question_id: number, option_id: string}>}} payload
 * @param {string} [userId]
 * @returns {Promise<{status, score: number, label: string, message: string}>}
 */
export function submitQuiz(payload, userId = 'demo-user') {
  return apiFetch(`/quiz/submit?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
    body: payload,
    timeoutMs: 20000,
  })
}
