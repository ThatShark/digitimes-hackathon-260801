import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import PersonalityBadge from '../components/shared/PersonalityBadge'
import PortfolioOverview from '../components/profile/PortfolioOverview'
import {
  analyzePersonality,
  uploadCsvFile,
  getInitStatus,
  getPersonalityStatus,
  getPortfolio,
  getTradeHistory,
} from '../services/personalityApi'
import { getBalance } from '../services/coinApi'
import { getUserPersonality } from '../utils/userPersonality'
import { CURRENT_USER_NAME, CURRENT_USER_AVATAR } from '../utils/currentUser'
import { isBackendConfigured } from '../services/api'
import { useBookmarks } from '../hooks/useBookmarks'
import './ProfilePage.css'

const BIO_TEXT = '目標在大學畢業前賺進人生第一桶金'

const EMPTY_TRADE_SUMMARY = { total_trades: 0, win_rate: 0, avg_hold_days: 0, top_coins: [] }
const EMPTY_PORTFOLIO = { total_value: 0, total_pnl_pct: 0, holdings: [] }

// EFS 投資人格 16 種正面全圖鑑（跟 backend/src/data/questionnaire_bank.py 的
// PERSONALITY_NAMES 保持一致，兩邊各自維護一份，JS/Python 無法共用常數）。
const PERSONALITY_DESCRIPTIONS = {
  DCLQ: '穩健踏實、重視資產配置，透過時間與複利打造安心的財富城堡。',
  DCLI: '具備巨觀視野與宏大格局，信賴偉大企業的願景，破浪前行、從容不迫。',
  DCSQ: '紀律嚴明、精準無情，像精密時鐘般完美執行低風險套利與網格策略。',
  DCSI: '敏銳靈活、進退有據，能迅速捕捉市場趨勢並冷靜抽身，保全戰果。',
  DELQ: '以高度責任感守護資產，用嚴謹的數據為家庭與未來築起最安全的防線。',
  DELI: '對喜愛的產業抱持高度熱忱與信仰，用愛與支持陪伴企業一同成長。',
  DESQ: '充滿活力與應變力，靈活運用短線數據守護本金，每次防守都是漂亮的轉身。',
  DESI: '對市場脈動充滿好奇與熱情，憑藉直覺靈巧穿梭於各個題材之間，充滿生命力。',
  ACLQ: '極具遠見的創投思維，透過深度的數據研究，冷靜重倉押注未來的產業霸主。',
  ACLI: '勇於探索未知領域，以堅定的信念與冷靜的心態擁抱長線大未來。',
  ACSQ: '出手快狠準，具備極佳的風險報酬計算能力，是追求高勝率的短線操盤高手。',
  ACSI: '享受市場波動的藝術，以輕鬆寫意的心態在短線熱點中衝浪，盡情體驗投資樂趣。',
  AELQ: '充滿創業家精神的投資人，帶著滿腔熱血與理性評估，長期投入高成長的創新賽道。',
  AELI: '擁有強大的信念與感染力，因看好世界變得更好而長期投入，享受與願景共榮的喜悅。',
  AESQ: '充滿行動力與爆發力，熱愛挑戰高難度的短線動能交易，每一次進場都充滿活力。',
  AESI: '對新事物抱持無限好奇，勇敢追逐市場熱點與浪潮，活出精彩刺激的投資人生。',
}

const PERSONALITY_NAMES = {
  DCLQ: '長青樹', DCLI: '老船長', DCSQ: '機械錶', DCSI: '風向球',
  DELQ: '守夜人', DELI: '造夢者', DESQ: '應變者', DESI: '追風者',
  ACLQ: '造局者', ACLI: '拓荒者', ACSQ: '狙擊手', ACSI: '弄潮兒',
  AELQ: '先驅者', AELI: '追夢人', AESQ: '衝鋒號', AESI: '探險家',
}

function _buildPersonalityFromScores(r, e, f, s) {
  const code =
    (r >= 50 ? 'A' : 'D') +
    (e >= 50 ? 'E' : 'C') +
    (f >= 50 ? 'S' : 'L') +
    (s >= 50 ? 'I' : 'Q')
  return { code, name: PERSONALITY_NAMES[code] || '未知', axes: { R: r, E: e, F: f, S: s } }
}

function _formatDate(timestampMs) {
  return new Date(timestampMs).toLocaleDateString('zh-TW')
}

