import { useState, useCallback } from 'react'
import PostCard from '../components/community/PostCard'
import PostComposer from '../components/community/PostComposer'
import QuestionnaireCard from '../components/community/QuestionnaireCard'
import SentimentGauge from '../components/community/SentimentGauge'
import BountyQuestion from '../components/community/BountyQuestion'
import WhaleAlertCard from '../components/community/WhaleAlertCard'
import NotificationBanner from '../components/shared/NotificationBanner'
import { MOCK_POSTS, MOCK_BOUNTIES, CURRENT_USER } from '../utils/mockCommunity'
import './CommunityPage.css'

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
    if (index === QUESTIONNAIRE_POSITION) {
      feedItems.push(<QuestionnaireCard key="questionnaire" />)
    }
    if (index === BOUNTY_POSITION) {
      feedItems.push(
        <BountyQuestion key={`bounty-${MOCK_BOUNTIES[0].id}`} bounty={MOCK_BOUNTIES[0]} />
      )
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
