import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PersonalityBadge from '../components/shared/PersonalityBadge'
import { getQuestionnaire, submitQuestionnaire, submitQuiz } from '../services/questionnaireApi'
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

// 補充問卷題庫（固定題目，不需從後端取，只有提交時才呼叫後端計分）
const SUPPLEMENTARY_QUESTIONS = {
  'investment-habits': [
    { id: 'h1', text: '我做投資決策前，會花大量時間閱讀專業分析報告或研究文章。' },
    { id: 'h2', text: '我主要依靠社群媒體（Twitter/X、Threads、Discord）獲取投資資訊。' },
    { id: 'h3', text: '我會定期追蹤鏈上數據（如活躍地址數、TVL、Gas 費用）來輔助判斷。' },
    { id: 'h4', text: '朋友或投資社群的推薦，對我的買賣決定有很大的影響力。' },
    { id: 'h5', text: '我通常在看到機會後會立即行動，不太會等待或猶豫。' },
    { id: 'h6', text: '在下單之前，我習慣設定好明確的停利與停損價位。' },
    { id: 'h7', text: '我有一套固定的投資檢核流程（例如確認多個指標才進場）。' },
    { id: 'h8', text: '我經常在深夜或情緒激動的時候做出買賣決定。' },
    { id: 'h9', text: '我會定期（每週或每月）重新檢視並調整我的投資組合配置。' },
    { id: 'h10', text: '我傾向將資金分散在 5 種以上不同的幣種或資產類型。' },
    { id: 'h11', text: '當某個持倉超過總資產的 30%，我會主動減倉以降低集中風險。' },
    { id: 'h12', text: '我很少主動調整投資組合，買入後通常就放著不管。' },
  ],
  'investment-experience': [
    { id: 'e1', text: '我有超過 3 年的投資經驗（包含股票、基金、加密貨幣等任何形式）。' },
    { id: 'e2', text: '我曾經歷過至少一次完整的牛熊市場週期。' },
    { id: 'e3', text: '我在加密貨幣領域的交易經驗超過 1 年。' },
    { id: 'e4', text: '我使用過 3 個以上不同的交易所或投資平台。' },
    { id: 'e5', text: '我能清楚解釋什麼是移動平均線、RSI、MACD 等技術指標。' },
    { id: 'e6', text: '我了解止盈止損單、限價單、OCO 單等進階下單類型的運作方式。' },
    { id: 'e7', text: '我能看懂並分析一家公司或項目的財務報表/代幣經濟模型。' },
    { id: 'e8', text: '我了解資產配置、夏普比率、最大回撤等投資組合管理概念。' },
    { id: 'e9', text: '我了解 DeFi 協議（如 AMM、借貸平台、流動性挖礦）的運作原理。' },
    { id: 'e10', text: '我曾使用過去中心化錢包（如 MetaMask）進行鏈上操作。' },
    { id: 'e11', text: '我會查看鏈上數據（如 Glassnode、Dune Analytics）來輔助投資決策。' },
    { id: 'e12', text: '我了解不同共識機制（PoW、PoS）和 Layer 1/Layer 2 的技術差異。' },
    { id: 'e13', text: '我曾經歷過單筆投資虧損超過 50% 的經驗。' },
    { id: 'e14', text: '過去的虧損經歷讓我建立了更嚴格的風控紀律。' },
    { id: 'e15', text: '我曾因為 FOMO（害怕錯過）而追高買入，事後感到後悔。' },
  ],
  'investment-budget': [
    { id: 'b1', text: '我每月可以固定撥出一筆金額投入加密貨幣市場。' },
    { id: 'b2', text: '我目前投入加密貨幣的總金額，佔我個人總資產的比例很高。' },
    { id: 'b3', text: '即使投入加密貨幣的資金全部歸零，也不會影響我的日常生活。' },
    { id: 'b4', text: '我單次下單的金額通常超過新台幣 10,000 元。' },
    { id: 'b5', text: '我有足夠的緊急預備金（至少 3-6 個月生活費），才會將閒錢投入市場。' },
    { id: 'b6', text: '我有穩定的月薪或固定收入來源。' },
    { id: 'b7', text: '我的投資本金來自長期儲蓄，不是借貸或短期周轉金。' },
    { id: 'b8', text: '如果一筆投資被套牢，我不需要急著用這筆錢，可以耐心等待。' },
    { id: 'b9', text: '我有其他被動收入來源（如房租、股息、利息），不完全依賴薪水。' },
    { id: 'b10', text: '我投資加密貨幣的主要目的是長期財富累積，而非短期獲利。' },
    { id: 'b11', text: '我希望透過投資在 3-5 年內達成一個具體的財務目標（如買房、退休）。' },
    { id: 'b12', text: '我期望的年化報酬率超過 30%。' },
    { id: 'b13', text: '比起追求高報酬，我更在意資產穩定增長、打敗通膨。' },
  ],
}

// 問卷列表
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
    description: '了解你日常的投資決策流程與資訊來源，幫助 AI 更精準地配合你的操作節奏。',
    duration: '4 分鐘',
    icon: '📋',
    questionCount: 12,
    remote: false,
    type: 'supplementary',
  },
  {
    id: 'investment-experience',
    title: '投資經驗問卷',
    description: '評估你的投資年資、市場歷練與知識深度，AI 會據此調整解說的專業程度與建議複雜度。',
    duration: '5 分鐘',
    icon: '🎓',
    questionCount: 15,
    remote: false,
    type: 'supplementary',
  },
  {
    id: 'investment-budget',
    title: '投資預算與目標問卷',
    description: '了解你的可投資金額、收入來源與投資目標，AI 會據此建議合理的單筆交易金額。',
    duration: '4 分鐘',
    icon: '💰',
    questionCount: 13,
    remote: false,
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

    if (!quiz.remote) {
      // 補充問卷：題目在前端，直接使用
      const localQuestions = SUPPLEMENTARY_QUESTIONS[quiz.id]
      if (localQuestions) {
        setActiveQuiz({
          id: quiz.id,
          title: quiz.title,
          type: quiz.type,
          questions: localQuestions.map((q) => ({
            id: q.id,
            question: q.text,
          })),
        })
      } else {
        setActiveQuiz(quiz)
      }
      setCurrentQ(0)
      setAnswers({})
      return
    }

    setIsLoadingQuiz(true)
    setLoadError('')
    try {
      let data
      if (quiz.type === 'personality') {
        // EFS 人格問卷 — 用 GET /questionnaire
        data = await getQuestionnaire()
        setQuestionnaireId(data.id)
        setActiveQuiz({
          id: quiz.id,
          title: quiz.title,
          type: quiz.type,
          questions: data.questions.map((q) => ({
            id: q.id,
            question: q.text,
          })),
        })
      }
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
