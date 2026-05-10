# SikaFolio — Claude Preferences

## App status (as of 2026-05-10, last updated 2026-05-10)
The app is **live at sikafolio.vercel.app** (deployed via Vercel, auto-deploys from `master`).



### What's built
- **Splash / Auth screen** (`Splash.jsx`) — two-step login (username → passcode), industry-standard sign-up (first name, last name, username with live availability check, passcode, confirm passcode), Google OAuth, session persistence via localStorage
- **5 screens** — Portfolio, Trades, Markets, Settings, with a persistent BottomNav
- **Gmail sync** (`gmailService.js`) — OAuth via `@react-oauth/google`; fetches all iC Securities trade notification emails (`from:noreply@ic.africa subject:"Trade Notification" in:anywhere`), parses them, deduplicates by emailId, stores in IndexedDB; incremental syncs after first run using `after:<unix_timestamp>`
- **Gmail confirmation flow** — after OAuth, Settings shows a confirmation card with the Gmail email address before committing; on confirm, app auto-navigates to Trades and auto-starts sync
- **Gmail state persistence** — confirmed Gmail email persisted to localStorage (`sikafolio_gmail_email`); access token kept in memory only (short-lived, expires ~1 hour, must reconnect)
- **Scheduled auto-sync** (`App.jsx`) — while the app is open and a Gmail token is in memory, a `setInterval` fires every 60s and triggers a silent background `syncTrades` call at 6:00 and 12:00 local time; a `useRef` key (`"<date>-<hour>"`) prevents double-firing within the same hour
- **Paste-to-import** — fallback parser for raw email text copied from any client (no Gmail API needed)
- **Local database** (`db.js`) — Dexie/IndexedDB; version 2 schema adds `users` table
- **Price service** (`priceService.js`) + `usePrices` hook — live GSE stock prices from afx.kwayisi.org via three-tier fetch chain: (1) `/api/gse` Vercel serverless proxy, (2) allorigins.win CORS proxy, (3) Dexie cache; polls every 5 min during market hours (Mon–Fri 10:00–15:00 GMT); parser captures symbol, name, price, change, changePercent, volume; skips non-ticker rows (only accepts 2–10 uppercase letters)
- **Portfolio hook** (`usePortfolio.js`) — computes positions, weighted average cost (WAC), unrealized PnL, realized PnL per holding; re-runs reactively via `useLiveQuery`
- **StockCard**, **AddTradeModal**, **SyncPanel** — reusable UI components
- **Settings screen** — shows real user avatar (or initial fallback), Gmail connect/disconnect, Sign out; last sync date and trade count
- **Markets page** (`Markets.jsx`) — lists all GSE-listed equities with company logo, full name, ticker, live price, absolute + percentage change (colour-coded green/red), and volume; shows GSE Composite Index card at top
- **Company logo system** — `CompanyLogo` component (`src/components/CompanyLogo.jsx`) with three-tier fallback: Clearbit full logo → Google S2 favicon → coloured letter avatar; accepts `size` prop (`"sm"` 32px / `"md"` 40px / `"lg"` 52px); import it anywhere a company logo is needed
- **GSE company registry** (`src/constants/gseCompanies.js`) — single source of truth mapping every GSE ticker to `{ name, domain }`; `getCompany(symbol)` helper returns the entry or a sensible default; update this file when adding new tickers or correcting domains, not inside components

### What's not yet built (known gaps)
- Manual trade entry UI (AddTradeModal exists but flow not confirmed end-to-end)
- Push notifications / true background sync (scheduled sync only fires while the app is open)
- Access token refresh (tokens expire after ~1 hour; user must reconnect Gmail from Settings)

## Auth system

### Local accounts
- Username (stored in the `email` DB column as unique identifier) + passcode
- Two-step login: step 1 enter username → look up in DB → step 2 enter passcode
- Sign-up collects: first name, last name, username (min 3 chars, no spaces, live availability check), passcode (min 4 chars), confirm passcode
- Username availability checked via Dexie query, debounced 500ms, shown as "✓ Available" / "✕ Taken" next to the field
- Input border turns green/red to reflect passcode match and username availability

### Google accounts
- OAuth via `@react-oauth/google` using `useGoogleLogin` implicit flow
- Scopes: `openid email profile https://www.googleapis.com/auth/gmail.readonly` — all requested in one consent
- On success: fetches `https://www.googleapis.com/oauth2/v2/userinfo`, upserts to `db.users` with `provider: 'google'`
- Google users have no username or passcode — they always sign in via "Continue with Google"
- Google Client ID is in `.env` as `VITE_GOOGLE_CLIENT_ID`
- Google Cloud project: **Sikafolio** (project=sikafolio)
- OAuth app is in **Testing** mode — only explicitly added test users can sign in
- Test user added: `asaresylvester8@gmail.com`
- Authorized JS origins: `http://localhost:5173`, `https://sikafolio.vercel.app`

### Session persistence
- On login, `{ email, name, avatar }` stored to localStorage under key `sikafolio_session`
- Access token kept in memory only (not persisted — short-lived, no refresh token)
- On app load: if session exists → skip splash, go straight to portfolio
- On logout: localStorage cleared, state reset, returns to splash

