import { useState } from 'react'
import PersonalityBadge from '../shared/PersonalityBadge'
import VerifiedBadge from './VerifiedBadge'
import TipButton from './TipButton'
import CopyTradeButton from './CopyTradeButton'
import { parseTickerTags } from './TickerCard'
import './PostCard.css'

// 模擬當前用戶人格（用於跟單風險比對）
const CURRENT_USER_PERSONALITY = {
  code: 'ACSI',
  name: '弄潮兒',
  axes: { R: 68, E: 30, F: 75, S: 62 },
}

/**
 * 單篇社群貼文卡片
 * post: { id, author, personality, content, coin, time, likes, comments,
 *          verified, winRate, tradeSignal, tips }
 */
export default function PostCard({ post }) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post.likes || 0)

  const handleLike = () => {
    setLiked((prev) => !prev)
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1))
  }

  return (
    <article className="post-card">
      <div className="post-card-header">
        <div className="post-avatar">{post.author.charAt(0)}</div>
        <div className="post-meta">
          <div className="post-author-row">
            <PersonalityBadge personality={post.personality} compact />
            <span className="post-author">{post.author}</span>
            {post.verified && (
              <VerifiedBadge winRate={post.winRate} compact />
            )}
          </div>
          <div className="post-author-row">
            <span className="post-time">{post.time}</span>
            {post.coin && <span className="post-coin-tag">{post.coin}</span>}
          </div>
        </div>
      </div>

      <div className="post-card-body">
        {parseTickerTags(post.content)}
      </div>

      {/* 跟單按鈕 — 僅在有交易信號時顯示 */}
      {post.tradeSignal && (
        <CopyTradeButton
          tradeSignal={post.tradeSignal}
          authorName={post.author}
          authorPersonality={post.personality}
          userPersonality={CURRENT_USER_PERSONALITY}
        />
      )}

      <div className="post-card-footer">
        <button
          className={`post-action-btn ${liked ? 'liked' : ''}`}
          onClick={handleLike}
        >
          <span className="action-icon">{liked ? '❤️' : '🤍'}</span>
          <span className="action-count">{likeCount}</span>
        </button>
        <button className="post-action-btn">
          <span className="action-icon">💬</span>
          <span className="action-count">{post.comments || 0}</span>
        </button>
        <TipButton postId={post.id} initialTips={post.tips || 0} />
        <button className="post-action-btn">
          <span className="action-icon">🔗</span>
        </button>
      </div>
    </article>
  )
}
