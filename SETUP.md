# SikaFolio — Setup Guide

## Prerequisites
- Node.js 18+ installed → https://nodejs.org
- VS Code installed → https://code.visualstudio.com
- Claude Code installed → run: `npm install -g @anthropic-ai/claude-code`

---

## Step 1 — Install dependencies

Open this folder in VS Code, then open the terminal (Ctrl+` or Cmd+`) and run:

```bash
npm install
```

---

## Step 2 — Set up Google OAuth (Gmail access)

1. Go to https://console.cloud.google.com
2. Create a new project called `sikafolio`
3. Go to **APIs & Services → Library** → enable **Gmail API**
4. Go to **APIs & Services → OAuth consent screen**
   - User Type: External
   - App name: SikaFolio
   - Add scope: `https://www.googleapis.com/auth/gmail.readonly`
   - Add your Gmail address as a test user
5. Go to **APIs & Services → Credentials**
   - Click **Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:5173`
   - Authorized redirect URIs: `http://localhost:5173`
6. Copy the **Client ID**

---

## Step 3 — Add your Client ID

Open `.env` and replace the placeholder:

```
VITE_GOOGLE_CLIENT_ID=paste_your_client_id_here
```

---

## Step 4 — Run the app

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

To test on your phone (same WiFi):
```bash
npx localtunnel --port 5173
```

---

## Step 5 — Use Claude Code to build & refine

Open a new terminal in VS Code and run:
```bash
claude
```

### Useful prompts to continue building:

**Add a chart to the portfolio screen:**
```
Add a simple line chart to the Portfolio page showing total portfolio 
value over time, using the trade history dates as data points. 
Use the recharts library. Keep the dark SikaFolio theme — gold line, 
dark background, no grid lines, just a clean sparkline feel.
```

**Add push notifications for new trades:**
```
Add Web Push notifications to SikaFolio. When a new trade is detected 
during Gmail sync, show a push notification with the stock symbol, 
quantity and price. Use the Web Notifications API with service worker.
```

**Add a stock detail page:**
```
When user taps a stock card in Portfolio, show a detail page with:
- Full trade history for that stock
- A chart of their average cost vs current price over time  
- Total fees paid
- Realized vs unrealized PnL breakdown
Keep the SikaFolio dark gold theme.
```

**Improve the email parser:**
```
The email parser in src/services/gmailService.js needs to handle edge 
cases: partial fills, cancelled orders, and dividend notifications from 
noreply@ic.africa. Update parseTradeEmail() to handle these gracefully 
and skip non-trade emails.
```

**Add install prompt (PWA):**
```
Add a PWA install banner to SikaFolio. Detect the beforeinstallprompt 
event and show a custom gold banner at the bottom of the splash screen: 
"Add to Home Screen" with the coin icon. Dismiss it if user taps X.
```

---

## Step 6 — Deploy to Netlify (free)

```bash
npm run build
```

1. Go to https://netlify.com → drag the `dist/` folder onto the deploy zone
2. Go to Site Settings → Environment Variables
3. Add: `VITE_GOOGLE_CLIENT_ID` = your client ID
4. Go back to Google Cloud Console → update Authorized origins with your Netlify URL

---

## Project structure

```
sikafolio/
├── src/
│   ├── components/
│   │   ├── Logo.jsx          # SikaFolio brand mark
│   │   ├── BottomNav.jsx     # 4-tab navigation
│   │   ├── StockCard.jsx     # Individual holding card with WAC + PnL
│   │   └── SyncPanel.jsx     # Gmail sync progress pipeline
│   ├── services/
│   │   ├── db.js             # Dexie IndexedDB schema
│   │   ├── gmailService.js   # Gmail API + iC Securities email parser
│   │   └── priceService.js   # Live GSE price feed (kwayisi.org)
│   ├── hooks/
│   │   ├── usePrices.js      # Auto-polling price hook
│   │   └── usePortfolio.js   # WAC + PnL calculations (live from DB)
│   ├── pages/
│   │   ├── Splash.jsx        # Onboarding screen
│   │   ├── Portfolio.jsx     # Main dashboard
│   │   ├── Trades.jsx        # Trade history + Gmail sync
│   │   ├── Markets.jsx       # All GSE equities live
│   │   └── Settings.jsx      # Gmail connect + app config
│   ├── App.jsx               # Root with screen routing
│   ├── main.jsx              # Entry point
│   └── index.css             # Design tokens + global styles
├── .env                      # Google OAuth client ID
├── vite.config.js            # Vite + PWA config
├── tailwind.config.js
└── package.json
```

---

## Design tokens (for Claude Code prompts)

| Token | Value |
|-------|-------|
| Gold accent | `#C8A84B` |
| Background | `#0d1117` |
| Surface | `#131820` |
| Border | `#1e2530` |
| Green (profit) | `#2ecc71` |
| Red (loss) | `#e74c3c` |
| Font | Syne (UI) + DM Mono (numbers) |

---

## How the Gmail sync works

1. User logs in with Google OAuth (read-only Gmail scope)
2. App queries Gmail API for emails from `noreply@ic.africa` with subject "TRADE CONFIRMATION"
3. On first run — fetches ALL historical emails (your full history)
4. On subsequent syncs — only fetches emails newer than last sync date
5. Each email is parsed for: symbol, order type, quantity, price, fees, settlement date
6. Trade is stored in IndexedDB (Dexie) — works offline
7. Weighted average cost is recalculated across all buys of each stock
8. PnL = (current price from GSE API − avg cost) × shares held
