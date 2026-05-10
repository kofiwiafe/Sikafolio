# SikaFolio — Claude Preferences

## App status (as of 2026-05-10, last updated 2026-05-10)
The app is **live at sikafolio.vercel.app** (deployed via Vercel, auto-deploys from `master`).



### What's built
- **Splash / Auth screen** (`Splash.jsx`) — two-step login (username → passcode), industry-standard sign-up (first name, last name, username with live availability check, passcode, confirm passcode), Google OAuth, session persistence via localStorage
- **5 screens** — Portfolio, Trades, Markets, Settings, with a persistent BottomNav
- **Gmail sync** (`gmailService.js`) — OAuth via `@react-oauth/google`; fetches all iC Securities trade notification emails (`from:noreply@ic.africa subject:"Trade Notification" in:anywhere`), parses them, deduplicates by emailId, stores in IndexedDB; incremental syncs after first run using `after:<unix_timestamp>`
- **Gmail confirmation flow** — after OAuth, Settings shows a confirmation card with the Gmail email address before committing; on confirm, app auto-navigates to Trades and auto-starts sync
- **Gmail state persistence** — confirmed Gmail email persisted to localStorage (`sikafolio_gmail_email`); access token kept in memory only (short-lived, expires ~1 hour, must reconnect)
- **Scheduled auto-sync** — removed; App.jsx is now a clean shell (session + screen routing + `usePrices`); auto-sync logic was extracted and is currently not active
- **Paste-to-import** — fallback parser for raw email text copied from any client (no Gmail API needed)
- **Local database** (`db.js`) — Dexie/IndexedDB; version 3 schema; see DB schema section for details
- **Price service** (`priceService.js`) + `usePrices` hook — live GSE stock prices from afx.kwayisi.org via three-tier fetch chain: (1) `/api/gse` Vercel serverless proxy, (2) allorigins.win CORS proxy, (3) Dexie cache; polls every 5 min during market hours (Mon–Fri 10:00–15:00 GMT); parser captures symbol, name, price, change, changePercent, volume; skips non-ticker rows (only accepts 2–10 uppercase letters); after each successful fetch, upserts a daily `priceSnapshots` record to IndexedDB (used by portfolio history chart)
- **Portfolio hook** (`usePortfolio.js`) — computes positions, weighted average cost (WAC), unrealized PnL, realized PnL per holding; re-runs reactively via `useLiveQuery`
- **Portfolio history hook** (`usePortfolioHistory.js`) — returns `{ date, value }[]` sorted chronologically; merges trade settlement dates + price snapshot dates; replays trades per date to get shares held; prices from snapshot (preferred) or `pricePerShare` fallback; filters out zero-value points; used by the sparkline
- **Portfolio page** (`Portfolio.jsx`) — hero card with "Currently worth" value + gold sparkline + time-range toggles (W / 1M / 1Y / All); PnL badge reflects performance within the selected range (first vs last chart point); four 2×2 stat cards below: Investment | Fees paid | Total invested | Stocks held
- **Portfolio sparkline** — hand-rolled SVG polyline with gradient fill area; `usePortfolioHistory` provides historical points; today's live value from `usePortfolio` is always appended as the rightmost point; the range-specific ▲/▼ % badge swaps to all-time PnL when there's fewer than 2 historical points
- **StockCard** (`src/components/StockCard.jsx`) — holding card layout (top-down):
  - Row 1: `CompanyLogo` (size="md") + ticker symbol + share count (16px bold) + unrealised PnL in green/red | right: "Current price" label + GHS price
  - Middle: PnL progress bar (gold if up, red if down); no label on the bar itself
  - Bottom row: "Mkt value" + GHS amount | right: daily % change with ▲/▼ indicator
  - No "X purchases · avg GHS Y" line — that info is not shown on the card
