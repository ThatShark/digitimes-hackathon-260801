import { useState, useCallback, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import PostCard from '../components/community/PostCard'
import PostComposer from '../components/community/PostComposer'
import QuestionnaireCard from '../components/community/QuestionnaireCard'
import SentimentGauge from '../components/community/SentimentGauge'
import BountyQuestion from '../components/community/BountyQuestion'
import WhaleAlertCard from '../components/community/WhaleAlertCard'
import StrategyCard from '../components/community/StrategyCard'
import WellnessCard from '../components/community/WellnessCard'
import NotificationBanner from '../components/shared/NotificationBanner'
import { MOCK_POSTS, MOCK_BOUNTIES, CURRENT_USER } from '../utils/mockCommunity'
import './CommunityPage.css'

// 模擬策略卡片
const MOCK_STRATEGIES = [
  {
    id: 's1',
    type: 'grid',
    author: { name: '趙柏翰', personality: { code: 'ACSQ', name: '狙擊手', axes: { R: 75, E: 22, F: 80, S: 15 } } },
    coin: 'BTC',
    params: { low: '2,700,000', high: '3,000,000', grids: 50, profit: 12.8 },
    stats: { apy: 85.4, runDays: 12, trades: 342, followers: 48 },
    risk: 'medium',
    time: '1 小時前',
    verified: true,
  },
  {
    id: 's2',
    type: 'dca',
    author: { name: '王大壯', personality: { code: 'DCLQ', name: '長青樹', axes: { R: 20, E: 25, F: 15, S: 18 } } },
    coin: 'BTC',
    params: { frequency: '每日', totalReturn: 42 },
    stats: { runDays: 180, followers: 126 },
    risk: 'low',
    time: '3 小時前',
    verified: true,
  },
  {
    id: 's3',
    type: 'martingale',
    author: { name: '陳Ｊ哥', personality: { code: 'AESI', name: '探險家', axes: { R: 82, E: 78, F: 85, S: 70 } } },
    coin: 'ETH',
    params: { dropPct: 2, multiplier: 1.5, maxLayers: 6, takeProfitPct: 1.5 },
    stats: { apy: 62.3, runDays: 28, trades: 89, followers: 35 },
    risk: 'high',
    time: '5 小時前',
    verified: true,
  },
  {
    id: 's4',
    type: 'arbitrage',
    author: { name: '王大壯', personality: { code: 'DCLQ', name: '長青樹', axes: { R: 20, E: 25, F: 15, S: 18 } } },
    coin: 'ETH',
    params: { estApy: 18.5, fundingRate: 0.01 },
    stats: { apy: 18.5, runDays: 60, followers: 92 },
    risk: 'low',
    time: '6 小時前',
    verified: true,
  },
  {
    id: 's5',
    type: 'basket',
    author: { name: '趙柏翰', personality: { code: 'ACSQ', name: '狙擊手', axes: { R: 75, E: 22, F: 80, S: 15 } } },
    coin: 'Multi',
    params: { assets: ['SOL 40%', 'DOT 30%', 'ADA 30%'], rebalanceThreshold: 5, totalReturn: 28.5 },
    stats: { runDays: 45, followers: 67 },
    risk: 'medium',
    time: '8 小時前',
    verified: true,
  },
  {
    id: 's6',
    type: 'signal',
    author: { name: '李小雨', personality: { code: 'DELI', name: '造夢者', axes: { R: 25, E: 65, F: 20, S: 72 } } },
    coin: 'BTC',
    params: { condition: '4H RSI < 30 抄底', winRate: 72 },
    stats: { trades: 50, winRate: 72, followers: 41 },
    risk: 'medium',
    time: '9 小時前',
    verified: true,
  },
]

const TABS = [
  { key: 'recommended', label: '推薦' },
  { key: 'latest', label: '最新' },
  { key: 'trending', label: '熱門' },
]

/**
 * 推薦演算法排序
 * 優先順序：同幣種 > 同人格 > 高互動 > 實盤加權
 */
function rankPosts(posts, user) {
  return [...posts].sort((a, b) => {
    const scoreA = getRecommendScore(a, user)
    const scoreB = getRecommendScore(b, user)
    return scoreB - scoreA
  })
}

function getRecommendScore(post, user) {
  let score = 0
  // 同幣種加權
  if (post.coin && user.coins.includes(post.coin)) {
    score += 30
  }
  // 同人格加權（代碼完全一致 +20, 部分一致按重疊字元數）
  const postCode = post.personality?.code || ''
  const userCode = user.personality?.code || ''
  if (postCode && userCode) {
    if (postCode === userCode) {
      score += 20
    } else {
      const overlap = [...postCode].filter((c, i) => userCode[i] === c).length
      score += overlap * 4
    }
  }
  // 高互動加權
  score += Math.min((post.likes || 0) * 0.3, 15)
  score += Math.min((post.comments || 0) * 0.5, 10)
  // 實盤驗證加權
  if (post.verified) score += 10
  // 打賞多的加權
  score += Math.min((post.tips || 0) * 0.2, 8)
  return score
}

function sortByLatest(posts) {
  return posts
}

function sortByTrending(posts) {
  return [...posts].sort((a, b) => {
    const engagementA = (a.likes || 0) + (a.comments || 0) * 2 + (a.tips || 0) * 3
    const engagementB = (b.likes || 0) + (b.comments || 0) * 2 + (b.tips || 0) * 3
    return engagementB - engagementA
  })
}

// 插入特殊卡片的位置
const QUESTIONNAIRE_POSITION = 3
const BOUNTY_POSITION = 5

export default function CommunityPage() {
  const [posts, setPosts] = useState(MOCK_POSTS)
  const [activeTab, setActiveTab] = useState('recommended')
  const location = useLocation()

  // 從搜尋結果跳轉過來時，滾動到指定貼文
  useEffect(() => {
    if (location.hash) {
      const el = document.querySelector(location.hash)
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
        el.classList.add('highlight')
        setTimeout(() => el.classList.remove('highlight'), 2000)
      }
    }
  }, [location.hash])

  const handleNewPost = useCallback((newPost) => {
    const post = {
      id: Date.now(),
      author: CURRENT_USER.name,
      personality: CURRENT_USER.personality,
      content: newPost.content,
      images: [],
      coin: newPost.coin,
      time: '剛剛',
      likes: 0,
      comments: 0,
      verified: true,
      winRate: 58.2,
      tips: 0,
      commentList: [],
    }
    setPosts((prev) => [post, ...prev])
  }, [])

  // 根據 tab 決定排序
  let sortedPosts
  switch (activeTab) {
    case 'latest':
      sortedPosts = sortByLatest(posts)
      break
    case 'trending':
      sortedPosts = sortByTrending(posts)
      break
    case 'recommended':
    default:
      sortedPosts = rankPosts(posts, CURRENT_USER)
      break
  }

  // 插入特殊卡片到 feed 中
  const feedItems = []
  sortedPosts.forEach((post, index) => {
    if (index === 2) {
      feedItems.push(<StrategyCard key={`strategy-${MOCK_STRATEGIES[0].id}`} strategy={MOCK_STRATEGIES[0]} />)
    }
    if (index === QUESTIONNAIRE_POSITION) {
      feedItems.push(<QuestionnaireCard key="questionnaire" />)
    }
    if (index === 4) {
      feedItems.push(<StrategyCard key={`strategy-${MOCK_STRATEGIES[1].id}`} strategy={MOCK_STRATEGIES[1]} />)
    }
    if (index === BOUNTY_POSITION) {
      feedItems.push(
        <BountyQuestion key={`bounty-${MOCK_BOUNTIES[0].id}`} bounty={MOCK_BOUNTIES[0]} />
      )
    }
    if (index === 6) {
      feedItems.push(<StrategyCard key={`strategy-${MOCK_STRATEGIES[2].id}`} strategy={MOCK_STRATEGIES[2]} />)
      feedItems.push(<WellnessCard key="wellness" />)
    }
    feedItems.push(
      <div key={post.id} id={`post-${post.id}`}>
        <PostCard post={post} />
      </div>
    )
  })
  // 如果貼文數不足，附加在最後
  if (sortedPosts.length <= QUESTIONNAIRE_POSITION) {
    feedItems.push(<QuestionnaireCard key="questionnaire" />)
  }
  if (sortedPosts.length <= BOUNTY_POSITION) {
    feedItems.push(
      <BountyQuestion key={`bounty-${MOCK_BOUNTIES[0].id}`} bounty={MOCK_BOUNTIES[0]} />
    )
  }

  return (
    <div className="community-page">
      {/* 通知條 */}
      <NotificationBanner />

      <div className="community-header">
        <h1 className="community-title">社群</h1>
        <div className="community-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`community-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 情緒儀表盤（按幣種分類） */}
      <div className="sentiment-multi">
        {['BTC', 'ETH', 'SOL', 'DOGE'].map((coin) => (
          <SentimentGauge key={coin} posts={posts} coin={coin} />
        ))}
      </div>

      {/* 巨鯨警報 */}
      <WhaleAlertCard />

      <PostComposer onPost={handleNewPost} currentUser={CURRENT_USER} />

      <div className="community-feed">
        {feedItems}
      </div>
    </div>
  )
}
