import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PersonalityBadge from '../components/shared/PersonalityBadge'
import { getQuestionnaire, submitQuestionnaire, getQuiz, submitQuiz } from '../services/questionnaireApi'
import { setUserPersonality } from '../utils/userPersonality'
import './QuestionnairePage.css'

// 7 點李克特量表選項（對應後端 LIKERT_OPTIONS）
const LIKERT_LABELS = [
  { id: '1', text: '非常不同意', short: '1' },
  { id: '2', text: '不同意', short: '2' },
  { id: '3', text: '有點不同意', short: '3' },
  { id: '4', text: '普通', short: '4' },
  { id: '5', text: '有點同意', short: '5' },
  { id: '6', text: '同意', short: '6' },
  { id: '7', text: '非常同意', short: '7' },
]

// 問卷列表。所有問卷（含 3 份補充問卷）皆採「32 題題庫抽 20 題」結構，
// 題目由後端 GET /questionnaire、GET /quiz 隨機抽樣提供，不再寫死於前端。
const QUESTIONNAIRES = [
  {
    id: 'personality-basic',
    title: '投資人格基礎測驗',
    description: '透過 32 題 EFS 投資人格題庫隨機抽取 20 題，系統將根據結果判定你的 4 字母投資人格代號並校準個人化建議。',
    duration: '5 分鐘',
    icon: '🧠',
    questionCount: 20,
    remote: true,
    type: 'personality',
  },
  {
    id: 'investment-habits',
    title: '投資習慣問卷',
    description: '透過 32 題題庫隨機抽取 20 題，了解你日常的投資決策流程與資訊來源，幫助 AI 更精準地配合你的操作節奏。',
    duration: '5 分鐘',
    icon: '📋',
    questionCount: 20,
    remote: true,
    type: 'supplementary',
  },
  {
    id: 'investment-experience',
    title: '投資經驗問卷',
    description: '透過 32 題題庫隨機抽取 20 題，評估你的投資年資、市場歷練與知識深度，AI 會據此調整解說的專業程度與建議複雜度。',
    duration: '5 分鐘',
    icon: '🎓',
    questionCount: 20,
    remote: true,
    type: 'supplementary',
  },
  {
    id: 'investment-budget',
    title: '投資預算與目標問卷',
    description: '透過 32 題題庫隨機抽取 20 題，了解你的可投資金額、收入來源與投資目標，AI 會據此建議合理的單筆交易金額。',
    duration: '5 分鐘',
    icon: '💰',
    questionCount: 20,
    remote: true,
    type: 'supplementary',
  },
]