- **AddTradeModal**, **EditTradeModal**, **SyncPanel** — reusable UI components; `EditTradeModal` mirrors `AddTradeModal` but calls `db.trades.update(trade.id, …)` and pre-fills all fields from the existing trade record
- **AddTradeModal symbol combobox** (`AddTradeModal.jsx`) — Symbol field is a searchable combobox backed by `GSE_COMPANIES`; filters by ticker prefix OR company name (case-insensitive); dropdown shows "YOUR HOLDINGS" section (stocks with prior trades) first, then "ALL GSE STOCKS" below; section headers only appear when no search query is active; owned stocks queried reactively via `useLiveQuery(() => db.trades.orderBy('symbol').uniqueKeys(), [], [])`; blur/mousedown race condition avoided by using `onMouseDown` for item selection and `setTimeout(..., 150)` on `onBlur`
- **AddTradeModal fee calculation** — `IC_FEE_RATE = 0.025` (2.5%) is a module-level constant; no manual fee input; `feeVal = +(gross * IC_FEE_RATE).toFixed(2)`; `net = gross + fee` for Buy, `gross - fee` for Sell; summary card shows 3-column Gross | Fee (2.5%) | Net layout when qty × price > 0
- **Trades page** (`Trades.jsx`) — two levels of live PnL + edit/delete per trade row:
  - **Per trade row** (BUY only): `(currentPrice − pricePerShare) × quantity` shown below the net consideration in green/red; hidden for SELL rows; each row has a gold Edit button (opens `EditTradeModal`) and a red Delete button (triggers `VerifyModal` passcode check before deleting)
  - **Per company group header**: total position PnL shown below the share count — calculated as `(currentPrice − avgCost) × netShares` where `avgCost` is the WAC across all buys; consistent with `usePortfolio` logic; hidden if no live price or no remaining shares
  - **VerifyModal** — inline bottom sheet that requires passcode entry (or skips for Google users) before destructive actions; accepts `title`, `subtitle`, `destructive`, `onVerified`, `onCancel` props
- **Settings screen** — shows real user avatar (or initial fallback), Gmail connect/disconnect, Sign out; last sync date and trade count; "Clear all portfolio data" section with inline two-step confirmation (type "DELETE" to unlock, then confirm) that wipes all trades from IndexedDB
- **Markets page** (`Markets.jsx`) — lists all GSE-listed equities with company logo, full name, ticker, live price, absolute + percentage change (colour-coded green/red), and volume; shows GSE Composite Index card at top
- **Company logo system** — `CompanyLogo` component (`src/components/CompanyLogo.jsx`) with three-tier fallback: Clearbit full logo → Google S2 favicon → coloured letter avatar; accepts `size` prop (`"sm"` 32px / `"md"` 40px / `"lg"` 52px); import it anywhere a company logo is needed
- **GSE company registry** (`src/constants/gseCompanies.js`) — single source of truth mapping every GSE ticker to `{ name, domain }`; `getCompany(symbol)` helper returns the entry or a sensible default; update this file when adding new tickers or correcting domains, not inside components

### What's not yet built (known gaps)
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
- `forceFullScan`: deletes `lastSyncDate` AND clears only Gmail-sourced trades (`source !== 'manual'`) before re-importing — preserves manually entered trades; used by "Rescan all history" button
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
- Version 3: adds `priceSnapshots: 'date'`
  - Primary key is the date string `'YYYY-MM-DD'`; `put({ date, values })` naturally upserts one row per day
  - `values` is `{ SYMBOL: price }` — a snapshot of all fetched GSE prices for that day
  - Written by `usePrices` after every successful `fetchLatestPrices()` call
  - Read by `usePortfolioHistory` to reconstruct historical portfolio values

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

## Icons
- Tabler Icons loaded via CDN in `index.html`: `https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css`
- Use class `ti ti-<name>` on `<i>` elements — no npm package needed
- Common icons used: `ti-chart-pie` (portfolio), `ti-history` (trades), `ti-trending-up` (markets), `ti-settings` (settings), `ti-edit`, `ti-trash`, `ti-alert-circle`

## Logo
- The logo image is `src/assets/logo.jpg` (hand holding cash, black silhouette on white).
- It must appear on the yellow (`#C8A84B`) background box wherever a logo placeholder exists.
- Always use `mix-blend-mode: multiply` on the `<img>` so the white background becomes transparent, leaving a black hand on yellow.
- The image should be sized at `80%` width/height of its container with `objectFit: contain`.

