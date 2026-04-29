<div align="center">
  <img src="assets/jafsoon_wolf.png" alt="Jafsoon Wolf" width="300" style="border-radius: 10px; margin-bottom: 20px;" />
  <h1>⧗ The 3 Clocks: Contrarian Edge</h1>
  <p><strong>Advanced Live Market Scanner for Crypto, Forex, and Gold</strong></p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Node.js](https://img.shields.io/badge/Node.js-Backend-green.svg)](https://nodejs.org/)
  [![Express](https://img.shields.io/badge/Express-API-blue.svg)](https://expressjs.com/)
  [![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-Frontend-yellow.svg)]()
</div>

<hr>

## 📖 Overview

**The 3 Clocks: Contrarian Edge** is a proprietary, institutional-grade market scanner built upon a highly effective contrarian trading strategy. The scanner simultaneously monitors **24 market pairs** across **5 timeframes**, resulting in **120 real-time combinations**. It algorithmically identifies high-probability "fakeout" setups and calculates precise Entry, Stop Loss, and Take Profit levels to provide actionable trading intelligence.

---

## 🧠 Strategy: The 3 Clocks

The system operates on three foundational "clocks" (conditions). Each clock triggered adds to the **Expected Value (EV) Score**, maxing out at 4/4. Higher EV indicates greater conviction.

| Indicator | Name | Core Logic & Focus |
| :---: | :--- | :--- |
| **⧗ Clock 1** | **Market Clock** | *Volatility Compression* — Detects ATR and Bollinger Band squeezes to anticipate breakouts. |
| **◷ Clock 2** | **Institutional Clock** | *Session Timing* — Filters for high-liquidity windows (London & New York Open). |
| **⚡ Clock 3** | **Psychological Clock** | *Fakeout Detection* — Identifies retail traps where smart money reverses the market. |

---

## 📡 Supported Markets & Data Sources

We utilize robust, free-tier APIs to aggregate real-time market data without requiring API keys.

| Asset Class | Primary Source | Supported Pairs |
| :--- | :--- | :--- |
| 🪙 **Crypto** | Binance Public API | `BTC`, `ETH`, `BNB`, `SOL`, `XRP`, `ADA`, `DOGE`, `LINK`, `AVAX`, `DOT`, `MATIC`, `LTC`, `UNI`, `ATOM`, `NEAR` |
| 💱 **Forex** | Yahoo Finance | `EUR/USD`, `GBP/USD`, `USD/JPY`, `AUD/USD`, `USD/CAD`, `USD/CHF`, `NZD/USD`, `EUR/GBP` |
| 🥇 **Gold** | Yahoo Finance | `XAU/USD` (GC=F) |

**Monitored Timeframes:** `M5` · `M15` · `H1` · `H4` · `D1`

---

## 🚀 Quick Start Guide

Follow these steps to deploy the scanner locally.

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- NPM (Node Package Manager)

### Installation & Execution

```bash
# Navigate to the scanner directory
cd MarketScanner

# Install required dependencies
npm install

# Start the local server
node server.js
```

Once the server is running, navigate to `http://localhost:3001` in your web browser and click the **SCAN MARKET** button to initiate live tracking.

---

## 🖥️ Dashboard Features

- 📈 **Live Price Ticker:** A continuous, real-time scrolling marquee of all monitored Crypto and Forex pairs.
- 🧮 **EV Score Meter:** Visual indicator (1–4 bars) evaluating the quality and conviction of each setup.
- 🏷️ **Market Badges:** Instant visual categorization (FOREX / CRYPTO / METALS).
- 🔍 **Advanced Filtering:** Sort setups by Direction (Bull/Bear), Asset Class, EV Score, or Timeframe.
- 🔄 **Automated Scans:** Built-in auto-refresh executing full market scans every 5 minutes.
- 📋 **Detailed Insights:** Deep-dive modal for each setup outlining logic, entry reasons, and risk parameters.

---

## 📁 Repository Structure

```text
ContraryEdge/
├── MarketScanner/
│   ├── public/
│   │   ├── index.html     # Frontend Dashboard UI
│   │   ├── style.css      # Custom Dark Theme Styles
│   │   └── app.js         # Client-side Scanning Logic
│   ├── package.json       # Project Dependencies
│   └── server.js          # Node.js/Express Backend Server
├── MSNR_Indicator.pine            # TradingView MSNR Indicator Script
├── ThreeClocks_ContraryEdge.pine  # TradingView 3 Clocks Indicator Script
└── README.md              # Project Documentation (You are here)
```

---

## ⚠️ Disclaimer & Risk Warning

This software and the strategies enclosed are provided strictly for **educational and research purposes**. It does not constitute financial, investment, or trading advice. Past performance is not indicative of future results. Always practice strict risk management protocols and **never risk more than 1–2% of your total account equity per trade.**
