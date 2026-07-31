import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PersonalityBadge from '../components/shared/PersonalityBadge'
import './QuestionnairePage.css'

const QUESTIONS = [
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
]

// 簡易人格計算
function calculatePersonality(answers) {
  let R = 50, E = 50, F = 50, S = 50

  // Q1: 風險偏好
  if (answers[1] === 'A') R += 25
  else if (answers[1] === 'C') R -= 20
  else if (answers[1] === 'D') R -= 25

  // Q2: 頻率
  if (answers[2] === 'A') F += 30
  else if (answers[2] === 'B') F += 15
  else if (answers[2] === 'D') F -= 25

  // Q3: 風險
  if (answers[3] === 'A') R += 20
  else if (answers[3] === 'C') R -= 15
  else if (answers[3] === 'D') R -= 25

  // Q4: 情緒/追勢
  if (answers[4] === 'A') S += 25
  else if (answers[4] === 'C') S -= 25
  else if (answers[4] === 'D') S -= 10

  // Q5: 風險集中度
  if (answers[5] === 'A') E += 25
  else if (answers[5] === 'B') E += 10
  else if (answers[5] === 'D') E -= 25

  // Q6: 策略性
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

  return {
    code,
    name: NAMES[code] || '未知',
    axes: { R, E, F, S },
  }
}

export default function QuestionnairePage() {
  const navigate = useNavigate()
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)

  const handleSelect = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleNext = () => {
    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ((prev) => prev + 1)
    } else {
      // 計算結果
      const personality = calculatePersonality(answers)
      setResult(personality)
    }
  }

  const handlePrev = () => {
    if (currentQ > 0) setCurrentQ((prev) => prev - 1)
  }

  const progress = ((currentQ + 1) / QUESTIONS.length) * 100

  if (result) {
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
          <p className="result-description">
            {getDescription(result.code)}
          </p>
          <div className="result-axes">
            {Object.entries({ R: '風險', E: '集中度', F: '頻率', S: '追勢' }).map(([key, label]) => (
              <div key={key} className="result-axis">
                <span className="axis-label">{label}</span>
                <div className="axis-bar">
                  <div
                    className="axis-fill"
                    style={{ width: `${result.axes[key]}%` }}
                  />
                </div>
                <span className="axis-value">{result.axes[key]}</span>
              </div>
            ))}
          </div>
          <div className="result-actions">
            <button className="result-btn" onClick={() => navigate('/profile')}>
              查看個人頁面 →
            </button>
            <button className="result-btn secondary" onClick={() => navigate('/community')}>
              前往社群
            </button>
          </div>
        </div>
      </div>
    )
  }

  const q = QUESTIONS[currentQ]
  const answered = answers[q.id] !== undefined

  return (
    <div className="questionnaire-page">
      <div className="questionnaire-container">
        <div className="questionnaire-progress">
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="progress-text">{currentQ + 1} / {QUESTIONS.length}</span>
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
          <button
            className="nav-btn prev"
            onClick={handlePrev}
            disabled={currentQ === 0}
          >
            ← 上一題
          </button>
          <button
            className="nav-btn next"
            onClick={handleNext}
            disabled={!answered}
          >
            {currentQ === QUESTIONS.length - 1 ? '查看結果 →' : '下一題 →'}
          </button>
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
