/**
 * GET /questionnaire, POST /questionnaire/submit, GET /quiz/:id, POST /quiz/submit
 * 對應 backend/api.yaml operationId getQuestionnaire / submitQuestionnaire / getQuiz / submitQuiz
 */
import { apiFetch } from './api'

/**
 * 取得一份隨機抽樣的 EFS 人格問卷（20 題，每軸 5 題，已打亂順序，7 點量表）
 * @param {string} [userId]
 * @returns {Promise<{id: string, questions: Array<{id, text, options}>}>}
 */
export function getQuestionnaire(userId = 'demo-user') {
  return apiFetch(`/questionnaire?user_id=${encodeURIComponent(userId)}`)
}

/**
 * 送出 EFS 人格問卷作答，後端計分並存檔（含 AI 生成的人格描述）
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
 * 取得補充問卷的題目（投資習慣 / 投資經驗 / 投資預算）
 * @param {string} quizId - 問卷 ID (investment-habits / investment-experience / investment-budget)
 * @param {string} [userId]
 * @returns {Promise<{id: string, title: string, questions: Array<{id, text, options}>}>}
 */
export function getQuiz(quizId, userId = 'demo-user') {
  return apiFetch(`/quiz?quiz_id=${encodeURIComponent(quizId)}&user_id=${encodeURIComponent(userId)}`)
}

/**
 * 送出補充問卷作答（7 點量表），後端計算各維度平均分數並存檔供 AI 參考。
 * @param {{quiz_id: string, answers: Array<{question_id: string, option_id: string}>}} payload
 * @param {string} [userId]
 * @returns {Promise<{status, quiz_id, dimensions: Object, overall_avg: number, message: string}>}
 */
export function submitQuiz(payload, userId = 'demo-user') {
  return apiFetch(`/quiz/submit?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
    body: payload,
    timeoutMs: 20000,
  })
}
