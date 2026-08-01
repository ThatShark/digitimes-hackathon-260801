const TWD_USD_RATE = 32.5

/**
 * 格式化價格，根據幣值單位顯示
 * @param {number} priceTWD - 台幣價格
 * @param {'TWD'|'USD'} currency - 顯示幣值
 * @returns {string}
 */
export function formatPrice(priceTWD, currency = 'TWD') {
  if (priceTWD == null) return '—'
  const value = currency === 'USD' ? priceTWD / TWD_USD_RATE : priceTWD
  const prefix = currency === 'USD' ? '$' : 'NT$'
  const decimals = currency === 'USD' ? 2 : 0
  return `${prefix} ${value.toLocaleString(undefined, { maximumFractionDigits: decimals })}`
}

/**
 * 取得幣值單位標籤
 */
export function currencyLabel(currency) {
  return currency === 'USD' ? 'USD' : 'TWD'
}

export { TWD_USD_RATE }
