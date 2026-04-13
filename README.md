# ⧗ The 3 Clocks — Contrarian Edge
### Live Market Scanner · Crypto + Forex + Gold

A proprietary institutional-grade market scanner built on **The 3 Clocks** contrarian trading strategy. Scans **24 pairs × 5 timeframes = 120 combinations** in real-time and identifies high-probability fakeout setups with calculated Entry, Stop Loss, and Take Profit levels.

---

## 🧠 Strategy: The 3 Clocks

| Clock | Name | Logic |
|-------|------|-------|
| ⧗ Clock 1 | **Market Clock** | Volatility compression — ATR squeeze, Bollinger Band squeeze |
| ◷ Clock 2 | **Institutional Clock** | London Open / NY Open session filter |
| ⚡ Clock 3 | **Psychological Clock** | Fakeout detection — retail trapped, smart money reverses |

Each clock that fires adds **+1 EV Score** (max 4/4). The higher the EV, the higher the conviction.

---

## 📡 Data Sources

| Market | Source | Pairs |
|--------|--------|-------|
| **Crypto** | Binance Public API (no key needed) | BTC, ETH, BNB, SOL, XRP, ADA, DOGE, LINK, AVAX, DOT, MATIC, LTC, UNI, ATOM, NEAR |
| **Forex** | Yahoo Finance (no key needed) | EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, USD/CHF, NZD/USD, EUR/GBP |
| **Gold** | Yahoo Finance (GC=F) | XAU/USD |

**Timeframes:** M5 · M15 · H1 · H4 · D1

---

## 🚀 Quick Start

```bash
cd MarketScanner
npm install
node server.js
```

Open **http://localhost:3001** in your browser, then click **SCAN MARKET**.

---

## 🖥️ Dashboard Features

- 📈 **Live price ticker** — all pairs scrolling in real-time (crypto + forex)
- 🧮 **EV Score meter** — visual 1–4 bar showing setup quality
- 🏷️ **FOREX / CRYPTO badges** — instantly see which market
- 🔍 **Filters** — by direction (Bull/Bear), source (Forex/Crypto), EV score, timeframe
- 🔄 **Auto-refresh** — scans every 5 minutes automatically
- 📋 **Setup detail modal** — full breakdown with reasons and risk warnings

---

## 📁 Project Structure

```
MSNRCAG/
├── MarketScanner/
│   ├── server.js          # Node.js/Express backend scanner
│   ├── package.json
│   └── public/
│       ├── index.html     # Dashboard UI
│       ├── style.css      # Dark theme styles
│       └── app.js         # Frontend logic
├── MSNR_Indicator.pine            # TradingView Pine Script — MSNR indicator
├── ThreeClocks_ContraryEdge.pine  # TradingView Pine Script — 3 Clocks indicator
└── README.md
```

---

## ⚠️ Disclaimer

This tool is for **educational and research purposes only**. It does not constitute financial advice. Always use proper risk management — never risk more than 1–2% of your account per trade.

---

*Built with Node.js · Express · Binance API · Yahoo Finance · Vanilla JS*
