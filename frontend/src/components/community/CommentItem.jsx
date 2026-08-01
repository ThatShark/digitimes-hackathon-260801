import { useState } from 'react'
import PersonalityBadge from '../shared/PersonalityBadge'
import Avatar from '../shared/Avatar'
import TipButton from './TipButton'
import { parseTickerTags } from './TickerCard'
import './CommentItem.css'

/**
 * 單則留言（樓層留言，無巢狀回覆）
 *
 * comment: {
 *   id, floor, author, personality, content, images, time, likes, tips
 * }
 */
export default function CommentItem({ comment }) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(comment.likes || 0)

  const handleLike = () => {
    setLiked((prev) => !prev)
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1))
  }

  return (
    <article className="comment-item">
      <div className="comment-floor">{comment.floor}F</div>

      <Avatar name={comment.author} className="comment-avatar" />

      <div className="comment-body-wrapper">
        <div className="comment-header-row">
          <PersonalityBadge personality={comment.personality} compact />
          <span className="comment-author">{comment.author}</span>
          <span className="comment-time">{comment.time}</span>
        </div>

        <div className="comment-text">
          {parseTickerTags(comment.content)}
        </div>

        {comment.images?.length > 0 && (
          <div className={`comment-images comment-images--${Math.min(comment.images.length, 4)}`}>
            {comment.images.map((src, i) => (
              <img key={i} src={src} alt="" className="comment-image" />
            ))}
          </div>
        )}

        <div className="comment-actions">
          <button
            className={`comment-action-btn ${liked ? 'liked' : ''}`}
            onClick={handleLike}
          >
            <span className="action-icon">{liked ? '❤️' : '🤍'}</span>
            <span className="action-count">{likeCount}</span>
          </button>
          <TipButton postId={comment.id} initialTips={comment.tips || 0} />
        </div>
      </div>
    </article>
  )
}
