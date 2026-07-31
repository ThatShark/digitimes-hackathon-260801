/**
 * Technical indicator calculations.
 * Input: candles array with { time, open, high, low, close, volume? }
 * Output: arrays of { time, value } for line series rendering.
 */

// Simple Moving Average
export function calcMA(candles, period = 20) {
  const result = []
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += candles[j].close
    }
    result.push({ time: candles[i].time, value: sum / period })
  }
  return result
}

// Exponential Moving Average
export function calcEMA(candles, period = 12) {
  if (candles.length === 0) return []
  const k = 2 / (period + 1)
  const result = []
  let ema = candles[0].close
  result.push({ time: candles[0].time, value: ema })

  for (let i = 1; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k)
    result.push({ time: candles[i].time, value: ema })
  }
  return result
}

// MACD (12, 26, 9)
export function calcMACD(candles) {
  if (candles.length < 26) return { macd: [], signal: [], histogram: [] }

  const ema12 = calcEMAValues(candles.map((c) => c.close), 12)
  const ema26 = calcEMAValues(candles.map((c) => c.close), 26)

  const macdLine = []
  for (let i = 0; i < candles.length; i++) {
    if (ema12[i] !== null && ema26[i] !== null) {
      macdLine.push(ema12[i] - ema26[i])
    } else {
      macdLine.push(null)
    }
  }

  // Signal line = EMA(9) of MACD line
  const validMacd = macdLine.filter((v) => v !== null)
  const signalValues = calcEMAValues(validMacd, 9)

  const macd = []
  const signal = []
  const histogram = []
  let validIdx = 0

  for (let i = 0; i < candles.length; i++) {
    if (macdLine[i] === null) continue
    const sig = signalValues[validIdx] ?? null
    macd.push({ time: candles[i].time, value: macdLine[i] })
    if (sig !== null) {
      signal.push({ time: candles[i].time, value: sig })
      histogram.push({ time: candles[i].time, value: macdLine[i] - sig })
    }
    validIdx++
  }

  return { macd, signal, histogram }
}

// Bollinger Bands (20, 2)
export function calcBOLL(candles, period = 20, mult = 2) {
  const upper = []
  const middle = []
  const lower = []

  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += candles[j].close
    }
    const mean = sum / period

    let sqSum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sqSum += (candles[j].close - mean) ** 2
    }
    const std = Math.sqrt(sqSum / period)

    const t = candles[i].time
    upper.push({ time: t, value: mean + mult * std })
    middle.push({ time: t, value: mean })
    lower.push({ time: t, value: mean - mult * std })
  }

  return { upper, middle, lower }
}

// RSI (14)
export function calcRSI(candles, period = 14) {
  if (candles.length < period + 1) return []

  const result = []
  let gainSum = 0
  let lossSum = 0

  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close
    if (change > 0) gainSum += change
    else lossSum += Math.abs(change)
  }

  let avgGain = gainSum / period
  let avgLoss = lossSum / period
  let rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  result.push({ time: candles[period].time, value: rsi })

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0

    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
    result.push({ time: candles[i].time, value: rsi })
  }

  return result
}

// KDJ (9, 3, 3)
export function calcKDJ(candles, period = 9, kSmooth = 3, dSmooth = 3) {
  if (candles.length < period) return { k: [], d: [], j: [] }

  const kArr = []
  const dArr = []
  const jArr = []
  let prevK = 50
  let prevD = 50

  for (let i = period - 1; i < candles.length; i++) {
    let high = -Infinity
    let low = Infinity
    for (let j = i - period + 1; j <= i; j++) {
      if (candles[j].high > high) high = candles[j].high
      if (candles[j].low < low) low = candles[j].low
    }

    const rsv = high === low ? 50 : ((candles[i].close - low) / (high - low)) * 100
    const k = (prevK * (kSmooth - 1) + rsv) / kSmooth
    const d = (prevD * (dSmooth - 1) + k) / dSmooth
    const j = 3 * k - 2 * d

    kArr.push({ time: candles[i].time, value: k })
    dArr.push({ time: candles[i].time, value: d })
    jArr.push({ time: candles[i].time, value: j })

    prevK = k
    prevD = d
  }

  return { k: kArr, d: dArr, j: jArr }
}

// Stochastic Oscillator (14, 3)
export function calcSTOCH(candles, period = 14, smooth = 3) {
  if (candles.length < period) return { k: [], d: [] }

  const rawK = []
  for (let i = period - 1; i < candles.length; i++) {
    let high = -Infinity
    let low = Infinity
    for (let j = i - period + 1; j <= i; j++) {
      if (candles[j].high > high) high = candles[j].high
      if (candles[j].low < low) low = candles[j].low
    }
    const k = high === low ? 50 : ((candles[i].close - low) / (high - low)) * 100
    rawK.push({ time: candles[i].time, value: k })
  }

  // %D = SMA of %K
  const dArr = []
  for (let i = smooth - 1; i < rawK.length; i++) {
    let sum = 0
    for (let j = i - smooth + 1; j <= i; j++) sum += rawK[j].value
    dArr.push({ time: rawK[i].time, value: sum / smooth })
  }

  return { k: rawK, d: dArr }
}

// Volume
export function calcVOL(candles) {
  return candles.map((c) => ({
    time: c.time,
    value: c.volume || Math.random() * 1000000, // mock volume if not present
    color: c.close >= c.open ? 'rgba(52,211,153,0.5)' : 'rgba(248,113,113,0.5)',
  }))
}

// OBV (On-Balance Volume)
export function calcOBV(candles) {
  if (candles.length === 0) return []
  const result = []
  let obv = 0
  result.push({ time: candles[0].time, value: obv })

  for (let i = 1; i < candles.length; i++) {
    const vol = candles[i].volume || Math.random() * 1000000
    if (candles[i].close > candles[i - 1].close) obv += vol
    else if (candles[i].close < candles[i - 1].close) obv -= vol
    result.push({ time: candles[i].time, value: obv })
  }
  return result
}

// ATR (Average True Range, 14)
export function calcATR(candles, period = 14) {
  if (candles.length < 2) return []

  const trueRanges = []
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high
    const low = candles[i].low
    const prevClose = candles[i - 1].close
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
    trueRanges.push({ time: candles[i].time, tr })
  }

  if (trueRanges.length < period) return []

  const result = []
  let atr = 0
  for (let i = 0; i < period; i++) atr += trueRanges[i].tr
  atr /= period
  result.push({ time: trueRanges[period - 1].time, value: atr })

  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i].tr) / period
    result.push({ time: trueRanges[i].time, value: atr })
  }

  return result
}

// Helper: compute raw EMA values from a number array
function calcEMAValues(values, period) {
  if (values.length === 0) return []
  const k = 2 / (period + 1)
  const result = []

  // Start EMA after `period` values using SMA as seed
  for (let i = 0; i < period - 1 && i < values.length; i++) {
    result.push(null)
  }

  if (values.length < period) return result

  let sma = 0
  for (let i = 0; i < period; i++) sma += values[i]
  sma /= period
  result.push(sma)

  let ema = sma
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k)
    result.push(ema)
  }

  return result
}
