import avatarIcon from '../assets/icon.png'

/**
 * MVP 單人使用 — 目前整個 App 只有一個「使用者」，這裡集中定義他的顯示名稱
 * 與頭像，避免各元件各自寫死名字/頭像造成不一致（之前發生過個人資料頁顯示
 * 一個名字、社群頁顯示另一個名字的問題）。
 *
 * 之後如果要做多人登入機制，這裡就是要換成「讀取目前登入者資料」的地方。
 */
export const CURRENT_USER_NAME = '王大帥'
export const CURRENT_USER_AVATAR = avatarIcon

/**
 * 後端目前沒有登入機制，所有 user_id 相關的 API（/init, /upload_csv,
 * /personality, /portfolio, /trade_history）都需要一個固定的 user_id
 * 來對應 S3 上的 users/{userId}/... 路徑。單人 MVP 直接寫死一個值即可。
 */
export const CURRENT_USER_ID = 'demo-user'

/** 判斷這個名字是否為目前使用者本人（用於決定顯示大頭貼圖片還是字母圓形） */
export function isCurrentUser(name) {
  return name === CURRENT_USER_NAME
}