## Brand colors (Glass Studio)
- Gold: `#F0C25E` (accent only — never use for large surfaces or body text)
- Gold gradient: `linear-gradient(180deg, #F0C25E 0%, #C99A38 100%)`
- Gold glow: `0 4px 14px rgba(240,194,94,0.27)`
- Background: `#080A10` + radial gold ambient via `--bg-grad`
- Surface (cards): `linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)` — glass gradient, never solid
- Surface solid: `#10131A` (modals, bottom sheets)
- Border: `rgba(255,255,255,0.07)`
- Divider: `rgba(255,255,255,0.06)`
- Text: `#FAFBFD` → `#9BA1AD` (muted) → `#5C6470` (dim)
- Green: `#5BE38C` (positive / BUY)
- Red: `#FF8E8A` (negative / SELL)

## Logo component (`src/components/Logo.jsx`)
- `size="lg"` — 72 × 72 box, border-radius 22, used on the Splash screen.
- `size="md"` (default) — 30 × 30 box, border-radius 9, used in the nav bar.
- Layout: column (icon above text) for `lg`, row for `md`.

## CSS conventions
- Autofill override in `index.css` uses `#080A10` (new bg) so browser autofill doesn't flash blue
- CSS variables defined in `:root` — use them (`var(--gold)`, `var(--bg)`, `var(--text)`, etc.); avoid inline hex literals
- Inline styles used throughout (no Tailwind in component JSX) — keep this pattern
- All numbers use `'JetBrains Mono', ui-monospace, monospace`; all UI labels use `'Manrope', system-ui, sans-serif`
- Body sets `background: var(--bg)` AND `background-image: var(--bg-grad)` (layered) — the gold radial ambient at top is the signature of the Glass Studio direction
- Cards use `backdrop-filter: blur(20px)` — do not add drop shadows to cards; only `--gold-glow` goes on the primary button

## Dark theme rules (Glass Studio)

### Typography
- UI / labels / body: Manrope. Weights 400 / 500 / 600 / 700.
- All numbers: JetBrains Mono. No exceptions — prices, percents, volumes, dates.
- Hero numbers: 30–44px, weight 500, `letter-spacing: -1px` to `-1.5px`.
- Body: 13px. Secondary: 11–12px. Microcopy / eyebrows: 10–11px UPPERCASE, `letter-spacing: 0.4px`, weight 600.
- Body text never below 12px; microcopy never below 10px.

### Color usage
- Foreground hierarchy: `--text` → `--muted` → `--dim`. Don't invent in-between grays.
- Gold reserved for: wordmark "Folio", primary action button, active nav item, ticker symbols on logo rows, sparkline fill on positive, range-selector active chip.
- Never gold for: card backgrounds, body text, full-width fills, section headers.
- Green/red are semantic only. Green = positive change, BUY, live indicator. Red = negative change, SELL.
- A green/red value must carry a ▲/▼ glyph so color is not the only signal.

### Glass card
Every card uses this pattern:
```css
background: var(--surface);          /* gradient, not solid */
border: 1px solid var(--border);
border-radius: var(--r-md);
backdrop-filter: blur(20px);
overflow: hidden;
position: relative;
```
Hero cards (one per screen max) add a gold ambient blob: `position:absolute; top:0; right:0; width:200px; height:150px; background: radial-gradient(circle, rgba(240,194,94,0.12) 0%, transparent 65%); pointer-events:none`.

### Holding / trade row accent bar
Holding and trade group cards get a 3px left-edge bar (`position:absolute; left:0; top:0; bottom:0; width:3px`):
- Up: `linear-gradient(180deg, #5BE38C, rgba(91,227,140,0.33))`
- Down: `linear-gradient(180deg, #FF8E8A, rgba(255,142,138,0.33))`

### Anti-patterns
- ❌ Solid card backgrounds — every card uses the `--surface` gradient.
- ❌ Drop shadows on cards (gold glow is only for the primary button).
- ❌ Gold for body text or section headings.
- ❌ Inline color literals — always use CSS variables.
- ❌ Body text below 12px; microcopy below 10px.
- ❌ Multiple shades of gold on one screen.