export default function QuestionnairePage() {
  const navigate = useNavigate()
  const [activeQuiz, setActiveQuiz] = useState(null)
  const [activeQuizMeta, setActiveQuizMeta] = useState(null) // QUESTIONNAIRES entry
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [resultDescription, setResultDescription] = useState('')
  const [completedIds, setCompletedIds] = useState([])
  const [questionnaireId, setQuestionnaireId] = useState(null)
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const handleStartQuiz = async (quiz) => {
    setResult(null)
    setResultDescription('')
    setSubmitError('')
    setActiveQuizMeta(quiz)

    setIsLoadingQuiz(true)
    setLoadError('')
    try {
      let data
      if (quiz.type === 'personality') {
        // EFS 人格問卷 — 用 GET /questionnaire（32 題抽 20，每軸 5 題）
        data = await getQuestionnaire()
        setQuestionnaireId(data.id)
      } else {
        // 補充問卷 — 用 GET /quiz（32 題抽 20，每維度平均分配）
        data = await getQuiz(quiz.id)
      }
      setActiveQuiz({
        id: quiz.id,
        title: quiz.title,
        type: quiz.type,
        questions: data.questions.map((q) => ({
          id: q.id,
          question: q.text,
        })),
      })
      setCurrentQ(0)
      setAnswers({})
    } catch (err) {
      setLoadError(err.message || '題目載入失敗，請稍後再試')
    } finally {
      setIsLoadingQuiz(false)
    }
  }

  const handleBackToList = () => {
    setActiveQuiz(null)
    setActiveQuizMeta(null)
    setResult(null)
    setLoadError('')
    setSubmitError('')
  }

  const handleSelect = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleNext = async () => {
    if (currentQ < activeQuiz.questions.length - 1) {
      setCurrentQ((prev) => prev + 1)
      return
    }

    // 最後一題 → 送出
    setIsSubmitting(true)
    setSubmitError('')

    try {
      if (activeQuiz.type === 'personality') {
        // EFS 人格問卷 → POST /questionnaire/submit
        const payload = {
          questionnaire_id: questionnaireId,
          answers: Object.entries(answers).map(([question_id, option_id]) => ({
            question_id,
            option_id,
          })),
        }
        const data = await submitQuestionnaire(payload)
        setUserPersonality(data.personality)
        localStorage.setItem('personality_description', data.personality_description || '')
        setResult({ type: 'personality', personality: data.personality })
        setResultDescription(data.personality_description || '')
      } else {
        // 補充問卷 → POST /quiz/submit（後端未部署時 fallback 本地計分）
        const payload = {
          quiz_id: activeQuiz.id,
          answers: Object.entries(answers).map(([question_id, option_id]) => ({
            question_id,
            option_id,
          })),
        }
        try {
          const data = await submitQuiz(payload)
          setResult({
            type: 'supplementary',
            dimensions: data.dimensions,
            overall_avg: data.overall_avg,
            message: data.message,
          })
        } catch {
          // 後端未部署 fallback：本地計算平均分
          const values = Object.values(answers).map(Number).filter((v) => v >= 1 && v <= 7)
          const avg = values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : '4.0'
          setResult({
            type: 'supplementary',
            dimensions: null,
            overall_avg: parseFloat(avg),
            message: '感謝你的作答！AI 將根據這些資料提供更精準的個人化建議。（後端尚未部署，結果暫存於本地）',
          })
        }
      }
      setCompletedIds((prev) => [...prev, activeQuiz.id])
    } catch (err) {
      setSubmitError(err.message || '分析失敗，請稍後再試')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePrev = () => {
    if (currentQ > 0) setCurrentQ((prev) => prev - 1)
  }

  // --- Loading questions from backend ---
  if (isLoadingQuiz) {
    return (
      <div className="questionnaire-page">
        <p className="quiz-loading">載入題目中...</p>
      </div>
    )
  }

  // --- Result view: personality ---
  if (result && result.type === 'personality') {
    const personality = result.personality
    return (
      <div className="questionnaire-page">
        <div className="result-card">
          <div className="result-header">
            <span className="result-emoji">🎉</span>
            <h2 className="result-title">你的投資人格</h2>
          </div>
          <div className="result-personality">
            <PersonalityBadge personality={personality} showName />
          </div>
          <p className="result-description">{resultDescription || getDescription(personality.code)}</p>
          <div className="result-axes">
            {Object.entries({ R: '風險', E: '情緒', F: '頻率', S: '策略' }).map(([key, label]) => (
              <div key={key} className="result-axis">
                <span className="axis-label">{label}</span>
                <div className="axis-bar">
                  <div className="axis-fill" style={{ width: `${personality.axes[key]}%` }} />
                </div>
                <span className="axis-value">{personality.axes[key]}</span>
              </div>
            ))}
          </div>
          <div className="result-actions">
            <button className="result-btn" onClick={() => navigate('/profile')}>
              查看個人頁面 →
            </button>
            <button className="result-btn secondary" onClick={handleBackToList}>
              回到問卷列表
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- Result view: supplementary quiz ---
  if (result && result.type === 'supplementary') {
    return (
      <div className="questionnaire-page">
        <div className="result-card">
          <div className="result-header">
            <span className="result-emoji">✅</span>
            <h2 className="result-title">問卷完成</h2>
          </div>
          <p className="result-description">
            {result.message || '感謝你的作答！AI 將根據這些資料提供更精準的個人化建議。'}
          </p>
          {result.dimensions && (
            <div className="result-axes">
              {Object.entries(result.dimensions).map(([dimId, dim]) => (
                <div key={dimId} className="result-axis">
                  <span className="axis-label" style={{ width: 'auto', minWidth: 80 }}>{dim.name}</span>
                  <div className="axis-bar">
                    <div
                      className="axis-fill"
                      style={{ width: `${Math.round((dim.avg_score / 7) * 100)}%` }}
                    />
                  </div>
                  <span className="axis-value">{dim.avg_score}</span>
                </div>
              ))}
            </div>
          )}
          <div className="result-actions">
            <button className="result-btn" onClick={handleBackToList}>
              回到問卷列表
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- Active quiz view (7-point Likert scale) ---
  if (activeQuiz) {
    const q = activeQuiz.questions[currentQ]
    const answered = answers[q.id] !== undefined
    const progress = ((currentQ + 1) / activeQuiz.questions.length) * 100
    const isLastQuestion = currentQ === activeQuiz.questions.length - 1

    return (
      <div className="questionnaire-page">
        <div className="questionnaire-container">
          <button className="quiz-back-btn" onClick={handleBackToList}>
            ← 回到列表
          </button>

          <div className="questionnaire-progress">
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="progress-text">{currentQ + 1} / {activeQuiz.questions.length}</span>
          </div>

          <h2 className="question-text">{q.question}</h2>

          {/* 7 點李克特量表 UI */}
          <div className="likert-scale">
            <div className="likert-labels">
              <span className="likert-end-label">非常不同意</span>
              <span className="likert-end-label">非常同意</span>
            </div>
            <div className="likert-options">
              {LIKERT_LABELS.map((opt) => (
                <button
                  key={opt.id}
                  className={`likert-btn ${answers[q.id] === opt.id ? 'selected' : ''}`}
                  onClick={() => handleSelect(q.id, opt.id)}
                  title={opt.text}
                >
                  <span className="likert-number">{opt.short}</span>
                </button>
              ))}
            </div>
            <div className="likert-text-labels">
              {LIKERT_LABELS.map((opt) => (
                <span key={opt.id} className="likert-text-label">{opt.text}</span>
              ))}
            </div>
          </div>

          {submitError && <p className="quiz-error">{submitError}</p>}

          <div className="question-nav">
            <button className="nav-btn prev" onClick={handlePrev} disabled={currentQ === 0 || isSubmitting}>
              ← 上一題
            </button>
            <button className="nav-btn next" onClick={handleNext} disabled={!answered || isSubmitting}>
              {isSubmitting ? '分析中...' : isLastQuestion ? '查看結果 →' : '下一題 →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- Quiz list view (default) ---
  return (
    <div className="questionnaire-page list-view">
      <div className="questionnaire-list-container">
        <h1 className="quiz-list-title">投資人格問卷</h1>
        <p className="quiz-list-desc">
          完成問卷幫助 AI 更了解你的投資風格與背景，提供更精準的個人化建議。每份問卷皆可重複作答。
        </p>

        {loadError && <p className="quiz-error">{loadError}</p>}

        <div className="quiz-list">
          {QUESTIONNAIRES.map((quiz) => {
            const isCompleted = completedIds.includes(quiz.id)
            return (
              <div key={quiz.id} className={`quiz-card ${isCompleted ? 'completed' : ''}`}>
                <div className="quiz-card-icon">{quiz.icon}</div>
                <div className="quiz-card-body">
                  <h3 className="quiz-card-title">{quiz.title}</h3>
                  <p className="quiz-card-desc">{quiz.description}</p>
                  <div className="quiz-card-meta">
                    <span className="quiz-duration">⏱ {quiz.duration}</span>
                    <span className="quiz-questions">{quiz.questionCount} 題</span>
                    {isCompleted && <span className="quiz-done-badge">✓ 已完成</span>}
                  </div>
                </div>
                <button
                  className="quiz-start-btn"
                  onClick={() => handleStartQuiz(quiz)}
                >
                  {isCompleted ? '重做' : '開始'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function getDescription(code) {
  const desc = {
    DCLQ: '穩健踏實、重視資產配置，透過時間與複利打造安心的財富城堡。',
    DCLI: '具備巨觀視野與宏大格局，信賴偉大企業的願景，破浪前行、從容不迫。',
    DCSQ: '紀律嚴明、精準無情，像精密時鐘般完美執行低風險套利與網格策略。',
    DCSI: '敏銳靈活、進退有據，能迅速捕捉市場趨勢並冷靜抽身，保全戰果。',
    DELQ: '以高度責任感守護資產，用嚴謹的數據為家庭與未來築起最安全的防線。',
    DELI: '對喜愛的產業抱持高度熱忱與信仰，用愛與支持陪伴企業一同成長。',
    DESQ: '充滿活力與應變力，靈活運用短線數據守護本金，每次防守都是漂亮的轉身。',
    DESI: '對市場脈動充滿好奇與熱情，憑藉直覺靈巧穿梭於各個題材之間，充滿生命力。',
    ACLQ: '極具遠見的創投思維，透過深度的數據研究，冷靜重倉押注未來的產業霸主。',
    ACLI: '勇於探索未知領域（如前沿科技），以堅定的信念與冷靜的心態擁抱長線大未來。',
    ACSQ: '出手快狠準，具備極佳的風險報酬計算能力，是追求高勝率的短線操盤高手。',
    ACSI: '享受市場波動的藝術，以輕鬆寫意的心態在短線熱點中衝浪，盡情體驗投資樂趣。',
    AELQ: '充滿創業家精神的投資人，帶著滿腔熱血與理性評估，長期投入高成長的創新賽道。',
    AELI: '擁有強大的信念與感染力，因看好世界變得更好而長期投入，享受與願景共榮的喜悅。',
    AESQ: '充滿行動力與爆發力，熱愛挑戰高難度的短線動能交易，每一次進場都充滿活力。',
    AESI: '對新事物抱持無限好奇，勇敢追逐市場熱點與浪潮，活出精彩刺激的投資人生。',
  }
  return desc[code] || '你有獨特的交易風格，AI 將根據你的歷史數據做更精確的分析。'
}
