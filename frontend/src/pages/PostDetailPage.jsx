import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PersonalityBadge from '../components/shared/PersonalityBadge'
import VerifiedBadge from '../components/community/VerifiedBadge'
import CommentItem from '../components/community/CommentItem'
import CommentComposer from '../components/community/CommentComposer'
import ShareButton from '../components/community/ShareButton'
import Avatar from '../components/shared/Avatar'
import ImageLightbox from '../components/shared/ImageLightbox'
import { parseTickerTags } from '../components/community/TickerCard'
import { MOCK_POSTS, CURRENT_USER } from '../utils/mockCommunity'
import './PostDetailPage.css'

export default function PostDetailPage() {
  const { postId } = useParams()
  const navigate = useNavigate()

  const post = useMemo(() => {
    // 優先從動態貼文列表找（包含使用者新發的），fallback 到 mock 資料
    const livePosts = window.__communityPosts
    if (livePosts && livePosts.length > 0) {
      const found = livePosts.find((p) => String(p.id) === String(postId))
      if (found) return found
    }
    return MOCK_POSTS.find((p) => String(p.id) === String(postId))
  }, [postId])

  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post?.likes || 0)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  // 留言清單 — 樓層依留言時間決定，越早樓層越低（陣列順序 = 樓層順序）
  const [comments, setComments] = useState(post?.commentList || [])

  const handleLike = () => {
    setLiked((prev) => !prev)
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1))
  }

  const handleAddComment = useCallback((content, images) => {
    setComments((prev) => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        floor: prev.length + 1,
        author: CURRENT_USER.name,
        personality: CURRENT_USER.personality,
        content,
        images,
        time: '剛剛',
        likes: 0,
        tips: 0,
      },
    ])
  }, [])

  if (!post) {
    return (
      <div className="post-detail-page">
        <button className="post-detail-back" onClick={() => navigate(-1)}>← 返回</button>
        <p className="post-detail-not-found">找不到這篇貼文。</p>
      </div>
    )
  }

  return (
    <div className="post-detail-page">
      <button className="post-detail-back" onClick={() => navigate(-1)}>← 返回</button>

      {/* 貼文本體 */}
      <article className="post-detail-main">
        <div className="post-card-header">
          <Avatar name={post.author} className="post-avatar" />
          <div className="post-meta">
            <div className="post-author-row">
              <PersonalityBadge personality={post.personality} compact />
              <span className="post-author">{post.author}</span>
              {post.verified && <VerifiedBadge winRate={post.winRate} compact />}
            </div>
            <div className="post-author-row">
              <span className="post-time">{post.time}</span>
              {post.coin && <span className="post-coin-tag">{post.coin}</span>}
            </div>
          </div>
        </div>

        <div className="post-detail-body">
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
                onClick={() => setLightboxIndex(i)}
              />
            ))}
          </div>
        )}

        {lightboxIndex !== null && post.images?.length > 0 && (
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
          <span className="post-action-btn">
            <span className="action-icon">💬</span>
            <span className="action-count">{comments.length}</span>
          </span>
          <ShareButton postId={post.id} />

          {post.coin && (
            <button
              className="post-action-btn ask-ai-btn"
              onClick={() => {
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

      {/* 留言區 */}
      <section className="comment-section">
        <h2 className="comment-section-title">留言 {comments.length}</h2>

        <CommentComposer currentUser={CURRENT_USER} onSubmit={handleAddComment} />

        <div className="comment-list">
          {comments.length === 0 && (
            <div className="comment-empty">還沒有留言，成為第一個留言的人吧！</div>
          )}
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} />
          ))}
        </div>
      </section>
    </div>
  )
}
