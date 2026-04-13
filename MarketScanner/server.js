// ═══════════════════════════════════════════════════════════════
//  THE 3 CLOCKS — Live Market Scanner
//  Connects to Binance API, scans all pairs & timeframes,
//  applies strategy logic, reports live setups with SL/TP
// ═══════════════════════════════════════════════════════════════

const express      = require('express');
const cors         = require('cors');
const axios        = require('axios');
const path         = require('path');
const YahooFinanceClass = require('yahoo-finance2').default;
const yahooFinance      = new YahooFinanceClass();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── CONFIG ────────────────────────────────────────────────────

const CRYPTO_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'LINKUSDT', 'AVAXUSDT', 'DOTUSDT',
  'MATICUSDT', 'LTCUSDT', 'UNIUSDT', 'ATOMUSDT', 'NEARUSDT'
];

// Yahoo Finance symbol → display label
const FOREX_PAIRS = {
  'EURUSD=X': 'EUR/USD',
  'GBPUSD=X': 'GBP/USD',
  'USDJPY=X': 'USD/JPY',
  'AUDUSD=X': 'AUD/USD',
  'USDCAD=X': 'USD/CAD',
  'USDCHF=X': 'USD/CHF',
  'NZDUSD=X': 'NZD/USD',
  'EURGBP=X': 'EUR/GBP',
  'GC=F':     'XAU/USD'    // Gold (Yahoo: GC=F futures = most liquid)
};

const TIMEFRAMES       = ['5m', '15m', '1h', '4h', '1d'];
const FOREX_TIMEFRAMES = ['5m', '15m', '1h', '4h', '1d'];  // 4h aggregated from 1h

const STRATEGY = {
  atr_period:       14,
  atr_avg_period:   50,
  compress_thresh:  0.75,   // ATR ratio below this = coiling
  bb_period:        20,
  bb_mult:          2.0,
  fakeout_lookback: 20,     // bars to define the range
  sl_atr_mult:      0.5,    // SL distance = ATR × this
  tp_atr_mult:      4.5,    // TP distance = ATR × this
  min_ev_score:     1       // minimum clocks aligned to report
};

// ─── BINANCE API (Crypto) ───────────────────────────────────────

async function fetchCryptoCandles(symbol, interval, limit = 200) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await axios.get(url, { timeout: 8000 });
  return res.data.map(k => ({
    time:   k[0],
    open:   parseFloat(k[1]),
    high:   parseFloat(k[2]),
    low:    parseFloat(k[3]),
    close:  parseFloat(k[4]),
    volume: parseFloat(k[5])
  }));
}

async function fetchCurrentCryptoPrice(symbol) {
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
  const res = await axios.get(url, { timeout: 5000 });
  return parseFloat(res.data.price);
}

async function fetchCryptoTicker24h(symbol) {
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;
  const res = await axios.get(url, { timeout: 5000 });
  return {
    priceChange:    parseFloat(res.data.priceChange),
    priceChangePct: parseFloat(res.data.priceChangePercent),
    high:           parseFloat(res.data.highPrice),
    low:            parseFloat(res.data.lowPrice),
    volume:         parseFloat(res.data.volume)
  };
}

// ─── YAHOO FINANCE API (Forex) ──────────────────────────────────
// Timeframe mapping: 15m→'15m', 1h→'60m', 4h→aggregate from '60m', 1d→'1d'

function aggregateTo4H(candles1h) {
  // Group 1H candles into 4H groups (every 4 candles)
  const result = [];
  for (let i = 0; i + 3 < candles1h.length; i += 4) {
    const group = candles1h.slice(i, i + 4);
    result.push({
      time:   group[0].time,
      open:   group[0].open,
      high:   Math.max(...group.map(c => c.high)),
      low:    Math.min(...group.map(c => c.low)),
      close:  group[group.length - 1].close,
      volume: group.reduce((s, c) => s + c.volume, 0)
    });
  }
  return result;
}