## Gmail sync details

### Email format (iC Securities)
Subject: `IC Securities (Ghana) Limited - Trade Notification`  
Sender: `noreply@ic.africa`  
Body fields (may be collapsed onto one line in HTML emails):
```
Order Type: Buy
Equity   GSE MTNGH       ← may also be GSE.SIC format
Share Quantity: 41
Gross Consideration: 278.80
Processing Fee: 6.98
Net Consideration: 285.78
Settlement Date:  Tue, 12 May, 2026
```

### Parser rules (`gmailService.js`)
- `get(label)` uses a stop-word lookahead `(?=\s*(?:Order|Equity|Share|Gross|Processing|Net|Settlement|Account|Dear|Thank|$))` capped at 100 chars — critical because iC emails often collapse all fields onto one line in HTML, so `[^\n]+` would capture everything
- Symbol: strips `GSE[.\s]+` prefix (handles both `GSE MTNGH` and `GSE.SIC` formats), uppercased
- `orderType` must be `'Buy'` or `'Sell'` exactly — the portfolio hook does `=== 'Buy'` comparison
- HTML fallback converts `<br>`, `<p>`, `<div>`, `<tr>`, `<td>`, `<li>` to newlines before stripping tags
- `in:anywhere` on the Gmail query catches emails in spam/trash

### Sync flow
- First run: fetches ALL historical emails, no `after:` filter
- Subsequent runs: adds `after:<unix_timestamp of lastSyncDate>` to query
- `forceFullScan`: deletes `lastSyncDate` AND clears all trades before re-importing — used by "Rescan all history" button
- "Rescan all history" button shows whenever Gmail is connected and a prior sync exists (not just when trades.length === 0)
- After sync, `lastSyncDate` saved to `syncMeta` table in IndexedDB
- Scheduled auto-sync: `App.jsx` checks time every 60s and calls `syncTrades(accessToken, null)` silently at 6:00 and 12:00; only fires if token is in memory (no background sync when app is closed)

### Portfolio calculation
- `usePortfolio` groups trades by symbol, then by `orderType === 'Buy'` vs sell
- WAC (weighted average cost) = total gross consideration / total shares bought
- `netShares = totalBought - totalSold` — if ≤ 0, position is excluded
- PnL = `(currentPrice * netShares) - (avgCost * netShares)` using live GSE prices
- Prices keyed by uppercase ticker symbol (e.g., `'MTNGH'`, `'SIC'`, `'GCB'`, `'CAL'`) — must match parsed trade symbols exactly

### DB schema (`db.js`)
- Version 1: `trades`, `prices`, `syncMeta`
- Version 2: adds `users: '++id, &email, name, passcode, avatar, provider'`
  - `&email` is the unique login identifier (stores actual email for Google, username for local)
  - `provider`: `'google'` | `'local'`

## Splash screen design preferences
- No "Sign in" header inside the card — the logo + tagline above serve that purpose
- Google button always below the gold primary button, separated by an "or" divider
- No feature pill buttons below the card
- Sign-up page: Google path at top, "or create a username account" divider, manual form below
- No explanatory info boxes — keep it clean
- Input borders change color (green/red) to give live feedback on username availability and passcode match
- Labels above inputs (not placeholder-only) for sign-up fields

## Vercel API routes
- `api/gse.js` — serverless function that proxies `https://afx.kwayisi.org/gse/` with a proper `User-Agent`; returns raw HTML with `Cache-Control: s-maxage=300`; avoids third-party CORS proxies in production

## Vite config
- Fixed port: `server: { port: 5173, strictPort: true }` — will error instead of silently switching ports
- Dev proxy: `/api/gse` → `https://afx.kwayisi.org/gse/` so the same fetch path works in both dev and Vercel prod

## Logo
- The logo image is `src/assets/logo.jpg` (hand holding cash, black silhouette on white).
- It must appear on the yellow (`#C8A84B`) background box wherever a logo placeholder exists.
- Always use `mix-blend-mode: multiply` on the `<img>` so the white background becomes transparent, leaving a black hand on yellow.
- The image should be sized at `80%` width/height of its container with `objectFit: contain`.

## Brand colors
- Gold / yellow: `#C8A84B`
- Dark background: `#0d1117`
- Card background: `#131820`
- Border: `#1e2530`

## Logo component (`src/components/Logo.jsx`)
- `size="lg"` — 72 × 72 box, border-radius 22, used on the Splash screen.
- `size="md"` (default) — 30 × 30 box, border-radius 9, used in the nav bar.
- Layout: column (icon above text) for `lg`, row for `md`.

## CSS conventions
- Autofill override in `index.css` prevents browser blue autofill background on dark inputs:
  `-webkit-box-shadow: 0 0 0px 1000px #0d1117 inset` with `-webkit-text-fill-color: #e0e0e0`
- CSS variables defined in `:root` — use them (`var(--gold)`, `var(--night)`, etc.) for consistency
- Inline styles used throughout (no Tailwind in component JSX) — keep this pattern
