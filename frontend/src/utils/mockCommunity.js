import { getUserPersonality } from './userPersonality'

/**
 * 共用的社群模擬資料 — CommunityPage（列表）與 PostDetailPage（詳情+留言）
 * 共用同一份來源，確保兩邊顯示的貼文內容一致。
 */

// 當前使用者（人格從 localStorage 動態讀取）
export const CURRENT_USER = {
  name: '林小明',
  get personality() { return getUserPersonality() },
  coins: ['BTC', 'ETH', 'SOL'],
}

// Placeholder 圖片（demo 用）
const IMG = (seed) => `https://picsum.photos/seed/${seed}/480/320`

// 模擬社群貼文資料
export const MOCK_POSTS = [
  {
    id: 1,
    author: '王大壯',
    personality: { code: 'DCLQ', name: '長青樹', axes: { R: 20, E: 25, F: 15, S: 18 } },
    content: '最近 $BTC 有突破 300 萬的趨勢，但我還是會等回測再進場。穩穩的比較好。',
    images: [IMG('btc1')],
    coin: 'BTC',
    time: '2 小時前',
    likes: 24,
    comments: 3,
    verified: true,
    winRate: 62.1,
    tips: 5,
    commentList: [
      {
        id: 'c1-1', floor: 1, author: '陳Ｊ哥',
        personality: { code: 'AESI', name: '探險家', axes: { R: 82, E: 78, F: 85, S: 70 } },
        content: '同意，回測是比較穩的策略', images: [], time: '1 小時前', likes: 3, tips: 0,
      },
      {
        id: 'c1-2', floor: 2, author: '李小雨',
        personality: { code: 'DELI', name: '造夢者', axes: { R: 25, E: 65, F: 20, S: 72 } },
        content: '請問回測通常等多久？', images: [], time: '45 分鐘前', likes: 1, tips: 0,
      },
      {
        id: 'c1-3', floor: 3, author: '王大壯',
        personality: { code: 'DCLQ', name: '長青樹', axes: { R: 20, E: 25, F: 15, S: 18 } },
        content: '看量能，通常 1-3 天。附上剛剛截的圖', images: [IMG('btc1-reply')], time: '30 分鐘前', likes: 6, tips: 2,
      },
    ],
  },
  {
    id: 2,
    author: '陳Ｊ哥',
    personality: { code: 'AESI', name: '探險家', axes: { R: 82, E: 78, F: 85, S: 70 } },
    content: '剛剛 all-in $SOL，感覺要起飛了🚀\n恐懼指數才 32，別人恐慌我貪婪。',
    images: [],
    coin: 'SOL',
    time: '3 小時前',
    likes: 42,
    comments: 2,
    verified: true,
    winRate: 48.5,
    tradeSignal: { action: 'buy', coin: 'SOL', price: 5420 },
    tips: 12,
    commentList: [
      {
        id: 'c2-1', floor: 1, author: '趙柏翰',
        personality: { code: 'ACSQ', name: '狙擊手', axes: { R: 75, E: 22, F: 80, S: 15 } },
        content: '小心槓桿，別 all-in 啊', images: [], time: '2 小時前', likes: 8, tips: 1,
      },
      {
        id: 'c2-2', floor: 2, author: '吳芸安',
        personality: { code: 'DCSI', name: '風向球', axes: { R: 30, E: 28, F: 70, S: 65 } },
        content: '你的風險軸跟我差好多 哈哈', images: [], time: '1 小時前', likes: 4, tips: 0,
      },
    ],
  },
  {
    id: 3,
    author: '李小雨',
    personality: { code: 'DELI', name: '造夢者', axes: { R: 25, E: 65, F: 20, S: 72 } },
    content: '最近比較安靜觀望，USDT 放著等好機會。大家覺得 $ETH 現在可以分批買嗎？',
    images: [],
    coin: 'ETH',
    time: '5 小時前',
    likes: 18,
    comments: 0,
    verified: false,
    commentList: [],
  },
  {
    id: 4,
    author: '趙柏翰',
    personality: { code: 'ACSQ', name: '狙擊手', axes: { R: 75, E: 22, F: 80, S: 15 } },
    content: '這週操作紀錄：\n• $BTC 停利 +8%\n• $SOL 停損 -3%\n• 整體週收益 +4.2%\n\n計畫就是要嚴格執行。',
    images: [IMG('report1'), IMG('report2')],
    coin: null,
    time: '6 小時前',
    likes: 56,
    comments: 1,
    verified: true,
    winRate: 71.3,
    tips: 28,
    commentList: [
      {
        id: 'c4-1', floor: 1, author: '黃偉哲',
        personality: { code: 'ACLI', name: '拓荒者', axes: { R: 70, E: 32, F: 22, S: 68 } },
        content: '紀律滿分，佩服', images: [], time: '4 小時前', likes: 12, tips: 3,
      },
    ],
  },
  {
    id: 5,
    author: '吳芸安',
    personality: { code: 'DCSI', name: '風向球', axes: { R: 30, E: 28, F: 70, S: 65 } },
    content: '$DOGE 社群又在炒了，但看了一下資金流向其實沒有大單進場，小心為上。',
    images: [],
    coin: 'DOGE',
    time: '8 小時前',
    likes: 31,
    comments: 0,
    verified: true,
    winRate: 55.8,
    tradeSignal: { action: 'sell', coin: 'DOGE' },
    tips: 8,
    commentList: [],
  },
  {
    id: 6,
    author: '黃偉哲',
    personality: { code: 'ACLI', name: '拓荒者', axes: { R: 70, E: 32, F: 22, S: 68 } },
    content: '有沒有人跟我一樣在等 $ADA 的生態利多？技術面看底部已經形成了。',
    images: [],
    coin: 'ADA',
    time: '10 小時前',
    likes: 13,
    comments: 0,
    verified: false,
    commentList: [],
  },
  {
    id: 7,
    author: '張筱涵',
    personality: { code: 'DELQ', name: '守夜人', axes: { R: 18, E: 60, F: 15, S: 22 } },
    content: '新手問個問題，人格分析裡面的「追漲率」到底是怎麼算的？有人可以解釋嗎？',
    images: [],
    coin: null,
    time: '12 小時前',
    likes: 8,
    comments: 1,
    verified: false,
    commentList: [
      {
        id: 'c7-1', floor: 1, author: CURRENT_USER.name,
        personality: CURRENT_USER.personality,
        content: '簡單說就是你買在相對高點的頻率，越常追高數值越高', images: [], time: '10 小時前', likes: 5, tips: 1,
      },
    ],
  },
]

// 模擬懸賞問題
export const MOCK_BOUNTIES = [
  {
    id: 101,
    author: '周新手',
    personality: { code: 'DELQ', name: '守夜人', axes: { R: 15, E: 55, F: 10, S: 25 } },
    question: '請問現在 $ETH 適合進場嗎？看了很多分析都說法不一，不知道該相信誰...',
    reward: 10,
    coin: 'ETH',
    answers: 3,
    time: '4 小時前',
  },
]