async function fetchForexCandles(yahooSymbol, interval) {
  // Map our interval names to Yahoo Finance intervals + date range
  const now   = new Date();
  let yahooInterval, period1, needsAgg4h = false;

  if (interval === '5m') {
    yahooInterval = '5m';
    period1 = new Date(now - 5 * 24 * 3600 * 1000);    // last 5 days
  } else if (interval === '15m') {
    yahooInterval = '15m';
    period1 = new Date(now - 7 * 24 * 3600 * 1000);    // last 7 days
  } else if (interval === '1h') {
    yahooInterval = '60m';
    period1 = new Date(now - 60 * 24 * 3600 * 1000);   // last 60 days
  } else if (interval === '4h') {
    yahooInterval = '60m';
    period1 = new Date(now - 120 * 24 * 3600 * 1000);  // last 120 days
    needsAgg4h = true;
  } else {  // 1d
    yahooInterval = '1d';
    period1 = new Date(now - 365 * 24 * 3600 * 1000);  // last 1 year
  }

  const result = await yahooFinance.chart(yahooSymbol, {
    period1,
    interval: yahooInterval
  });

  if (!result || !result.quotes || result.quotes.length === 0) return [];

  let candles = result.quotes
    .filter(q => q.open != null && q.high != null && q.low != null && q.close != null)
    .map(q => ({
      time:   new Date(q.date).getTime(),
      open:   q.open,
      high:   q.high,
      low:    q.low,
      close:  q.close,
      volume: q.volume || 0
    }));

  if (needsAgg4h) candles = aggregateTo4H(candles);
  return candles;
}

async function fetchForexQuote(yahooSymbol) {
  try {
    const q = await yahooFinance.quote(yahooSymbol);
    return {
      price:          q.regularMarketPrice,
      priceChangePct: q.regularMarketChangePercent,
      priceChange:    q.regularMarketChange,
      high:           q.regularMarketDayHigh,
      low:            q.regularMarketDayLow
    };
  } catch (e) { return null; }
}

// ─── MATH HELPERS ──────────────────────────────────────────────

