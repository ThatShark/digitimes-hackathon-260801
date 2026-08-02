import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PersonalityBadge from '../shared/PersonalityBadge'
import ImageLightbox from '../shared/ImageLightbox'
import { CURRENT_USER_NAME } from '../../utils/currentUser'
import './BountyQuestion.css'

/**
 * 懸賞提問卡片
 * 顯示在社群 feed 中，使用者可以提問並收到社群回答
 * 回答按愛心數由高到低排列，自己的回答也會顯示在列表中
 *
 * @param {object} props
 * @param {object} props.bounty - { id, author, personality, question, coin, answers, time }
 */
export default function BountyQuestion({ bounty }) {
  const [showAnswers, setShowAnswers] = useState(false)
  const [showAnswerInput, setShowAnswerInput] = useState(false)
  const [answerText, setAnswerText] = useState('')
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const navigate = useNavigate()

  // 只有原始 mock 懸賞才顯示預設回答，使用者新發的懸賞從空列表開始
  const isUserBounty = bounty.author === CURRENT_USER_NAME
  const [answerList, setAnswerList] = useState(() => {
    if (isUserBounty) return []
    return [
      { id: 1, author: '趙柏翰', content: '目前 ETH 處於盤整期，建議等突破 2,800 再考慮進場，或者分批小額買入降低成本。', time: '3 小時前', likes: 8 },
      { id: 2, author: '王大壯', content: '從資金流向來看大單偏買，但恐懼貪婪指數偏中性，我個人會小倉位試探。', time: '2 小時前', likes: 5 },
      { id: 3, author: '陳Ｊ哥', content: '看日線 RSI 已經超賣回彈，技術面支撐在 2,650 附近，可以設好停損進場。', time: '1 小時前', likes: 12 },
    ]
  })
  const [likedIds, setLikedIds] = useState(new Set())

  const handleSubmitAnswer = () => {
    if (!answerText.trim()) return
    const newAnswer = {
      id: Date.now(),
      author: CURRENT_USER_NAME,
      content: answerText.trim(),
      time: '剛剛',
      likes: 0,
    }
    setAnswerList((prev) => [...prev, newAnswer])
    setShowAnswerInput(false)
    setAnswerText('')
    setShowAnswers(true)
  }

  const handleLikeAnswer = (answerId) => {
    setLikedIds((prev) => {
      const next = new Set(prev)
      if (next.has(answerId)) {
        next.delete(answerId)
      } else {
        next.add(answerId)
      }
      return next
    })
    setAnswerList((prev) =>
      prev.map((a) =>
        a.id === answerId
          ? { ...a, likes: likedIds.has(answerId) ? a.likes - 1 : a.likes + 1 }
          : a
      )
    )
  }

  // 按愛心數由高到低排序
  const sortedAnswers = [...answerList].sort((a, b) => b.likes - a.likes)

  const hasSubmitted = answerList.some((a) => a.author === CURRENT_USER_NAME)

  return (
    <div className="bounty-card">
      <div className="bounty-header">
        <span className="bounty-tag">❓ 懸賞提問</span>
      </div>

      <div className="bounty-author-row">
        <div className="bounty-avatar">{bounty.author.charAt(0)}</div>
        <PersonalityBadge personality={bounty.personality} compact />
        <span className="bounty-author-name">{bounty.author}</span>
        <span className="bounty-time">{bounty.time}</span>
      </div>

      <p className="bounty-question">{bounty.question}</p>

      {bounty.images?.length > 0 && (
        <div className="bounty-images">
          {bounty.images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              className="bounty-image"
              onClick={() => setLightboxIndex(i)}
            />
          ))}
        </div>
      )}

      {lightboxIndex !== null && bounty.images?.length > 0 && (
        <ImageLightbox
          images={bounty.images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {bounty.coin && (
        <span className="bounty-coin-tag">{bounty.coin}</span>
      )}

      <div className="bounty-footer">
        <button
          className="bounty-view-answers-btn"
          onClick={() => setShowAnswers(!showAnswers)}
        >
          {showAnswers ? '收起回答' : answerList.length > 0 ? `查看 ${answerList.length} 個回答` : '尚無回答'}
        </button>

        {bounty.coin && (
          <button
            className="bounty-ask-ai-btn"
            onClick={() => {
              const prompt = `社群有人懸賞提問關於 ${bounty.coin}，提問者是 ${bounty.author}，問題是：「${bounty.question.slice(0, 120)}」\n請幫我分析這個問題，你有什麼看法？`
              const attachment = JSON.stringify({
                type: 'post_card',
                author: bounty.author,
                content: bounty.question,
                action: null,
                coin: bounty.coin,
              })
              sessionStorage.setItem('ai_chat_prefill', '請幫我分析這則懸賞提問，你有什麼看法？')
              sessionStorage.setItem('ai_chat_prompt', prompt)
              sessionStorage.setItem('ai_chat_attachment', attachment)
              sessionStorage.setItem('ai_chat_auto_send', 'true')
              navigate(`/coin/${bounty.coin}`)
              window.scrollTo(0, 0)
            }}
            title="詢問 AI 建議"
          >
            🤖 詢問AI建議
          </button>
        )}

        {!hasSubmitted ? (
          <button
            className="bounty-answer-btn"
            onClick={() => setShowAnswerInput(!showAnswerInput)}
          >
            我來回答
          </button>
        ) : (
          <span className="bounty-answered">✓ 已回答</span>
        )}
      </div>

      {/* 回答列表（按愛心排序） */}
      {showAnswers && (
        <div className="bounty-answers-list">
          {sortedAnswers.map((answer) => {
            const isOwn = answer.author === CURRENT_USER_NAME
            const isLiked = likedIds.has(answer.id)
            return (
              <div key={answer.id} className={`bounty-answer-item ${isOwn ? 'own' : ''}`}>
                <div className="bounty-answer-header">
                  <span className="bounty-answer-author">
                    {answer.author}
                    {isOwn && <span className="bounty-own-tag">（你）</span>}
                  </span>
                  <span className="bounty-answer-time">{answer.time}</span>
                </div>
                <p className="bounty-answer-content">{answer.content}</p>
                <button
                  className={`bounty-answer-like-btn ${isLiked ? 'liked' : ''}`}
                  onClick={() => handleLikeAnswer(answer.id)}
                >
                  <span>{isLiked ? '❤️' : '🤍'}</span>
                  <span className="bounty-answer-like-count">{answer.likes}</span>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* 回答輸入區 */}
      {showAnswerInput && !hasSubmitted && (
        <div className="bounty-answer-area">
          <textarea
            className="bounty-answer-input"
            placeholder="分享你的見解..."
            rows={3}
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
          />
          <button className="bounty-submit-btn" onClick={handleSubmitAnswer}>
            提交回答
          </button>
        </div>
      )}
    </div>
  )
}
