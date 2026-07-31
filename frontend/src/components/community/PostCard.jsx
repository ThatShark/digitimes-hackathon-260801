import { useState } from 'react'
import PersonalityBadge from '../shared/PersonalityBadge'
import './PostCard.css'

/**
 * 單篇社群貼文卡片
 * post: { id, author, personality, content, coin, time, likes, comments }
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
          </div>
          <div className="post-author-row">
            <span className="post-time">{post.time}</span>
            {post.coin && <span className="post-coin-tag">{post.coin}</span>}
          </div>
        </div>
      </div>

      <div className="post-card-body">{post.content}</div>

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
        <button className="post-action-btn">
          <span className="action-icon">🔗</span>
        </button>
      </div>
    </article>
  )
}