function sma(arr, period) {
  if (arr.length < period) return [];
  const result = [];
  for (let i = period - 1; i < arr.length; i++) {
    const slice = arr.slice(i - period + 1, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

function calculateATR(candles, period = 14) {
  const tr = [];
  for (let i = 1; i < candles.length; i++) {
    const hl  = candles[i].high - candles[i].low;
    const hc  = Math.abs(candles[i].high  - candles[i - 1].close);
    const lc  = Math.abs(candles[i].low   - candles[i - 1].close);
    tr.push(Math.max(hl, hc, lc));
  }
  // Wilder smoothing
  let atr = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const atrs = [atr];
  for (let i = period; i < tr.length; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
    atrs.push(atr);
  }
  return atrs;
}

function calculateBB(closes, period = 20, mult = 2) {
  const result = [];
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean  = slice.reduce((a, b) => a + b, 0) / period;
    const std   = Math.sqrt(slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period);
    result.push({
      upper:  mean + mult * std,
      middle: mean,
      lower:  mean - mult * std,
      width:  (2 * mult * std) / mean
    });
  }
  return result;
}

function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains  += change;
    else            losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// ─── STRUCTURE DETECTION ───────────────────────────────────────
// Simplified pivot detection for structure (HH/HL/LH/LL)

function detectPivots(candles, lookback = 5) {
  const pivotHighs = [];
  const pivotLows  = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const slice = candles.slice(i - lookback, i + lookback + 1);
    const maxH  = Math.max(...slice.map(c => c.high));
    const minL  = Math.min(...slice.map(c => c.low));
    if (candles[i].high === maxH) pivotHighs.push({ index: i, price: candles[i].high });
    if (candles[i].low  === minL) pivotLows.push({  index: i, price: candles[i].low  });
  }
  return { pivotHighs, pivotLows };
}

function detectStructure(pivotHighs, pivotLows) {
  let trend = 'NEUTRAL';
  let lastBOS   = null;
  let lastCHOCH = null;

  if (pivotHighs.length >= 2 && pivotLows.length >= 2) {
    const ph1 = pivotHighs[pivotHighs.length - 1].price;
    const ph2 = pivotHighs[pivotHighs.length - 2].price;
    const pl1 = pivotLows[pivotLows.length  - 1].price;
    const pl2 = pivotLows[pivotLows.length  - 2].price;

    const hh = ph1 > ph2;
    const hl = pl1 > pl2;
    const lh = ph1 < ph2;
    const ll = pl1 < pl2;

    if (hh && hl)      trend = 'BULLISH';
    else if (lh && ll) trend = 'BEARISH';
    else if (hh && ll) trend = 'TRANSITIONING_BULL';
    else if (lh && hl) trend = 'TRANSITIONING_BEAR';

    lastBOS   = hh ? `BOS UP (${ph1.toFixed(4)})` : ll ? `BOS DOWN (${pl1.toFixed(4)})` : null;
    lastCHOCH = (trend === 'TRANSITIONING_BULL') ? 'CHOCH BULL (possible reversal up)'
              : (trend === 'TRANSITIONING_BEAR') ? 'CHOCH BEAR (possible reversal down)' : null;
  }

  return { trend, lastBOS, lastCHOCH };
}

// ─── SESSION DETECTION ─────────────────────────────────────────

function getSession() {
  const h = new Date().getUTCHours();
  const m = new Date().getUTCMinutes();
  const t = h + m / 60;
  if (t >= 7  && t < 10)  return { active: true,  name: 'London Open' };
  if (t >= 10 && t < 13)  return { active: false,  name: 'London Mid' };
  if (t >= 13 && t < 16)  return { active: true,  name: 'NY Open' };
  if (t >= 16 && t < 20)  return { active: false,  name: 'NY Mid' };
  return { active: false, name: 'Asia / Off-Session' };
}

// ─── SWEEP DETECTION ───────────────────────────────────────────

function detectSweep(candles, pivotLows, pivotHighs) {
  const last = candles[candles.length - 1];
  let sweepBull = false;
  let sweepBear = false;

  if (pivotLows.length > 0) {
    const lastPL = pivotLows[pivotLows.length - 1].price;
    if (last.low < lastPL && last.close > lastPL) sweepBull = true;
  }
  if (pivotHighs.length > 0) {
    const lastPH = pivotHighs[pivotHighs.length - 1].price;
    if (last.high > lastPH && last.close < lastPH) sweepBear = true;
  }
  return { sweepBull, sweepBear };
}

// ─── MAIN ANALYSIS ENGINE ──────────────────────────────────────

function analyze(candles, pair, timeframe, source = 'CRYPTO') {
  // Need at least: ATR(14) + ATR SMA(50) = 64 candles minimum
  if (candles.length < 64) return null;

  const closes = candles.map(c => c.close);
  const highs  = candles.map(c => c.high);
  const lows   = candles.map(c => c.low);
  const last   = candles[candles.length - 1];

  // ── Clock 1: Volatility ──
  const atrs       = calculateATR(candles, STRATEGY.atr_period);
  const atrAvgArr  = sma(atrs, STRATEGY.atr_avg_period);
  if (atrAvgArr.length === 0) return null;

  const atrNow   = atrs[atrs.length - 1];
  const atrAvg   = atrAvgArr[atrAvgArr.length - 1];
  const atrRatio = atrNow / atrAvg;

  const compressed   = atrRatio < STRATEGY.compress_thresh;
  const wasComp3     = atrs.length > 4 &&
    (atrs[atrs.length-2] / atrAvgArr[atrAvgArr.length-2] < STRATEGY.compress_thresh ||
     atrs[atrs.length-3] / atrAvgArr[atrAvgArr.length-3] < STRATEGY.compress_thresh);
  const clock1       = compressed || wasComp3;

  // BB Squeeze
  const bbs        = calculateBB(closes, STRATEGY.bb_period, STRATEGY.bb_mult);
  const bbWidths   = bbs.map(b => b.width);
  const bbWidthSMA = sma(bbWidths, STRATEGY.bb_period);
  const bbNow      = bbs[bbs.length - 1];
  const bbSqueeze  = bbWidthSMA.length > 0 && bbNow.width < bbWidthSMA[bbWidthSMA.length - 1] * 0.8;

  // RSI for context
  const rsi = calculateRSI(closes, 14);

  // ── Clock 2: Session ──
  const session = getSession();
  const clock2  = session.active;

  // ── Clock 3: Fakeout (look back up to 5 bars) ──────────────────
  // BUG FIX: The original code only checked the very last candle.
  // A fakeout firing on the exact last bar at scan-time is extremely rare.
  // Solution: look at the last 5 bars and report the most recent fakeout.
  const lb = STRATEGY.fakeout_lookback;
  let fakeoutBear = false;
  let fakeoutBull = false;
  let fakeoutBarIdx   = candles.length - 1; // which bar had the fakeout
  let barsAgo         = 0;
  let fakeRangeHigh   = 0;
  let fakeRangeLow    = Infinity;
  let fakeCandleHigh  = 0;
  let fakeCandleLow   = Infinity;

  const maxScanBack = 5;
  for (let ago = 1; ago <= maxScanBack; ago++) {
    const idx = candles.length - ago;            // index of the candle being checked
    if (idx < lb + 2) break;                     // not enough history
    const c   = candles[idx];
    // Range = lb bars BEFORE this candle (not including this candle)
    const rSlice = candles.slice(idx - lb, idx);
    if (rSlice.length < Math.floor(lb / 2)) break;
    const rH = Math.max(...rSlice.map(x => x.high));
    const rL  = Math.min(...rSlice.map(x => x.low));

    // Bearish fakeout: wick above range high, body closes back below it
    if (!fakeoutBear && !fakeoutBull && c.high > rH && c.close < rH && c.close < c.open) {
      fakeoutBear    = true;
      fakeoutBarIdx  = idx;
      barsAgo        = ago;
      fakeRangeHigh  = rH;
      fakeRangeLow   = rL;
      fakeCandleHigh = c.high;
      break;
    }
    // Bullish fakeout: wick below range low, body closes back above it
    if (!fakeoutBear && !fakeoutBull && c.low < rL && c.close > rL && c.close > c.open) {
      fakeoutBull    = true;
      fakeoutBarIdx  = idx;
      barsAgo        = ago;
      fakeRangeHigh  = rH;
      fakeRangeLow   = rL;
      fakeCandleLow  = c.low;
      break;
    }
  }

  if (!fakeoutBear && !fakeoutBull) return null;

  // Use the fakeout bar's extreme for SL, current close for entry
  const rangeHigh = fakeRangeHigh;
  const rangeLow  = fakeRangeLow;

  // ── Structure ──
  const { pivotHighs, pivotLows } = detectPivots(candles, 5);
  const { trend, lastBOS, lastCHOCH } = detectStructure(pivotHighs, pivotLows);
  const { sweepBull, sweepBear } = detectSweep(candles, pivotLows, pivotHighs);

  // ── EV Score ──
  const isBull  = fakeoutBull;
  const evScore = (clock1 ? 1 : 0) + (clock2 ? 1 : 0) + 1; // clock3 always true

  // Bonus for structure alignment
  const structureAligned =
    (isBull && (trend === 'BULLISH' || trend === 'TRANSITIONING_BULL' || sweepBull)) ||
    (!isBull && (trend === 'BEARISH' || trend === 'TRANSITIONING_BEAR' || sweepBear));

  const finalEV = Math.min(evScore + (structureAligned ? 1 : 0), 4);
  if (finalEV < STRATEGY.min_ev_score) return null;

  // ── SL / TP — use fakeout bar's wick for SL ──
  const fakeBar = candles[fakeoutBarIdx];
  let entry, sl, tp;
  if (isBull) {
    entry = last.close;
    sl    = fakeBar.low  - atrNow * STRATEGY.sl_atr_mult;  // SL below the wick that swept the low
    tp    = entry        + atrNow * STRATEGY.tp_atr_mult;
  } else {
    entry = last.close;
    sl    = fakeBar.high + atrNow * STRATEGY.sl_atr_mult;  // SL above the wick that swept the high
    tp    = entry        - atrNow * STRATEGY.tp_atr_mult;
  }

  const slDist = Math.abs(entry - sl);
  const tpDist = Math.abs(tp - entry);
  const rr     = (tpDist / slDist).toFixed(1);

  // ── Premium / Discount ──
  const eq        = (rangeHigh + rangeLow) / 2;
  const inPremium = last.close > eq;
  const inDiscount= last.close < eq;
  const pdLabel   = inPremium ? 'PREMIUM' : inDiscount ? 'DISCOUNT' : 'EQUILIBRIUM';
  const pdAligned = (isBull && inDiscount) || (!isBull && inPremium);

  const freshness = barsAgo === 1 ? 'FRESH (last bar)'
                  : barsAgo <= 2 ? `Recent (${barsAgo} bars ago)`
                  : `Older (${barsAgo} bars ago)`;

  // ── Reasons ──
  const reasons = [];
  if (fakeoutBull) reasons.push(`Bullish fakeout below ${rangeLow.toFixed(5)} — ${freshness}`);
  if (fakeoutBear) reasons.push(`Bearish fakeout above ${rangeHigh.toFixed(5)} — ${freshness}`);
  if (compressed)    reasons.push('Volatility compressed (coiling spring)');
  else if (wasComp3) reasons.push('Post-compression (energy released)');
  if (bbSqueeze)   reasons.push('Bollinger Band squeeze active');
  if (clock2)      reasons.push(session.name + ' session active');
  if (sweepBull)   reasons.push('Bullish liquidity sweep detected');
  if (sweepBear)   reasons.push('Bearish liquidity sweep detected');
  if (lastCHOCH)   reasons.push(lastCHOCH);
  if (lastBOS)     reasons.push(lastBOS);
  if (pdAligned)   reasons.push('Price in ' + pdLabel + ' zone (aligned)');

  const warnings = [];
  if (!clock1) warnings.push('No volatility compression — lower probability');
  if (!clock2) warnings.push('Off-session — watch for lower volume');
  if (barsAgo > 2) warnings.push(`Signal is ${barsAgo} bars old — price may have moved already`);
  if (!structureAligned) warnings.push('Market structure not aligned with setup direction');
  if (!pdAligned) warnings.push('Price in ' + pdLabel + ' — against P/D logic');
  if (rsi > 70 && !isBull) warnings.push('RSI overbought (' + rsi.toFixed(0) + ') — confirms short');
  if (rsi < 30 && isBull)  warnings.push('RSI oversold ('  + rsi.toFixed(0) + ') — confirms long');

  return {
    pair,
    timeframe,
    source,
    direction:   isBull ? 'BULLISH' : 'BEARISH',
    entry:       parseFloat(entry.toFixed(8)),
    sl:          parseFloat(sl.toFixed(8)),
    tp:          parseFloat(tp.toFixed(8)),
    rr,
    ev_score:    finalEV,
    ev_max:      4,
    confidence:  finalEV >= 4 ? 'VERY HIGH' : finalEV === 3 ? 'HIGH' : finalEV === 2 ? 'MEDIUM' : 'LOW',
    clocks: {
      clock1: { active: clock1, detail: compressed ? 'Compressed' : wasComp3 ? 'Post-compression' : 'Normal', atr_ratio: atrRatio.toFixed(2), bb_squeeze: bbSqueeze },
      clock2: { active: clock2, detail: session.name },
      clock3: { active: true,   detail: isBull ? 'Bullish fakeout' : 'Bearish fakeout' }
    },
    structure: { trend, lastBOS, lastCHOCH, sweep: sweepBull ? 'BULL SWEEP' : sweepBear ? 'BEAR SWEEP' : null },
    premium_discount: { label: pdLabel, aligned: pdAligned },
    rsi: parseFloat(rsi.toFixed(1)),
    range_high: rangeHigh,
    range_low:  rangeLow,
    atr:        parseFloat(atrNow.toFixed(8)),
    reasons,
    warnings,
    timestamp:  new Date().toISOString()
  };
}

// ─── API ROUTES ────────────────────────────────────────────────

// Full market scan — Crypto + Forex
app.get('/api/scan', async (req, res) => {
  console.log(`[SCAN] Starting full scan at ${new Date().toUTCString()}`);
  const setups  = [];
  const errors  = [];
  let scanned   = 0;

  // ── Scan Crypto (Binance) ──
  for (const pair of CRYPTO_PAIRS) {
    for (const tf of TIMEFRAMES) {
      try {
        const candles = await fetchCryptoCandles(pair, tf, 200);
        const setup   = analyze(candles, pair, tf, 'CRYPTO');
        if (setup) setups.push(setup);
        scanned++;
        await new Promise(r => setTimeout(r, 100));
      } catch (e) {
        errors.push({ pair, tf, error: e.message });
      }
    }
  }

  // ── Scan Forex (Yahoo Finance) ──
  console.log(`[FX] Scanning ${Object.keys(FOREX_PAIRS).length} forex/gold pairs...`);
  for (const [yahooSym, label] of Object.entries(FOREX_PAIRS)) {
    for (const tf of FOREX_TIMEFRAMES) {
      try {
        const candles = await fetchForexCandles(yahooSym, tf);
        console.log(`[FX] ${label} ${tf}: ${candles.length} candles`);
        if (candles.length >= 64) {
          const setup = analyze(candles, label, tf, 'FOREX');
          if (setup) {
            setups.push(setup);
            console.log(`[FX] ✓ SETUP: ${label} ${tf} ${setup.direction} EV:${setup.ev_score}`);
          }
        } else {
          console.log(`[FX] ✗ Skipped ${label} ${tf} — only ${candles.length} candles`);
        }
        scanned++;
        await new Promise(r => setTimeout(r, 350)); // Yahoo is slower
      } catch (e) {
        scanned++; // count even on error so total is accurate
        console.error(`[FX] ERROR ${label} ${tf}:`, e.message);
        errors.push({ pair: label, tf, error: e.message });
      }
    }
  }

  setups.sort((a, b) => b.ev_score - a.ev_score);
  const totalPairs = CRYPTO_PAIRS.length + Object.keys(FOREX_PAIRS).length;
  console.log(`[SCAN] Done. ${setups.length} setups found out of ${scanned} scanned.`);
  res.json({
    setups,
    errors,
    summary: {
      total_pairs:      totalPairs,
      crypto_pairs:     CRYPTO_PAIRS.length,
      forex_pairs:      Object.keys(FOREX_PAIRS).length,
      total_timeframes: TIMEFRAMES.length,
      total_scanned:    scanned,
      setups_found:     setups.length,
      bullish_setups:   setups.filter(s => s.direction === 'BULLISH').length,
      bearish_setups:   setups.filter(s => s.direction === 'BEARISH').length,
      high_ev_setups:   setups.filter(s => s.ev_score >= 3).length,
      forex_setups:     setups.filter(s => s.source === 'FOREX').length,
      session:          getSession()
    },
    scanned_at: new Date().toISOString()
  });
});

// Single pair scan across all timeframes
app.get('/api/scan/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const setups = [];
  for (const tf of TIMEFRAMES) {
    try {
      const candles = await fetchCandles(symbol.toUpperCase(), tf, 200);
      const setup   = analyze(candles, symbol.toUpperCase(), tf);
      if (setup) setups.push(setup);
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      console.error(e.message);
    }
  }
  setups.sort((a, b) => b.ev_score - a.ev_score);
  res.json({ setups, scanned_at: new Date().toISOString() });
});

