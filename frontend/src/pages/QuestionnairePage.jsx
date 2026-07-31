import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PersonalityBadge from '../components/shared/PersonalityBadge'
import './QuestionnairePage.css'

// 問卷列表
const QUESTIONNAIRES = [
  {
    id: 'personality-basic',
    title: '投資人格基礎測驗',
    description: '透過 6 個問題了解你的投資風格，系統將根據結果校準個人化建議。',
    duration: '2 分鐘',
    icon: '🧠',
    questions: [
      {
        id: 1,
        question: '當市場突然下跌 10%，你通常會怎麼做？',
        options: [
          { value: 'A', label: '立刻加倉抄底' },
          { value: 'B', label: '觀望等待止跌訊號' },
          { value: 'C', label: '馬上停損賣出' },
          { value: 'D', label: '完全不看盤，長期持有' },
        ],
      },
      {
        id: 2,
        question: '你通常持有一個幣種多長時間？',
        options: [
          { value: 'A', label: '幾小時到一天' },
          { value: 'B', label: '幾天到一週' },
          { value: 'C', label: '幾週到一個月' },
          { value: 'D', label: '超過一個月' },
        ],
      },
      {
        id: 3,
        question: '你把多少資金放在穩定幣（USDT/USDC）？',
        options: [
          { value: 'A', label: '幾乎沒有，全部投入' },
          { value: 'B', label: '約 20-30%' },
          { value: 'C', label: '約 50%' },
          { value: 'D', label: '大部分都是穩定幣' },
        ],
      },
      {
        id: 4,
        question: '當你看到社群大量討論某個幣即將大漲，你會？',
        options: [
          { value: 'A', label: '立刻跟進買入' },
          { value: 'B', label: '先做自己的分析再決定' },
          { value: 'C', label: '覺得要漲的時候反而該小心' },
          { value: 'D', label: '完全不受影響，按自己計畫走' },
        ],
      },
      {
        id: 5,
        question: '過去一個月，你最大的一筆交易大約是總資金的多少？',
        options: [
          { value: 'A', label: '超過 50%（集中押注）' },
          { value: 'B', label: '30-50%' },
          { value: 'C', label: '10-30%' },
          { value: 'D', label: '不超過 10%（分散佈局）' },
        ],
      },
      {
        id: 6,
        question: '你做交易前通常會？',
        options: [
          { value: 'A', label: '憑感覺和市場氣氛' },
          { value: 'B', label: '看看 K 線就出手' },
          { value: 'C', label: '設好止盈止損才進場' },
          { value: 'D', label: '有完整的交易計畫和日誌' },
        ],
      },
    ],
  },
  {
    id: 'risk-tolerance',
    title: '風險承受度評估',
    description: '深入分析你對虧損的承受能力，幫助 AI 調整建議的激進程度。',
    duration: '3 分鐘',
    icon: '🎯',
    questions: [
      {
        id: 1,
        question: '如果你的投資組合一天虧損 20%，你的反應是？',
        options: [
          { value: 'A', label: '加碼買入，這是機會' },
          { value: 'B', label: '緊張但不動作' },
          { value: 'C', label: '賣掉一半停損' },
          { value: 'D', label: '全部出清，無法承受' },
        ],
      },
      {
        id: 2,
        question: '你能接受多大的最大回撤？',
        options: [
          { value: 'A', label: '50% 以上都能忍' },
          { value: 'B', label: '30% 是上限' },
          { value: 'C', label: '15% 就會很不安' },
          { value: 'D', label: '5% 以上就睡不著' },
        ],
      },
      {
        id: 3,
        question: '你投入加密貨幣的資金佔你總資產多少？',
        options: [
          { value: 'A', label: '超過 70%' },
          { value: 'B', label: '40-70%' },
          { value: 'C', label: '10-40%' },
          { value: 'D', label: '不到 10%' },
        ],
      },
    ],
  },
  {
    id: 'market-sentiment',
    title: '市場情緒敏感度',
    description: '了解你對市場消息和群體情緒的反應模式。',
    duration: '2 分鐘',
    icon: '📊',
    questions: [
      {
        id: 1,
        question: '當 Elon Musk 發推提到某幣時？',
        options: [
          { value: 'A', label: '立刻買' },
          { value: 'B', label: '觀察 30 分鐘再說' },
          { value: 'C', label: '覺得是反指標' },
          { value: 'D', label: '不關注名人效應' },
        ],
      },
      {
        id: 2,
        question: '恐懼貪婪指數顯示「極度恐慌」時？',
        options: [
          { value: 'A', label: '大力買入' },
          { value: 'B', label: '小量試探' },
          { value: 'C', label: '觀望不動' },
          { value: 'D', label: '跟著害怕，減倉' },
        ],
      },
    ],
  },
]

