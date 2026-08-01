import { CURRENT_USER_AVATAR, isCurrentUser } from '../../utils/currentUser'
import './Avatar.css'

/**
 * 通用頭像元件。
 * - 如果 name 是目前使用者本人 -> 顯示真實頭像圖片（icon.png）
 * - 其他人（mock 使用者）-> 沿用原本的「名字首字」字母圓形
 *
 * className 沿用呼叫端既有的樣式 class（例如 post-avatar、comment-avatar），
 * 該 class 已經定義好 width/height/border-radius，這裡只需額外補上
 * object-fit: cover 讓圖片正確裁切填滿。
 */
export default function Avatar({ name, className = '' }) {
  if (isCurrentUser(name)) {
    return <img src={CURRENT_USER_AVATAR} alt={name} className={`avatar-img ${className}`} />
  }
  return <div className={className}>{name ? name.charAt(0) : '?'}</div>
}