// Live prices — Crypto + Forex
app.get('/api/prices', async (req, res) => {
  try {
    const prices = {};

    // Crypto prices from Binance
    for (const pair of CRYPTO_PAIRS.slice(0, 8)) {
      try {
        const p = await fetchCurrentCryptoPrice(pair);
        const t = await fetchCryptoTicker24h(pair);
        prices[pair] = { price: p, source: 'CRYPTO', ...t };
        await new Promise(r => setTimeout(r, 80));
      } catch (e) { /* skip */ }
    }

    // Forex prices from Yahoo Finance
    for (const [yahooSym, label] of Object.entries(FOREX_PAIRS)) {
      try {
        const q = await fetchForexQuote(yahooSym);
        if (q) prices[label] = { ...q, source: 'FOREX' };
        await new Promise(r => setTimeout(r, 200));
      } catch (e) { /* skip */ }
    }

    res.json(prices);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Session status
app.get('/api/session', (req, res) => {
  res.json(getSession());
});

// ─── START SERVER ──────────────────────────────────────────────

const PORT       = process.env.PORT || 3001;
const totalPairs = CRYPTO_PAIRS.length + Object.keys(FOREX_PAIRS).length;
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║   THE 3 CLOCKS — Live Market Scanner         ║
║   http://localhost:${PORT}                       ║
║   Crypto:  ${CRYPTO_PAIRS.length} pairs (Binance)              ║
║   Forex:   ${Object.keys(FOREX_PAIRS).length} major pairs (Yahoo Finance)    ║
║   Total:   ${totalPairs} pairs × ${TIMEFRAMES.length} timeframes           ║
║   Strategy: Contrarian Fakeout + EV Score    ║
╚══════════════════════════════════════════════╝`);
});