export default function ProfilePage() {
  const { bookmarks } = useBookmarks()

  // 'checking' | 'need_csv' | 'ready'
  const [initStatus, setInitStatus] = useState('checking')

  const [personality, setPersonality] = useState(getUserPersonality())
  const [personalityDesc, setPersonalityDesc] = useState(() => {
    const stored = localStorage.getItem('personality_description')
    if (stored) return stored
    const p = getUserPersonality()
    if (p && p.code && p.code !== '????') return PERSONALITY_DESCRIPTIONS[p.code] || ''
    return ''
  })

  // null = 讀取中；物件 = 已載入（可能是真實資料或 need_csv 時的空白預設值）
  const [portfolio, setPortfolio] = useState(null)
  const [tradeSummary, setTradeSummary] = useState(null)
  const [tradeHistory, setTradeHistory] = useState(null)

  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const fileInputRef = useRef(null)

  const applyPersonalityResponse = useCallback((data) => {
    if (data?.scores) {
      const { r_score = 50, e_score = 50, f_score = 50, s_score = 50 } = data.scores
      const next = _buildPersonalityFromScores(r_score, e_score, f_score, s_score)
      setPersonality(next)
      localStorage.setItem('user_personality', JSON.stringify(next))
    }
    if (data?.personality_description) {
      localStorage.setItem('personality_description', data.personality_description)
      setPersonalityDesc(data.personality_description)
    }
  }, [])

  const fetchPersonality = useCallback(async () => {
    try {
      const data = await getPersonalityStatus()
      applyPersonalityResponse(data)
    } catch {
      // 404（尚未分析）或網路錯誤：維持目前 localStorage 中的人格資料，不清空畫面
    }
  }, [applyPersonalityResponse])

  const fetchPortfolioAndHistory = useCallback(async () => {
    setPortfolio(null)
    setTradeSummary(null)
    setTradeHistory(null)

    const [pf, th, bal] = await Promise.all([
      getPortfolio().catch(() => null),
      getTradeHistory().catch(() => null),
      getBalance().catch(() => null),
    ])

    const portfolioData = pf ?? EMPTY_PORTFOLIO
    // Attach TWD balance to the portfolio object for PortfolioOverview
    portfolioData.twd_balance = bal?.twd_balance ?? 0

    setPortfolio(portfolioData)
    setTradeSummary(th?.summary ?? EMPTY_TRADE_SUMMARY)
    setTradeHistory(th?.history ?? [])
  }, [])

  // 進入頁面先檢查是否已經上傳過 CSV（GET /init），有的話就直接抓資料，
  // 不會要求使用者每次都重新上傳。
  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!isBackendConfigured()) {
        if (!cancelled) {
          setInitStatus('need_csv')
          setPortfolio(EMPTY_PORTFOLIO)
          setTradeSummary(EMPTY_TRADE_SUMMARY)
          setTradeHistory([])
        }
        return
      }
      try {
        const res = await getInitStatus()
        if (cancelled) return
        if (res.status === 'ready') {
          setInitStatus('ready')
          fetchPersonality()
          fetchPortfolioAndHistory()
        } else {
          setInitStatus('need_csv')
          setPortfolio(EMPTY_PORTFOLIO)
          setTradeSummary(EMPTY_TRADE_SUMMARY)
          setTradeHistory([])
        }
      } catch {
        if (!cancelled) {
          setInitStatus('need_csv')
          setPortfolio(EMPTY_PORTFOLIO)
          setTradeSummary(EMPTY_TRADE_SUMMARY)
          setTradeHistory([])
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 監聽問卷頁面等其他地方觸發的人格更新
  useEffect(() => {
    const handleUpdate = () => {
      setPersonality(getUserPersonality())
      setPersonalityDesc(localStorage.getItem('personality_description') || '')
    }
    window.addEventListener('personality-updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('personality-updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setIsUploading(true)
    setUploadError('')
    try {
      const data = await uploadCsvFile(file)
      applyPersonalityResponse(data)
      setInitStatus('ready')
      await fetchPortfolioAndHistory()
    } catch (err) {
      setUploadError(err?.message || '上傳失敗，請確認檔案格式後再試')
    } finally {
      setIsUploading(false)
    }
  }

  const handleAnalyzePersonality = async () => {
    setIsAnalyzing(true)
    setAnalysisError('')
    try {
      const data = await analyzePersonality()
      applyPersonalityResponse(data)
    } catch (err) {
      setAnalysisError(err?.message || '分析失敗，請稍後再試')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const isReady = initStatus === 'ready'

  return (
    <div className="profile-page">
      {/* Header section */}
      <section className="profile-header-section">
        <img src={CURRENT_USER_AVATAR} alt={CURRENT_USER_NAME} className="profile-avatar-large" />
        <div className="profile-header-info">
          <h1 className="profile-display-name">{CURRENT_USER_NAME}</h1>
          {personality && personality.code && (
            <span className="personality-tag">{personality.code} {personality.name}</span>
          )}
          <p className="profile-bio">{BIO_TEXT}</p>
        </div>
      </section>

      {initStatus === 'checking' ? (
        <p className="profile-status-loading">讀取中...</p>
      ) : (
        <>
          <div className="profile-grid">
            {/* Portfolio Overview */}
            <PortfolioOverview portfolio={portfolio} />

            {/* Personality axes */}
            <section className="profile-card personality-card">
              <h2 className="card-title">投資人格 4 軸</h2>

              {!isReady ? (
                <div className="csv-upload-cta">
                  <p className="csv-upload-cta-text">
                    還沒有上傳交易紀錄 —— 上傳 CSV 後即可看到你的真實投資人格分析、資產總覽與交易歷史。
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <button
                    className="csv-btn primary"
                    onClick={handleUploadClick}
                    disabled={isUploading}
                  >
                    {isUploading ? '上傳中...' : '上傳交易紀錄 CSV'}
                  </button>
                  {uploadError && <p className="personality-error">{uploadError}</p>}
                </div>
              ) : (
                <>
                  <p className="personality-summary">
                    <span className="personality-tag">{personality.code} {personality.name}</span>
                    {' '}{personalityDesc || '完成問卷或上傳 CSV 後，AI 將為你生成專屬投資人格描述。'}
                  </p>
                  {isAnalyzing && (
                    <p className="personality-loading">AI 正在分析你的投資人格...</p>
                  )}
                  {analysisError && (
                    <p className="personality-error">{analysisError}</p>
                  )}
                  <PersonalityBadge personality={personality} />
                  <div className="csv-info">
                    <input
                      type="file"
                      accept=".csv"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                    />
                    <div className="csv-actions">
                      <button
                        className="csv-btn"
                        onClick={handleUploadClick}
                        disabled={isUploading}
                      >
                        {isUploading ? '上傳中...' : '重新上傳'}
                      </button>
                      <button
                        className="csv-btn primary"
                        onClick={handleAnalyzePersonality}
                        disabled={isAnalyzing}
                      >
                        {isAnalyzing ? '分析中...' : '重新分析人格'}
                      </button>
                    </div>
                  </div>
                  {uploadError && <p className="personality-error">{uploadError}</p>}
                </>
              )}
            </section>

            {/* Trade summary */}
            <section className="profile-card stats-card">
              <h2 className="card-title">交易摘要</h2>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className={`stat-value ${tradeSummary === null ? 'loading' : ''}`}>
                    {tradeSummary === null ? '讀取中' : tradeSummary.total_trades}
                  </span>
                  <span className="stat-label">總交易次數</span>
                </div>
                <div className="stat-item">
                  <span className={`stat-value ${tradeSummary === null ? 'loading' : ''}`}>
                    {tradeSummary === null ? '讀取中' : `${tradeSummary.win_rate}%`}
                  </span>
                  <span className="stat-label">勝率</span>
                </div>
                <div className="stat-item">
                  <span className={`stat-value ${tradeSummary === null ? 'loading' : ''}`}>
                    {tradeSummary === null ? '讀取中' : `${tradeSummary.avg_hold_days} 天`}
                  </span>
                  <span className="stat-label">平均持倉</span>
                </div>
              </div>
              <div className="top-coins">
                <span className="top-coins-label">最常交易</span>
                <div className="coin-tags">
                  {tradeSummary === null ? (
                    <span className="coin-tag loading">讀取中...</span>
                  ) : tradeSummary.top_coins.length === 0 ? (
                    <span className="coin-tag loading">尚無交易紀錄</span>
                  ) : (
                    tradeSummary.top_coins.map((c) => (
                      <span key={c} className="coin-tag">{c}</span>
                    ))
                  )}
                </div>
              </div>
            </section>

            {/* Watched coins */}
            <section className="profile-card watched-card">
              <h2 className="card-title">關注幣種</h2>
              {bookmarks.length === 0 ? (
                <p className="watched-empty">尚未加入任何關注幣種，可以在幣種頁面加入收藏。</p>
              ) : (
                <div className="watched-list">
                  {bookmarks.map((coin) => (
                    <Link key={coin} to={`/coin/${coin}`} className="watched-item">
                      <div className="watched-icon">{coin.charAt(0)}</div>
                      <span className="watched-name">{coin}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Trade history */}
          <section className="profile-card history-card">
            <h2 className="card-title">交易歷史</h2>
            <div className="history-table-wrapper">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>動作</th>
                    <th>幣種</th>
                    <th>金額 (TWD)</th>
                    <th>價格</th>
                    <th>損益</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeHistory === null ? (
                    <tr>
                      <td colSpan={6} className="history-loading-cell">讀取中...</td>
                    </tr>
                  ) : tradeHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="history-loading-cell">尚無交易紀錄</td>
                    </tr>
                  ) : (
                    tradeHistory.map((trade, i) => (
                      <tr key={`${trade.timestamp_ms}-${i}`}>
                        <td>{_formatDate(trade.timestamp_ms)}</td>
                        <td>
                          <span className={`trade-action-label ${trade.action}`}>
                            {trade.action === 'buy' ? '買入' : '賣出'}
                          </span>
                        </td>
                        <td className="trade-currency">{trade.currency}</td>
                        <td>NT$ {trade.amount_twd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        <td>NT$ {trade.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        <td className={trade.pnl_pct === null ? '' : trade.pnl_pct >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                          {trade.pnl_pct === null ? '—' : `${trade.pnl_pct >= 0 ? '+' : ''}${trade.pnl_pct.toFixed(2)}%`}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
