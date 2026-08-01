import { useState, useCallback } from 'react'
import PostCard from '../components/community/PostCard'
import PostComposer from '../components/community/PostComposer'
import QuestionnaireCard from '../components/community/QuestionnaireCard'
import SentimentGauge from '../components/community/SentimentGauge'
import BountyQuestion from '../components/community/BountyQuestion'
import WhaleAlertCard from '../components/community/WhaleAlertCard'
import StrategyCard from '../components/community/StrategyCard'
import NotificationBanner from '../components/shared/NotificationBanner'
import './CommunityPage.css'

// 模擬當前使用者
const CURRENT_USER = {
  name: '林小明',
  personality: { code: 'ACSI', name: '弄潮兒', axes: { R: 68, E: 30, F: 75, S: 62 } },
  coins: ['BTC', 'ETH', 'SOL'],
}

// 模擬社群貼文資料（增加 verified、winRate、tradeSignal、tips 欄位）
const MOCK_POSTS = [
  {
    id: 1,
    author: '王大壯',
    personality: { code: 'DCLQ', name: '長青樹', axes: { R: 20, E: 25, F: 15, S: 18 } },
    content: '最近 $BTC 有突破 300 萬的趨勢，但我還是會等回測再進場。穩穩的比較好。',
    coin: 'BTC',
    time: '2 小時前',
    likes: 24,
    comments: 7,
    verified: true,
    winRate: 62.1,
    tips: 5,
  },
  {
    id: 2,
    author: '陳Ｊ哥',
    personality: { code: 'AESI', name: '探險家', axes: { R: 82, E: 78, F: 85, S: 70 } },
    content: '剛剛 all-in $SOL，感覺要起飛了🚀\n恐懼指數才 32，別人恐慌我貪婪。',
    coin: 'SOL',
    time: '3 小時前',
    likes: 42,
    comments: 15,
    verified: true,
    winRate: 48.5,
    tradeSignal: { action: 'buy', coin: 'SOL', price: 5420 },
    tips: 12,
  },
  {
    id: 3,
    author: '李小雨',
    personality: { code: 'DELI', name: '造夢者', axes: { R: 25, E: 65, F: 20, S: 72 } },
    content: '最近比較安靜觀望，USDT 放著等好機會。大家覺得 $ETH 現在可以分批買嗎？',
    coin: 'ETH',
    time: '5 小時前',
    likes: 18,
    comments: 9,
    verified: false,
  },
  {
    id: 4,
    author: '趙柏翰',
    personality: { code: 'ACSQ', name: '狙擊手', axes: { R: 75, E: 22, F: 80, S: 15 } },
    content: '這週操作紀錄：\n• $BTC 停利 +8%\n• $SOL 停損 -3%\n• 整體週收益 +4.2%\n\n計畫就是要嚴格執行。',
    coin: null,
    time: '6 小時前',
    likes: 56,
    comments: 12,
    verified: true,
    winRate: 71.3,
    tips: 28,
  },
  {
    id: 5,
    author: '吳芸安',
    personality: { code: 'DCSI', name: '風向球', axes: { R: 30, E: 28, F: 70, S: 65 } },
    content: '$DOGE 社群又在炒了，但看了一下資金流向其實沒有大單進場，小心為上。',
    coin: 'DOGE',
    time: '8 小時前',
    likes: 31,
    comments: 6,
    verified: true,
    winRate: 55.8,
    tradeSignal: { action: 'sell', coin: 'DOGE' },
    tips: 8,
  },
  {
    id: 6,
    author: '黃偉哲',
    personality: { code: 'ACLI', name: '拓荒者', axes: { R: 70, E: 32, F: 22, S: 68 } },
    content: '有沒有人跟我一樣在等 $ADA 的生態利多？技術面看底部已經形成了。',
    coin: 'ADA',
    time: '10 小時前',
    likes: 13,
    comments: 4,
    verified: false,
  },
  {
    id: 7,
    author: '張筱涵',
    personality: { code: 'DELQ', name: '守夜人', axes: { R: 18, E: 60, F: 15, S: 22 } },
    content: '新手問個問題，人格分析裡面的「追漲率」到底是怎麼算的？有人可以解釋嗎？',
    coin: null,
    time: '12 小時前',
    likes: 8,
    comments: 11,
    verified: false,
  },
]

// 模擬懸賞問題
const MOCK_BOUNTIES = [
  {
    id: 101,
    author: '周新手',
    personality: { code: 'DELQ', name: '守夜人', axes: { R: 15, E: 55, F: 10, S: 25 } },
    question: '請問現在 $ETH 適合進場嗎？看了很多分析都說法不一，不知道該相信誰...',
    reward: 10,
    coin: 'ETH',
    answers: 3,
    time: '4 小時前',
  },
]

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

  const handleNewPost = useCallback((newPost) => {
    const post = {
      id: Date.now(),
      author: CURRENT_USER.name,
      personality: CURRENT_USER.personality,
      content: newPost.content,
      coin: newPost.coin,
      time: '剛剛',
      likes: 0,
      comments: 0,
      verified: true,
      winRate: 58.2,
      tips: 0,
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
    }
    feedItems.push(<PostCard key={post.id} post={post} />)
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

      {/* 情緒儀表盤 + 巨鯨警報 */}
      <div className="community-widgets">
        <SentimentGauge posts={posts} />
        <WhaleAlertCard />
      </div>

      <PostComposer onPost={handleNewPost} currentUser={CURRENT_USER} />

      <div className="community-feed">
        {feedItems}
      </div>
    </div>
  )
}
