// ══════════════════════════════════════════════════════════
//  THE 3 CLOCKS — Live Market Scanner | Frontend App
// ══════════════════════════════════════════════════════════

const API = 'http://localhost:3001/api';

let allSetups     = [];
let activeFilter  = 'ALL';
let activeSource  = 'ALL';   // 'ALL' | 'FOREX' | 'CRYPTO'
let refreshTimer  = null;
let countdownVal  = 300;

// ── INIT ──────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  loadPrices();
  loadSession();
  setInterval(loadPrices, 20000);
  setInterval(loadSession, 30000);
});

// ── SESSION STATUS ─────────────────────────────────────────

async function loadSession() {
  try {
    const res  = await fetch(`${API}/session`);
    const data = await res.json();
    const badge = document.getElementById('session-badge');
    const text  = document.getElementById('session-text');
    text.textContent = data.name;
    if (data.active) {
      badge.classList.add('active-session');
    } else {
      badge.classList.remove('active-session');
    }
  } catch (e) { /* ignore */ }
}

// ── LIVE PRICES ────────────────────────────────────────────

async function loadPrices() {
  try {
    const res    = await fetch(`${API}/prices`);
    const prices = await res.json();
    renderTicker(prices);
  } catch (e) { /* ignore */ }
}

function renderTicker(prices) {
  const inner   = document.getElementById('ticker-inner');
  const symbols = Object.keys(prices);
  if (symbols.length === 0) return;

  // Duplicate for seamless loop
  const items = [...symbols, ...symbols].map(sym => {
    const d   = prices[sym];
    const pct = d.priceChangePct || 0;
    const cls  = pct >= 0 ? 'up' : 'down';
    const sign = pct >= 0 ? '+' : '';
    // Forex pairs already have slash, crypto need formatting
    const label = sym.includes('/') ? sym : sym.replace('USDT', '/USDT');
    const isForex = d.source === 'FOREX';
    const fxTag   = isForex ? '<span style="font-size:0.65rem;color:#00e5ff;margin-left:2px">FX</span>' : '';
    return `
      <div class="ticker-item">
        <span class="ticker-symbol">${label}${fxTag}</span>
        <span class="ticker-price">${isForex ? d.price.toFixed(4) : formatPrice(d.price, sym)}</span>
        <span class="ticker-change ${cls}">${sign}${pct.toFixed(2)}%</span>
      </div>`;
  }).join('');

  inner.innerHTML = items;
}

function formatPrice(price, symbol) {
  if (price > 1000)  return '$' + price.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price > 1)     return '$' + price.toFixed(4);
  return '$' + price.toFixed(6);
}

// ── SCAN ───────────────────────────────────────────────────

