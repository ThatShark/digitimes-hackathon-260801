/**
 * 共用的模擬聊天資料 — 彈幕與聊天室共用同一份來源，
 * 確保兩邊顯示的內容完全一致。
 */
import { getUserPersonality } from './userPersonality'

export const MOCK_COMMUNITY_USERS = [
  { name: '王大壯', personality: { code: 'DCLQ', name: '長青樹', axes: { R: 20, E: 25, F: 15, S: 18 } } },
  { name: '陳Ｊ哥', personality: { code: 'AESI', name: '探險家', axes: { R: 82, E: 78, F: 85, S: 70 } } },
  { name: '李小雨', personality: { code: 'DELI', name: '造夢者', axes: { R: 25, E: 65, F: 20, S: 72 } } },
  { name: '趙柏翰', personality: { code: 'ACSQ', name: '狙擊手', axes: { R: 75, E: 22, F: 80, S: 15 } } },
  { name: '吳芸安', personality: { code: 'DCSI', name: '守望者', axes: { R: 30, E: 28, F: 72, S: 60 } } },
  { name: '黃偉哲', personality: { code: 'AELQ', name: '衝浪手', axes: { R: 78, E: 70, F: 25, S: 20 } } },
]

export const MOCK_CHAT_TEXTS = [
  '支撐位在 282 萬附近',
  '看多🚀',
  '剛加倉了一些',
  '量能不太夠啊',
  '等突破再說',
  '穩穩抱住就好',
  '有人知道為什麼突然漲了嗎',
  '恐懼指數還很低 可以衝',
  '小心追高',
  '底部確認了嗎',
  '我覺得還會再跌',
  'BTC 要起飛了吧',
  '剛剛進場 SOL',
  '停損設好就不怕',
  'ETH 看起來要突破了',
  '大家小心槓桿',
  '剛獲利了結一半',
  '穩定幣先放著觀望',
]

/** 目前使用者（人格從 localStorage 動態讀取） */
export const ME_USER = {
  name: '我',
  get personality() { return getUserPersonality() },
}

/** 隨機挑一則模擬訊息 */
export function pickRandomMockMessage() {
  const user = MOCK_COMMUNITY_USERS[Math.floor(Math.random() * MOCK_COMMUNITY_USERS.length)]
  const text = MOCK_CHAT_TEXTS[Math.floor(Math.random() * MOCK_CHAT_TEXTS.length)]
  return { user, text }
}
