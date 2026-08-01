import PostCard from '../community/PostCard'
import SentimentGauge from '../community/SentimentGauge'
import './CoinSocialFeed.css'

// 從社群抓取的貼文（mock：跟 CommunityPage 同步的資料）
const ALL_POSTS = [
  {
    id: 1,
    author: '王大壯',
    personality: { code: 'DCLQ', name: '長青樹', axes: { R: 20, E: 25, F: 15, S: 18 } },
    content: '最近 $BTC 有突破 300 萬的趨勢，但我還是會等回測再進場。穩穩的比較好。',
    coin: 'BTC',
    time: '2 小時前',
    likes: 24,
    comments: 7,
    verified: true,
    winRate: 62.1,
    tips: 5,
  },
  {
    id: 2,
    author: '陳Ｊ哥',
    personality: { code: 'AESI', name: '探險家', axes: { R: 82, E: 78, F: 85, S: 70 } },
    content: '剛剛 all-in $SOL，感覺要起飛了🚀\n恐懼指數才 32，別人恐慌我貪婪。',
    coin: 'SOL',
    time: '3 小時前',
    likes: 42,
    comments: 15,
    verified: true,
    winRate: 48.5,
    tradeSignal: { action: 'buy', coin: 'SOL', price: 5420 },
    tips: 12,
  },
  {
    id: 3,
    author: '李小雨',
    personality: { code: 'DELI', name: '造夢者', axes: { R: 25, E: 65, F: 20, S: 72 } },
    content: '最近比較安靜觀望，USDT 放著等好機會。大家覺得 $ETH 現在可以分批買嗎？',
    coin: 'ETH',
    time: '5 小時前',
    likes: 18,
    comments: 9,
    verified: false,
  },
  {
    id: 5,
    author: '吳芸安',
    personality: { code: 'DCSI', name: '風向球', axes: { R: 30, E: 28, F: 70, S: 65 } },
    content: '$DOGE 社群又在炒了，但看了一下資金流向其實沒有大單進場，小心為上。',
    coin: 'DOGE',
    time: '8 小時前',
    likes: 31,
    comments: 6,
    verified: true,
    winRate: 55.8,
    tradeSignal: { action: 'sell', coin: 'DOGE' },
    tips: 8,
  },
  {
    id: 6,
    author: '黃偉哲',
    personality: { code: 'ACLI', name: '拓荒者', axes: { R: 70, E: 32, F: 22, S: 68 } },
    content: '有沒有人跟我一樣在等 $ADA 的生態利多？技術面看底部已經形成了。',
    coin: 'ADA',
    time: '10 小時前',
    likes: 13,
    comments: 4,
    verified: false,
  },
  {
    id: 8,
    author: '趙柏翰',
    personality: { code: 'ACSQ', name: '狙擊手', axes: { R: 75, E: 22, F: 80, S: 15 } },
    content: '$BTC 短線壓力在 290 萬，如果突破放量可以追。目前先觀望。',
    coin: 'BTC',
    time: '1 小時前',
    likes: 38,
    comments: 14,
    verified: true,
    winRate: 71.3,
    tips: 15,
  },
  {
    id: 9,
    author: '陳Ｊ哥',
    personality: { code: 'AESI', name: '探險家', axes: { R: 82, E: 78, F: 85, S: 70 } },
    content: '$ETH 鏈上 gas fee 暴降，Layer2 活動量大增，利多訊號明顯。',
    coin: 'ETH',
    time: '4 小時前',
    likes: 29,
    comments: 8,
    verified: true,
    winRate: 48.5,
    tips: 6,
  },
]

/**
 * 幣種動態 — 從社群抓取該幣種相關貼文
 */
export default function CoinSocialFeed({ symbol }) {
  // 篩選該幣種相關貼文（coin 欄位匹配 或 內容包含 $SYMBOL）
  const filteredPosts = ALL_POSTS.filter(
    (post) =>
      post.coin === symbol ||
      post.content.includes(`$${symbol}`)
  )

  return (
    <div className="coin-social-feed">
      {/* 情緒儀表 */}
      <SentimentGauge posts={ALL_POSTS} coin={symbol} />

      <h3 className="feed-section-title">
        {symbol} 相關討論 ({filteredPosts.length})
      </h3>

      {filteredPosts.length === 0 ? (
        <div className="feed-empty">
          目前沒有關於 {symbol} 的社群貼文
        </div>
      ) : (
        <div className="feed-list">
          {filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
