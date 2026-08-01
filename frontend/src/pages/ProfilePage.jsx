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
import { getUserPersonality } from '../utils/userPersonality'
import { CURRENT_USER_NAME, CURRENT_USER_AVATAR } from '../utils/currentUser'
import { isBackendConfigured } from '../services/api'
import { useBookmarks } from '../hooks/useBookmarks'
import './ProfilePage.css'

const BIO_TEXT = '目標在大學畢業前賺進人生第一桶金'

const EMPTY_TRADE_SUMMARY = { total_trades: 0, win_rate: 0, avg_hold_days: 0, top_coins: [] }
const EMPTY_PORTFOLIO = { total_value: 0, total_pnl_pct: 0, holdings: [] }

const PERSONALITY_DESCRIPTIONS = {
  ACSI: '你是高頻交易的逆勢短線玩家，享受市場波動帶來的刺激。',
  ACSQ: '你是精準狙擊的計畫型選手，出手果斷但不盲從。',
  ACLI: '你是勇於嘗試的拓荒者，在未知市場中尋找機會。',
  ACLQ: '你是耐心等待獵物的狙擊手，一擊必中。',
  AESI: '你是喜歡冒險的探索者，什麼熱就追什麼。',
  AESQ: '你追逐風口，善於捕捉短期趨勢的爆發力。',
  AELI: '你是充滿想像力的造夢者，敢於押注未來。',
  AELQ: '你是全力以赴的賭徒，高風險高回報是你的信條。',
  DCSI: '你善於觀察風向，穩中求變的靈活投資者。',
  DCSQ: '你是穩健的守望者，用數據和紀律守護資產。',
  DCLI: '你是最穩健的長期持有者，不輕易被市場動搖。',
  DCLQ: '你如磐石般堅定，以長期複利為核心策略。',
  DESI: '你是低調的隱者，偶爾出手但求穩不求快。',
  DESQ: '你是冷靜的觀察家，善於在混亂中找到規律。',
  DELI: '你是靜靜守候的守夜人，等待最佳時機才行動。',
  DELQ: '你幾乎不交易，安安靜靜等待最好的時機。',
}

const PERSONALITY_NAMES = {
  ACSI: '弄潮兒', ACSQ: '狙擊手', ACLI: '拓荒者', ACLQ: '獵手',
  AESI: '探險家', AESQ: '追風者', AELI: '造夢者', AELQ: '賭徒',
  DCSI: '風向球', DCSQ: '守望者', DCLI: '長青樹', DCLQ: '磐石',
  DESI: '隱者', DESQ: '觀察家', DELI: '守夜人', DELQ: '冬眠者',
}

function _buildPersonalityFromScores(r, e, f, s) {
  const code =
    (r >= 50 ? 'A' : 'D') +
    (e >= 50 ? 'E' : 'C') +
    (f >= 50 ? 'S' : 'L') +
    (s >= 50 ? 'Q' : 'I')
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

    const [pf, th] = await Promise.all([
      getPortfolio().catch(() => null),
      getTradeHistory().catch(() => null),
    ])

    setPortfolio(pf ?? EMPTY_PORTFOLIO)
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
          <PersonalityBadge personality={personality} compact showName />
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
                        <td>NT$ {trade.amount_twd.toLocaleString()}</td>
                        <td>NT$ {trade.price.toLocaleString()}</td>
                        <td className={trade.pnl_pct === null ? '' : trade.pnl_pct >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                          {trade.pnl_pct === null ? '—' : `${trade.pnl_pct >= 0 ? '+' : ''}${trade.pnl_pct}%`}
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