// 簡易人格計算
function calculatePersonality(answers) {
  let R = 50, E = 50, F = 50, S = 50
  if (answers[1] === 'A') R += 25
  else if (answers[1] === 'C') R -= 20
  else if (answers[1] === 'D') R -= 25
  if (answers[2] === 'A') F += 30
  else if (answers[2] === 'B') F += 15
  else if (answers[2] === 'D') F -= 25
  if (answers[3] === 'A') R += 20
  else if (answers[3] === 'C') R -= 15
  else if (answers[3] === 'D') R -= 25
  if (answers[4] === 'A') S += 25
  else if (answers[4] === 'C') S -= 25
  else if (answers[4] === 'D') S -= 10
  if (answers[5] === 'A') E += 25
  else if (answers[5] === 'B') E += 10
  else if (answers[5] === 'D') E -= 25
  if (answers[6] === 'A') { F += 10; E += 10 }
  else if (answers[6] === 'C') { F -= 10; E -= 15 }
  else if (answers[6] === 'D') { F -= 20; E -= 20 }
  R = Math.max(0, Math.min(100, R))
  E = Math.max(0, Math.min(100, E))
  F = Math.max(0, Math.min(100, F))
  S = Math.max(0, Math.min(100, S))
  const code =
    (F >= 50 ? 'A' : 'D') +
    (R >= 50 ? 'C' : 'E') +
    (E < 50 ? 'S' : 'L') +
    (S >= 50 ? 'I' : 'Q')
  const NAMES = {
    ACSI: '弄潮兒', ACSQ: '狙擊手', ACLI: '拓荒者', ACLQ: '獵手',
    AESI: '探險家', AESQ: '追風者', AELI: '造夢者', AELQ: '賭徒',
    DCSI: '風向球', DCSQ: '守望者', DCLI: '長青樹', DCLQ: '磐石',
    DESI: '隱者', DESQ: '觀察家', DELI: '守夜人', DELQ: '冬眠者',
  }
  return { code, name: NAMES[code] || '未知', axes: { R, E, F, S } }
}

export default function QuestionnairePage() {
  const navigate = useNavigate()
  const [activeQuiz, setActiveQuiz] = useState(null)
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [completedIds, setCompletedIds] = useState([])

  const handleStartQuiz = (quiz) => {
    setActiveQuiz(quiz)
    setCurrentQ(0)
    setAnswers({})
    setResult(null)
  }

  const handleBackToList = () => {
    setActiveQuiz(null)
    setResult(null)
  }

  const handleSelect = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleNext = () => {
    if (currentQ < activeQuiz.questions.length - 1) {
      setCurrentQ((prev) => prev + 1)
    } else {
      if (activeQuiz.id === 'personality-basic') {
        const personality = calculatePersonality(answers)
        setResult(personality)
      } else {
        setResult({ code: 'DONE', name: '已完成', axes: {} })
      }
      setCompletedIds((prev) => [...prev, activeQuiz.id])
    }
  }

  const handlePrev = () => {
    if (currentQ > 0) setCurrentQ((prev) => prev - 1)
  }

  // --- Result view ---
  if (result && activeQuiz?.id === 'personality-basic') {
    return (
      <div className="questionnaire-page">
        <div className="result-card">
          <div className="result-header">
            <span className="result-emoji">🎉</span>
            <h2 className="result-title">你的投資人格</h2>
          </div>
          <div className="result-personality">
            <PersonalityBadge personality={result} showName />
          </div>
          <p className="result-description">{getDescription(result.code)}</p>
          <div className="result-axes">
            {Object.entries({ R: '風險', E: '集中度', F: '頻率', S: '追勢' }).map(([key, label]) => (
              <div key={key} className="result-axis">
                <span className="axis-label">{label}</span>
                <div className="axis-bar">
                  <div className="axis-fill" style={{ width: `${result.axes[key]}%` }} />
                </div>
                <span className="axis-value">{result.axes[key]}</span>
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

  // --- Generic completion view ---
  if (result) {
    return (
      <div className="questionnaire-page">
        <div className="result-card">
          <div className="result-header">
            <span className="result-emoji">✅</span>
            <h2 className="result-title">問卷已完成</h2>
          </div>
          <p className="result-description">
            感謝你的回答！AI 會根據此問卷結果調整對你的分析和建議。
          </p>
          <div className="result-actions">
            <button className="result-btn" onClick={handleBackToList}>
              回到問卷列表
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- Active quiz view ---
  if (activeQuiz) {
    const q = activeQuiz.questions[currentQ]
    const answered = answers[q.id] !== undefined
    const progress = ((currentQ + 1) / activeQuiz.questions.length) * 100

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

          <div className="options-list">
            {q.options.map((opt) => (
              <button
                key={opt.value}
                className={`option-btn ${answers[q.id] === opt.value ? 'selected' : ''}`}
                onClick={() => handleSelect(q.id, opt.value)}
              >
                <span className="option-letter">{opt.value}</span>
                <span className="option-label">{opt.label}</span>
              </button>
            ))}
          </div>

          <div className="question-nav">
            <button className="nav-btn prev" onClick={handlePrev} disabled={currentQ === 0}>
              ← 上一題
            </button>
            <button className="nav-btn next" onClick={handleNext} disabled={!answered}>
              {currentQ === activeQuiz.questions.length - 1 ? '查看結果 →' : '下一題 →'}
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
        <h1 className="quiz-list-title">人格問卷</h1>
        <p className="quiz-list-desc">
          完成問卷幫助 AI 更了解你的投資風格，提供更精準的個人化建議。
        </p>

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
                    <span className="quiz-questions">{quiz.questions.length} 題</span>
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
    ACSI: '你是高頻交易的逆勢短線玩家，享受市場波動帶來的刺激。',
    ACSQ: '你是精準狙擊的計畫型選手，出手果斷但不盲從。',
    AESI: '你是喜歡冒險的探索者，什麼熱就追什麼。',
    DCSI: '你善於觀察風向，穩中求變。',
    DCLQ: '你是最穩健的長期持有者，不輕易被市場動搖。',
    DELQ: '你幾乎不交易，安安靜靜等待最好的時機。',
  }
  return desc[code] || '你有獨特的交易風格，AI 將根據你的歷史數據做更精確的分析。'
}
