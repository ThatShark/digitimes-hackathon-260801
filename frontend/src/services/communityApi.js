/**
 * /community/* 與 /tipping — 對應 backend/api.yaml Community 相關端點
 */
import { apiFetch } from './api'

/** 取得社群動態（演算法排序） */
export function getCommunityFeed({ cursor, limit = 20 } = {}) {
  const params = new URLSearchParams({ limit: String(limit), ...(cursor ? { cursor } : {}) })
  return apiFetch(`/community/feed?${params}`)
}

/** 發布新貼文 */
export function createPost({ content, images = [], currency_tags = [] }) {
  return apiFetch('/community/post', {
    method: 'POST',
    body: { content, images, currency_tags },
  })
}

/** 貼文按讚/取消讚 */
export function togglePostLike(postId) {
  return apiFetch(`/community/post/${postId}/like`, { method: 'POST' })
}

/** 留言按讚/取消讚 */
export function toggleCommentLike(postId, commentId) {
  return apiFetch(`/community/post/${postId}/comments/${commentId}/like`, {
    method: 'POST',
  })
}

/** 取得貼文留言（樓層列表） */
export function getPostComments(postId, { cursor, limit = 20 } = {}) {
  const params = new URLSearchParams({ limit: String(limit), ...(cursor ? { cursor } : {}) })
  return apiFetch(`/community/post/${postId}/comments?${params}`)
}

/** 新增留言 */
export function addComment(postId, content, images = []) {
  return apiFetch(`/community/post/${postId}/comments`, {
    method: 'POST',
    body: { content, images },
  })
}

/**
 * 打賞貼文或留言
 * @param {'post'|'comment'} targetType
 * @param {string} targetId
 * @param {number} amount
 */
export function sendTip(targetType, targetId, amount) {
  return apiFetch('/tipping', {
    method: 'POST',
    body: { target_type: targetType, target_id: targetId, amount },
  })
}