async function startScan() {
  clearAutoRefresh();

  const btn = document.getElementById('scan-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px"></span> Scanning...';

  showState('loading');

  // Fake progress bar
  let progress = 0;
  const bar = document.getElementById('loading-bar');
  const progressInterval = setInterval(() => {
    progress = Math.min(progress + Math.random() * 8, 90);
    bar.style.width = progress + '%';
  }, 600);

  try {
    const res  = await fetch(`${API}/scan`);
    const data = await res.json();

    clearInterval(progressInterval);
    bar.style.width = '100%';

    setTimeout(() => {
      allSetups = data.setups;
      renderStats(data.summary);
      renderSetups();
      updateScanTime(data.scanned_at);
      startAutoRefresh();
    }, 400);

  } catch (e) {
    clearInterval(progressInterval);
    alert('Scanner error: ' + e.message + '\n\nMake sure the server is running on port 3001.');
    showState('empty');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span id="scan-icon">▶</span> SCAN MARKET';
  }
}

// ── RENDER STATS ───────────────────────────────────────────

function renderStats(summary) {
  document.getElementById('stats-bar').style.display = 'flex';
  document.getElementById('stat-total').textContent   = summary.total_scanned;
  document.getElementById('stat-bull').textContent    = summary.bullish_setups;
  document.getElementById('stat-bear').textContent    = summary.bearish_setups;
  document.getElementById('stat-highev').textContent  = summary.high_ev_setups;
  const forexEl = document.getElementById('stat-forex');
  if (forexEl) forexEl.textContent = summary.forex_setups || 0;
}

// ── RENDER SETUPS ──────────────────────────────────────────

function renderSetups() {
  const filtered = getFiltered();
  const grid = document.getElementById('setups-grid');

  if (filtered.length === 0) {
    showState('no-results');
    return;
  }

  showState('grid');
  grid.innerHTML = filtered.map(s => buildCard(s)).join('');
}

function buildCard(s) {
  const isBull  = s.direction === 'BULLISH';
  const isForex = s.source === 'FOREX';
  const ev      = s.ev_score;
  const conf    = s.confidence.replace(' ', '-').replace('_', '-');

  // EV Dots
  const dots = [1, 2, 3, 4].map(i => {
    const lit = i <= ev;
    const cls = lit ? `ev-dot lit${Math.min(i, 4)}` : 'ev-dot';
    return `<div class="${cls}"></div>`;
  }).join('');

  // Clock badges
  const c1 = s.clocks.clock1.active;
  const c2 = s.clocks.clock2.active;
  const c3 = s.clocks.clock3.active;

  const time = new Date(s.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' UTC';

  // Source badge
  const sourceBadge = isForex
    ? `<span style="padding:2px 7px;border-radius:5px;font-size:0.65rem;font-weight:700;background:rgba(0,229,255,0.12);color:#00e5ff;border:1px solid rgba(0,229,255,0.3);margin-left:6px">FOREX</span>`
    : `<span style="padding:2px 7px;border-radius:5px;font-size:0.65rem;font-weight:700;background:rgba(255,214,0,0.1);color:#ffd600;border:1px solid rgba(255,214,0,0.25);margin-left:6px">CRYPTO</span>`;

  return `
  <div class="setup-card ${isBull ? 'bull' : 'bear'} ${ev >= 4 ? 'ev4' : ''}" onclick='openModal(${JSON.stringify(s).replace(/'/g, "&#39;")})'>
    <div class="card-header">
      <div class="card-pair">
        <span class="pair-name">${s.pair.includes('/') ? s.pair : s.pair.replace('USDT', '/USDT')}</span>
        <span class="tf-badge">${s.timeframe}</span>
        ${sourceBadge}
      </div>
      <span class="dir-badge ${isBull ? 'bull' : 'bear'}">${isBull ? '▲ LONG' : '▼ SHORT'}</span>
    </div>

    <div class="ev-bar">
      <span class="ev-label">EV</span>
      <div class="ev-dots">${dots}</div>
      <span class="ev-score-text ev${ev}">${ev}/4</span>
      <span class="confidence-pill ${s.confidence.replace(' ', '_')}">${s.confidence}</span>
    </div>

    <div class="clocks-row">
      <div class="clock-badge clock1 ${c1 ? '' : 'off'}">⧗ ${c1 ? (s.clocks.clock1.detail) : 'No Compression'}</div>
      <div class="clock-badge clock2 ${c2 ? '' : 'off'}">◷ ${c2 ? s.clocks.clock2.detail : 'Off-Session'}</div>
      <div class="clock-badge clock3 ${c3 ? '' : 'off'}">⚡ ${s.clocks.clock3.detail}</div>
    </div>

    <div class="trade-levels">
      <div class="level-item">
        <div class="level-label">Entry</div>
        <div class="level-price entry">${formatNum(s.entry)}</div>
      </div>
      <div class="level-item">
        <div class="level-label">Stop Loss</div>
        <div class="level-price sl">${formatNum(s.sl)}</div>
        <div class="level-rr">SL zone</div>
      </div>
      <div class="level-item">
        <div class="level-label">Take Profit</div>
        <div class="level-price tp">${formatNum(s.tp)}</div>
        <div class="level-rr">RR 1:${s.rr}</div>
      </div>
    </div>

    <div class="card-footer">
      <span class="structure-badge ${s.structure.trend}">${s.structure.trend.replace('_', ' ')}</span>
      <span class="card-time">${time}</span>
    </div>
  </div>`;
}

// ── MODAL ──────────────────────────────────────────────────

function openModal(s) {
  const isBull = s.direction === 'BULLISH';
  const pnl_pct = ((Math.abs(s.tp - s.entry) / s.entry) * 100).toFixed(2);
  const sl_pct  = ((Math.abs(s.sl - s.entry) / s.entry) * 100).toFixed(2);

  const ev = s.ev_score;
  const dots = [1,2,3,4].map(i => {
    const lit = i <= ev;
    return `<div class="${lit ? 'ev-dot lit' + Math.min(i,4) : 'ev-dot'}" style="height:10px"></div>`;
  }).join('');

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-header">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div>
          <div style="font-size:1.5rem;font-weight:900;font-family:var(--mono)">${s.pair.replace('USDT', '/USDT')}</div>
          <div style="color:var(--text-muted);font-size:0.8rem;margin-top:2px">${s.timeframe} • ${new Date(s.timestamp).toLocaleString()}</div>
        </div>
        <span class="dir-badge ${isBull ? 'bull' : 'bear'}" style="font-size:1rem">${isBull ? '▲ BULLISH LONG' : '▼ BEARISH SHORT'}</span>
        <span class="confidence-pill ${s.confidence.replace(' ','_')}" style="font-size:0.75rem">${s.confidence} EV</span>
      </div>
      <div class="ev-bar" style="padding:14px 0 0;border:none">
        <span class="ev-label">EV Score</span>
        <div class="ev-dots" style="max-width:140px">${dots}</div>
        <span class="ev-score-text ev${ev}" style="font-size:1ram">${ev}/4</span>
      </div>
    </div>

    <div class="modal-section">
      <h3>Trade Levels</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <label>Entry Price</label>
          <span style="color:var(--text)">${formatNum(s.entry)}</span>
        </div>
        <div class="detail-item">
          <label>Stop Loss</label>
          <span style="color:var(--red)">${formatNum(s.sl)} (-${sl_pct}%)</span>
        </div>
        <div class="detail-item">
          <label>Take Profit</label>
          <span style="color:var(--green)">${formatNum(s.tp)} (+${pnl_pct}%)</span>
        </div>
        <div class="detail-item">
          <label>Risk : Reward</label>
          <span style="color:var(--gold)">1 : ${s.rr}</span>
        </div>
        <div class="detail-item">
          <label>ATR (volatility)</label>
          <span>${formatNum(s.atr)}</span>
        </div>
        <div class="detail-item">
          <label>RSI (14)</label>
          <span style="color:${s.rsi > 70 ? 'var(--red)' : s.rsi < 30 ? 'var(--green)' : 'var(--text)'}">${s.rsi}</span>
        </div>
      </div>
    </div>

    <div class="modal-section">
      <h3>The 3 Clocks</h3>
      <div class="clocks-row" style="padding:0">
        <div class="clock-badge clock1 ${s.clocks.clock1.active ? '' : 'off'}" style="padding:12px 8px">
          <div style="font-size:1rem;margin-bottom:4px">⧗</div>
          <div style="font-weight:700;margin-bottom:3px">Clock 1</div>
          <div>${s.clocks.clock1.active ? s.clocks.clock1.detail : 'Not active'}</div>
          <div style="margin-top:4px;opacity:0.7">ATR Ratio: ${s.clocks.clock1.atr_ratio}</div>
        </div>
        <div class="clock-badge clock2 ${s.clocks.clock2.active ? '' : 'off'}" style="padding:12px 8px">
          <div style="font-size:1rem;margin-bottom:4px">◷</div>
          <div style="font-weight:700;margin-bottom:3px">Clock 2</div>
          <div>${s.clocks.clock2.detail}</div>
          <div style="margin-top:4px;opacity:0.7">${s.clocks.clock2.active ? 'Session active' : 'Institutional hours'}</div>
        </div>
        <div class="clock-badge clock3" style="padding:12px 8px">
          <div style="font-size:1rem;margin-bottom:4px">⚡</div>
          <div style="font-weight:700;margin-bottom:3px">Clock 3</div>
          <div>${s.clocks.clock3.detail}</div>
          <div style="margin-top:4px;opacity:0.7">Fakeout confirmed</div>
        </div>
      </div>
    </div>

    <div class="modal-section">
      <h3>Market Structure</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <label>Trend</label>
          <span class="structure-badge ${s.structure.trend}">${s.structure.trend.replace('_',' ')}</span>
        </div>
        <div class="detail-item">
          <label>P/D Zone</label>
          <span style="color:${s.premium_discount.aligned ? 'var(--green)' : 'var(--yellow)'}">${s.premium_discount.label} ${s.premium_discount.aligned ? '✓ Aligned' : '⚠ Not aligned'}</span>
        </div>
        ${s.structure.lastBOS   ? `<div class="detail-item"><label>Last BOS</label><span>${s.structure.lastBOS}</span></div>` : ''}
        ${s.structure.lastCHOCH ? `<div class="detail-item"><label>CHOCH</label><span style="color:var(--purple)">${s.structure.lastCHOCH}</span></div>` : ''}
        ${s.structure.sweep     ? `<div class="detail-item"><label>Sweep</label><span style="color:var(--yellow)">${s.structure.sweep}</span></div>` : ''}
      </div>
    </div>

    <div class="modal-section">
      <h3>Why This Setup</h3>
      <ul class="reason-list">
        ${s.reasons.map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>

    ${s.warnings.length > 0 ? `
    <div class="modal-section">
      <h3>Caution / Warnings</h3>
      <ul class="warning-list">
        ${s.warnings.map(w => `<li>${w}</li>`).join('')}
      </ul>
    </div>` : ''}

    <div class="modal-section" style="background:rgba(255,255,255,0.02);border-radius:0 0 18px 18px">
      <p style="font-size:0.78rem;color:var(--text-muted);line-height:1.6">
        <strong style="color:var(--yellow)">⚠ Risk Reminder:</strong> This is an algorithmic analysis tool applying The 3 Clocks strategy. 
        Always use proper risk management. Never risk more than 1-2% of your account per trade. 
        Past performance of any strategy does not guarantee future results.
      </p>
    </div>
  `;

  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ── FILTERS ────────────────────────────────────────────────

function filterDir(dir, btn) {
  activeFilter = dir;
  activeSource = 'ALL';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderSetups();
}

function filterSource(src, btn) {
  activeSource = activeSource === src ? 'ALL' : src;
  activeFilter = 'ALL';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (activeSource !== 'ALL') btn.classList.add('active');
  else document.querySelector('.filter-btn').classList.add('active');
  renderSetups();
}

function applyFilter() { renderSetups(); }

function getFiltered() {
  const evMin = parseInt(document.getElementById('filter-ev').value) || 0;
  const tf    = document.getElementById('filter-tf').value;

  return allSetups.filter(s => {
    if (activeFilter !== 'ALL' && s.direction !== activeFilter) return false;
    if (activeSource !== 'ALL' && s.source !== activeSource)   return false;
    if (s.ev_score < evMin) return false;
    if (tf && s.timeframe !== tf) return false;
    return true;
  });
}

// ── STATE MANAGEMENT ───────────────────────────────────────

function showState(state) {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('empty-state').style.display   = 'none';
  document.getElementById('no-results').style.display    = 'none';
  document.getElementById('setups-grid').style.display   = 'none';

  if (state === 'loading')    document.getElementById('loading-state').style.display = 'flex';
  else if (state === 'empty') document.getElementById('empty-state').style.display   = 'block';
  else if (state === 'no-results') document.getElementById('no-results').style.display = 'block';
  else if (state === 'grid')  document.getElementById('setups-grid').style.display   = 'grid';
}

// ── AUTO-REFRESH ────────────────────────────────────────────

function startAutoRefresh() {
  document.getElementById('refresh-bar').style.display = 'flex';
  countdownVal = 300;
  updateCountdown();
  refreshTimer = setInterval(() => {
    countdownVal--;
    updateCountdown();
    if (countdownVal <= 0) {
      clearAutoRefresh();
      startScan();
    }
  }, 1000);
}

function updateCountdown() {
  const m = Math.floor(countdownVal / 60);
  const s = countdownVal % 60;
  document.getElementById('refresh-countdown').textContent = `${m}:${s.toString().padStart(2,'0')}`;
}

function clearAutoRefresh() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}

function cancelAutoRefresh() {
  clearAutoRefresh();
  document.getElementById('refresh-bar').style.display = 'none';
}

// ── HELPERS ────────────────────────────────────────────────

function updateScanTime(iso) {
  const t = new Date(iso);
  document.getElementById('scan-time').textContent = 'Scanned: ' + t.toLocaleTimeString();
}

function formatNum(n) {
  if (!n && n !== 0) return 'N/A';
  if (n > 1000)  return n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n > 1)     return n.toFixed(4);
  return n.toFixed(6);
}
