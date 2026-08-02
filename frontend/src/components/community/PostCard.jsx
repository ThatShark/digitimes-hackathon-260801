import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PersonalityBadge from '../shared/PersonalityBadge'
import VerifiedBadge from './VerifiedBadge'
import { parseTickerTags } from './TickerCard'
import ShareButton from './ShareButton'
import Avatar from '../shared/Avatar'
import ImageLightbox from '../shared/ImageLightbox'
import './PostCard.css'

/**
 * 單篇社群貼文卡片
 * post: { id, author, personality, content, images, coin, time, likes, comments,
 *          verified, winRate, tips }
 *
 * 點擊卡片本身（非動作按鈕）會導航到貼文詳情頁 /community/post/:postId
 */
export default function PostCard({ post }) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post.likes || 0)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const navigate = useNavigate()

  const handleLike = (e) => {
    e.stopPropagation()
    setLiked((prev) => !prev)
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1))
  }

  const goToDetail = () => navigate(`/community/post/${post.id}`)

  return (
    <article className="post-card" onClick={goToDetail}>
      <div className="post-card-header">
        <Avatar name={post.author} className="post-avatar" />
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
            <img
              key={i}
              src={src}
              alt=""
              className="post-image"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(i) }}
            />
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <ImageLightbox
          images={post.images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
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
        <button className="post-action-btn" onClick={goToDetail}>
          <span className="action-icon">💬</span>
          <span className="action-count">{post.comments || 0}</span>
        </button>

        <ShareButton postId={post.id} />

        {post.coin && (
          <button
            className="post-action-btn ask-ai-btn"
            onClick={(e) => {
              e.stopPropagation()
              const prompt = `我在社群看到一則關於 ${post.coin} 的貼文，作者是 ${post.author}，內容是：「${post.content.slice(0, 120)}」\n請幫我分析這個觀點，你有什麼看法？`
              const attachment = JSON.stringify({
                type: 'post_card',
                author: post.author,
                content: post.content,
                action: null,
                coin: post.coin,
              })
              sessionStorage.setItem('ai_chat_prefill', '請幫我分析這則社群貼文，你有什麼看法？')
              sessionStorage.setItem('ai_chat_prompt', prompt)
              sessionStorage.setItem('ai_chat_attachment', attachment)
              sessionStorage.setItem('ai_chat_auto_send', 'true')
              navigate(`/coin/${post.coin}`)
              window.scrollTo(0, 0)
            }}
            title="詢問 AI 建議"
          >
            <span className="action-icon">🤖</span>
            <span className="action-label">詢問AI建議</span>
          </button>
        )}
      </div>
    </article>
  )
}
