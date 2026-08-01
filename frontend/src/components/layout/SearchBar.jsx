import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './SearchBar.css'

// 幣種資料庫
const ALL_COINS = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'DOT', name: 'Polkadot' },
  { symbol: 'PEPE', name: 'Pepe' },
  { symbol: 'WIF', name: 'dogwifhat' },
  { symbol: 'ARB', name: 'Arbitrum' },
  { symbol: 'LINK', name: 'Chainlink' },
  { symbol: 'AVAX', name: 'Avalanche' },
  { symbol: 'NEAR', name: 'NEAR Protocol' },
]

// 社群貼文關鍵詞（mock 搜尋用）
const MOCK_POST_RESULTS = [
  { id: 1, author: '王大壯', snippet: '最近 $BTC 有突破 300 萬的趨勢...' },
  { id: 2, author: '陳Ｊ哥', snippet: '剛剛 all-in $SOL，感覺要起飛了...' },
  { id: 4, author: '趙柏翰', snippet: '$BTC 停利 +8% • $SOL 停損 -3%...' },
  { id: 5, author: '吳芸安', snippet: '$DOGE 社群又在炒了，小心為上...' },
  { id: 3, author: '李小雨', snippet: '大家覺得 $ETH 現在可以分批買嗎？' },
]

// 問卷（mock）
const MOCK_QUESTIONNAIRES = [
  { id: 'personality-basic', title: '投資人格基礎測驗' },
  { id: 'risk-tolerance', title: '風險承受度評估' },
  { id: 'market-sentiment', title: '市場情緒敏感度' },
]

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const wrapperRef = useRef(null)

  // 判斷當前頁面類型
  const isCommunity = location.pathname === '/community'
  const isQuestionnaire = location.pathname === '/questionnaire'
  const isCoinPage = location.pathname.startsWith('/coin/')

  const placeholder = isCommunity
    ? '搜尋貼文內容...'
    : isQuestionnaire
      ? '搜尋問卷...'
      : '搜尋幣種...'

  // 點擊外部關閉
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // 搜尋結果
  const results = getResults(query, { isCommunity, isQuestionnaire })
  const showDropdown = focused && query.trim().length > 0 && results.length > 0

  const handleSelect = (result) => {
    setQuery('')
    setFocused(false)
    if (result.type === 'coin') {
      navigate(`/coin/${result.symbol}`)
    } else if (result.type === 'post') {
      navigate(`/community#post-${result.id}`)
    } else if (result.type === 'questionnaire') {
      navigate('/questionnaire')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && results.length > 0) {
      handleSelect(results[0])
    }
    if (e.key === 'Escape') {
      setFocused(false)
    }
  }

  return (
    <div className="search-bar" ref={wrapperRef}>
      <span className="search-icon">🔍</span>
      <input
        type="text"
        placeholder={placeholder}
        className="search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={handleKeyDown}
      />
      {query && (
        <button className="search-clear" onClick={() => setQuery('')}>✕</button>
      )}

      {showDropdown && (
        <div className="search-dropdown">
          {results.map((r, i) => (
            <button
              key={`${r.type}-${r.id || r.symbol || i}`}
              className="search-result"
              onClick={() => handleSelect(r)}
            >
              <span className="result-icon">{r.icon}</span>
              <div className="result-body">
                <span className="result-title">{r.title}</span>
                {r.subtitle && <span className="result-subtitle">{r.subtitle}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function getResults(query, { isCommunity, isQuestionnaire }) {
  const q = query.trim().toLowerCase()
  if (!q) return []

  if (isQuestionnaire) {
    return MOCK_QUESTIONNAIRES
      .filter((qn) => qn.title.toLowerCase().includes(q))
      .slice(0, 5)
      .map((qn) => ({ type: 'questionnaire', id: qn.id, title: qn.title, icon: '📋' }))
  }

  if (isCommunity) {
    return MOCK_POST_RESULTS
      .filter((p) => p.snippet.toLowerCase().includes(q) || p.author.toLowerCase().includes(q))
      .slice(0, 5)
      .map((p) => ({ type: 'post', id: p.id, title: p.author, subtitle: p.snippet, icon: '💬' }))
  }

  // 幣種搜尋（主頁 + 幣種頁面）
  return ALL_COINS
    .filter((c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
    .slice(0, 6)
    .map((c) => ({ type: 'coin', symbol: c.symbol, title: c.symbol, subtitle: c.name, icon: '🪙' }))
}
