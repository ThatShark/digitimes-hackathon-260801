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

/** 判斷這個名字是否為目前使用者本人（用於決定顯示大頭貼圖片還是字母圓形） */
export function isCurrentUser(name) {
  return name === CURRENT_USER_NAME
}
