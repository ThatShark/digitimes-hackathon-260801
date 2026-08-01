const TWD_USD_RATE = 32.5

/**
 * 格式化價格，根據幣值單位顯示（完整數字，不使用 K/M 縮寫）
 * @param {number} priceTWD - 台幣價格
 * @param {'TWD'|'USD'} currency - 顯示幣值
 * @returns {string}
 */
export function formatPrice(priceTWD, currency = 'TWD') {
  if (priceTWD == null) return '—'
  const value = currency === 'USD' ? priceTWD / TWD_USD_RATE : priceTWD
  const prefix = currency === 'USD' ? '$' : 'NT$'
  return `${prefix} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

/**
 * 格式化大數字（允許 K/M/B/T 縮寫），用於市值、成交額等
 * @param {number} priceTWD - 台幣金額
 * @param {'TWD'|'USD'} currency - 顯示幣值
 * @returns {string}
 */
export function formatLargePrice(priceTWD, currency = 'TWD') {
  if (priceTWD == null) return '—'
  const value = currency === 'USD' ? priceTWD / TWD_USD_RATE : priceTWD
  const prefix = currency === 'USD' ? '$' : 'NT$'
  if (value >= 1e12) return `${prefix} ${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `${prefix} ${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${prefix} ${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `${prefix} ${(value / 1e3).toFixed(1)}K`
  return `${prefix} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

/**
 * 取得幣值單位標籤
 */
export function currencyLabel(currency) {
  return currency === 'USD' ? 'USD' : 'TWD'
}

export { TWD_USD_RATE }
