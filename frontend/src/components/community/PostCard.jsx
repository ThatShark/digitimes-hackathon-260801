import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PersonalityBadge from '../shared/PersonalityBadge'
import VerifiedBadge from './VerifiedBadge'
import TipButton from './TipButton'
import CopyTradeButton from './CopyTradeButton'
import { parseTickerTags } from './TickerCard'
import ShareButton from './ShareButton'
import './PostCard.css'

// 模擬當前用戶人格（用於跟單風險比對）
const CURRENT_USER_PERSONALITY = {
  code: 'ACSI',
  name: '弄潮兒',
  axes: { R: 68, E: 30, F: 75, S: 62 },
}

/**
 * 單篇社群貼文卡片
 * post: { id, author, personality, content, images, coin, time, likes, comments,
 *          verified, winRate, tradeSignal, tips }
 *
 * 點擊卡片本身（非動作按鈕）會導航到貼文詳情頁 /community/post/:postId
 */
export default function PostCard({ post }) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post.likes || 0)
  const navigate = useNavigate()

  const handleLike = (e) => {
    e.stopPropagation()
    setLiked((prev) => !prev)
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1))
  }

  const goToDetail = () => navigate(`/community/post/${post.id}`)

  const stop = (e) => e.stopPropagation()

  return (
    <article className="post-card" onClick={goToDetail}>
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

      {post.images?.length > 0 && (
        <div className={`post-images post-images--${Math.min(post.images.length, 4)}`}>
          {post.images.map((src, i) => (
            <img key={i} src={src} alt="" className="post-image" />
          ))}
        </div>
      )}

      {/* 跟單按鈕 — 僅在有交易信號時顯示 */}
      {post.tradeSignal && (
        <div onClick={stop}>
          <CopyTradeButton
            tradeSignal={post.tradeSignal}
            authorName={post.author}
            authorPersonality={post.personality}
            userPersonality={CURRENT_USER_PERSONALITY}
          />
        </div>
      )}

      <div className="post-card-footer">
        <button
          className={`post-action-btn ${liked ? 'liked' : ''}`}
          onClick={handleLike}
        >
          <span className="action-icon">{liked ? '❤️' : '🤍'}</span>
          <span className="action-count">{likeCount}</span>
        </button>
        <button className="post-action-btn" onClick={goToDetail}>
          <span className="action-icon">💬</span>
          <span className="action-count">{post.comments || 0}</span>
        </button>
        <span onClick={stop}>
          <TipButton postId={post.id} initialTips={post.tips || 0} />
        </span>
        <ShareButton postId={post.id} />
      </div>
    </article>
  )
}
