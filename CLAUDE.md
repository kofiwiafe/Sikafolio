# SikaFolio — Claude Preferences

## App status (as of 2026-05-12, last updated 2026-05-13)
The app is **live at sikafolio.vercel.app** (deployed via Vercel, auto-deploys from `master`).



### What's built
- **Splash / Auth screen** (`Splash.jsx`) — two-step login (username → passcode), industry-standard sign-up (first name, last name, username with live availability check, passcode, confirm passcode), Google OAuth, session persistence via localStorage
- **6 screens** — Portfolio, Trades, Markets, News, Settings, with a persistent BottomNav (5 tabs; nav button padding 8px to accommodate)
- **Gmail sync** (`gmailService.js`) — OAuth via `@react-oauth/google`; fetches all iC Securities trade notification emails (`from:noreply@ic.africa subject:"Trade Notification" in:anywhere`), parses them, deduplicates by emailId, stores in IndexedDB; incremental syncs after first run using `after:<unix_timestamp>`
- **Gmail confirmation flow** — after OAuth, Settings shows a confirmation card with the Gmail email address before committing; on confirm, app auto-navigates to Trades and auto-starts sync
- **Gmail state persistence** — confirmed Gmail email persisted to localStorage (`sikafolio_gmail_email`); access token kept in memory only (short-lived, expires ~1 hour, must reconnect)
- **Scheduled auto-sync** — removed; App.jsx is now a clean shell (session + screen routing + `usePrices`); auto-sync logic was extracted and is currently not active
- **Paste-to-import** — fallback parser for raw email text copied from any client (no Gmail API needed)
- **ImportScreenshotModal** (`src/components/ImportScreenshotModal.jsx`) — bottom-sheet modal for importing trades from iC Wealth Order History screenshots; OCR via **Gemini API** (`api/ocr.js`, model `gemini-2.5-flash`); image is resized client-side to max 1600px and base64-encoded before sending; Gemini returns structured JSON directly (no regex parser needed); prompt instructs it to extract all trade cards with orderType, symbol, quantity, grossConsideration, date (YYYY-MM-DD), and orderNumber; fee auto-calculated at 2.5%; deduplication: `checkDuplicate()` checks `orderNumber` first, falls back to `emailId` (`screenshot_<orderNumber>` or `screenshot_<SYMBOL>_<date>_<qty>` when order number unreadable); saved with `source: 'screenshot'`
  - **Editable preview** — after OCR, each non-duplicate card shows a pencil icon (✏) to expand inline edit form with: Buy/Sell toggle, symbol input, date text input (dd/mm/yy format), shares + gross inputs; fee (2.5%), net, and price-per-share recalculate live; "Save changes" writes back to preview state recomputing all derived fields; Import button shows "Finish editing first" and is disabled while any card is open for editing; duplicate cards are dimmed and not editable
  - **Order number display** — shown in read-only card rows as `Order #XXXXXXXXX` (dim monospace, below the GHS + date line) and as a non-editable reference header inside the edit form; hidden if OCR couldn't read it; still used for deduplication
  - **Date format** — all dates shown as `dd/mm/yy` (e.g. `14/04/26`); edit form uses a `type="text"` input (not `type="date"`) with `toDisplayDate`/`fromDisplayDate` helpers converting between display format and internal `YYYY-MM-DD`; `executionDate` in draft state only updates when the full pattern is matched, so partial typing doesn't corrupt the stored value
- **Local database** (`db.js`) — Dexie/IndexedDB; version 4 schema; see DB schema section for details
- **Price service** (`priceService.js`) + `usePrices` hook — live GSE stock prices from afx.kwayisi.org via three-tier fetch chain: (1) `/api/gse` Vercel serverless proxy, (2) allorigins.win CORS proxy, (3) Dexie cache; polls every 5 min during market hours (Mon–Fri 10:00–15:00 GMT); parser captures symbol, name, price, change, changePercent, volume; skips non-ticker rows (only accepts 2–10 uppercase letters); after each successful fetch, upserts a daily `priceSnapshots` record to IndexedDB (used by portfolio history chart); `isMarketOpen()` is **exported** so UI components can use it directly
- **Portfolio hook** (`usePortfolio.js`) — computes positions, WAC, unrealized PnL, realized PnL per holding; also totals `stocksSold` (sum of `grossConsideration` from ALL sell trades, including fully-sold positions) before the holdings filter so no sold cash is missed; re-runs reactively via `useLiveQuery`
- **Portfolio history hook** (`usePortfolioHistory.js`) — returns `{ date, value }[]` sorted chronologically; merges trade settlement dates + price snapshot dates; replays trades per date to get shares held; prices from snapshot (preferred) or `pricePerShare` fallback; filters out zero-value points; **currently unused** (sparkline was removed)
- **Portfolio page** (`Portfolio.jsx`) — hero card with two equal columns: left = "Current Balance" (GHS value, 28px mono) + day-over-day % badge (weighted `changePercent` across holdings, hidden when no prices); right = "Profit / Loss (P&L)" (GHS PnL in green/red, 28px mono); vertical border divider between columns; gold ambient blob top-right; four 2×2 stat cards below: **Invested | Fees paid | Stocks sold | Stocks held**; header right shows market status chip (see below) that opens `PriceInfoSheet` on tap
- **Stocks sold stat** — total gross cash received from all sell trades ever (`summary.stocksSold`); not profit, just the money received; includes stocks fully sold (which are excluded from holdings)
- **StockCard** (`src/components/StockCard.jsx`) — three-column holding card; left column (`flex:1`) + middle (fixed `width:110`) + right (fixed `width:100`) for consistent cross-card alignment:
  - Left column (stacked): top row = `CompanyLogo` (size="md") + ticker (gold, 15px bold) + share count + company name below; bottom row = "P&L" label + ▲/▼ value + (pct%) all inline
  - Middle column: "Current value" label (no GHS prefix) + formatted value, centered
  - Right column: "Current price" label (no GHS prefix) + price + daily ▲/▼ X.XX% (no "today"), right-aligned
  - No "X purchases · avg GHS Y" line — that info is not shown on the card
- **ConfirmCodeModal** (`src/components/ConfirmCodeModal.jsx`) — shared bottom-sheet modal for confirming destructive or sensitive actions; generates a random 4-digit code (1000–9999) via `useMemo` on mount, displays it large in accent color, requires exact match in a numeric input before enabling Confirm; `destructive` prop switches theme from gold to red; shake animation on wrong code entry; works identically for all user types (no DB lookup, no passcode required); used by Trades (edit + delete) and Settings (clear all data)
- **AddTradeModal**, **EditTradeModal** — reusable UI components; `EditTradeModal` mirrors `AddTradeModal` but calls `db.trades.update(trade.id, …)` and pre-fills all fields from the existing trade record
- **AddTradeModal symbol combobox** (`AddTradeModal.jsx`) — Symbol field is a searchable combobox backed by `GSE_COMPANIES`; filters by ticker prefix OR company name (case-insensitive); dropdown shows "YOUR HOLDINGS" section (stocks with prior trades) first, then "ALL GSE STOCKS" below; section headers only appear when no search query is active; owned stocks queried reactively via `useLiveQuery(() => db.trades.orderBy('symbol').uniqueKeys(), [], [])`; blur/mousedown race condition avoided by using `onMouseDown` for item selection and `setTimeout(..., 150)` on `onBlur`
- **AddTradeModal fee calculation** — `IC_FEE_RATE = 0.025` (2.5%) is a module-level constant; no manual fee input; `feeVal = +(gross * IC_FEE_RATE).toFixed(2)`; `net = gross + fee` for Buy, `gross - fee` for Sell; summary card shows 3-column Gross | Fee (2.5%) | Net layout when qty × price > 0
- **Trades page** (`Trades.jsx`) — two levels of live PnL + edit/delete per trade row:
  - **Per trade row** (BUY only): `(currentPrice − pricePerShare) × quantity` shown below the net consideration in green/red; hidden for SELL rows; each row has a gold Edit button and a red Delete button — both trigger `ConfirmCodeModal` before executing
  - **Per company group header**: total position PnL shown below the share count — calculated as `(currentPrice − avgCost) × netShares` where `avgCost` is the WAC across all buys; consistent with `usePortfolio` logic; hidden if no live price or no remaining shares
  - **P&L consistency**: per-trade P&Ls are pre-computed inside `CompanyGroup` using the same `currentPrice` variable that drives the group header, then passed as a `pnl` prop to each `TradeRow` — this guarantees the sum of individual rows always equals the group total (no stale-render divergence)
  - Edit flow: code confirmed → `setEditing(trade)` opens `EditTradeModal`; Delete flow: code confirmed → `db.trades.delete(trade.id)`
- **Settings screen** (`Settings.jsx`) — redesigned with icon-chip rows grouped into glass cards by section:
  - **Gmail sync section** — connected account row (shows email + green "Connected" badge if linked, reads `sikafolio_gmail_email` from localStorage), last synced date row (from `syncMeta`), "Rescan all history" row with trade count sub-label
  - **iC Securities section** — "Direct broker sync" and "Import from statement" rows; both open a `ComingSoonModal` bottom sheet (gold icon, "Coming soon" copy, "Got it" dismiss); no functionality behind these yet
  - **Data section** — "Export trades" row downloads all trades as a CSV (`sikafolio-trades-YYYY-MM-DD.csv`) via `exportCSV()`; "Notifications" row shows a "Soon" badge (non-tappable); "Clear all portfolio data" row (danger/red styling) triggers `ConfirmCodeModal`
  - **Sign out** ghost button below the data section
  - **About footer** — `SikaFolio v1.0.0` and `Prices: afx.kwayisi.org · GSE` as 11px dim microcopy; replaces the old Prices + Display info rows which were read-only clutter
  - `SettingsRow` internal component: accepts `icon`, `label`, `sub`, `value`, `valueColor`, `onClick`, `chevron`, `danger` props; renders a 32px icon chip + text block + optional right value/chevron
- **Markets page** (`Markets.jsx`) — lists all GSE-listed equities with company logo, full name, ticker, live price, absolute + percentage change (colour-coded green/red), and volume; shows GSE Composite Index card at top; header right shows market status chip (see below) that opens `PriceInfoSheet` on tap
- **Market status chip** — appears in the top-right header of Portfolio and Markets pages; uses `isMarketOpen()` to show `● MARKET OPEN` (green tint, animated dot) or `● MARKET CLOSED` (muted, static grey dot) + `ⓘ` icon; tapping opens `PriceInfoSheet`
- **PriceInfoSheet** (`src/components/PriceInfoSheet.jsx`) — bottom-sheet modal explaining price data context; states prices are official GSE closing prices (updated once after each session, 15:00 GMT), not real-time broker feed prices; shows source row (afx.kwayisi.org + last-updated time); backdrop tap or "Got it" button to dismiss; used by Portfolio and Markets
- **Company logo system** — `CompanyLogo` component (`src/components/CompanyLogo.jsx`) with three-tier fallback: Clearbit full logo → Google S2 favicon → coloured letter avatar; accepts `size` prop (`"sm"` 32px / `"md"` 40px / `"lg"` 52px); import it anywhere a company logo is needed
- **GSE company registry** (`src/constants/gseCompanies.js`) — single source of truth mapping every GSE ticker to `{ name, domain }`; `getCompany(symbol)` helper returns the entry or a sensible default; update this file when adding new tickers or correcting domains, not inside components
- **News page** (`src/pages/News.jsx`) — 5th tab (`ti-news`); fetches Ghanaian financial news RSS feeds via `/api/news` Vercel proxy; two tabs: "Your stocks" (default) filters articles matching user's holdings, "All GSE news" shows everything:
  - **Matching logic** — `buildSearchTerms(symbol)` generates search terms from `GSE_COMPANIES`: full name, first word, first two words, and the ticker itself (e.g. MTNGH → ["MTN Ghana", "MTN", "MTNGH"]); `articleMatchesSymbol()` checks title + description case-insensitively
  - **NewsCard** — gold ticker chips for each matched holding, gold left-accent bar, headline (13px 600), description excerpt (3-line clamp), source + relative timestamp footer, full-page `<a>` link to article; accent bar only appears when the card matches a holding
  - **States** — skeleton loading (4 placeholder cards), error state with retry button, empty state for "Your stocks" with escape hatch to "All GSE news"
  - **Refresh** — header button with `.spinning` CSS animation while loading
  - **Tab count badge** — "Your stocks · N" shows match count when non-zero

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
- `netShares = totalBought - totalSold` — if ≤ 0, position is excluded from holdings
- `stocksSold` is computed from raw `trades` BEFORE the holdings filter so fully-sold stocks are counted; it is the sum of `grossConsideration` on all sell trades (not profit)
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
- Version 4: adds `orderNumber` index to `trades` for screenshot import dedup

### Trade date fields
- `executionDate` — used for display and sort order in Trades.jsx; stored as full ISO string by Gmail/paste/manual, as `YYYY-MM-DD` by screenshot import; all consumers use `new Date(executionDate)` or `.slice(0, 10)` so both formats work
- `settlementDate` — secondary display field ("settled …"); raw string from Gmail email body, `YYYY-MM-DD` from manual/screenshot/edit; used by `usePortfolioHistory` via `toDate = str => str?.slice(0, 10)` fallback chain; may be null for Gmail trades where settlement line was missing in the email

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
- `api/news.js` — fetches RSS feeds from CitiBusinessNews (`citibusinessnews.com/feed/`), Myjoyonline Business (`myjoyonline.com/business/feed/`), and GhanaBusinessNews (`ghanabusinessnews.com/feed/`) in parallel via `Promise.allSettled`; parses XML with regex (handles CDATA + HTML entity decoding); caps at 60 articles sorted by pubDate; `Cache-Control: s-maxage=900` (15 min); returns `{ title, link, description, pubDate, source }[]`; partial failures are silently swallowed so one dead feed doesn't break the whole response; 8-second per-feed timeout via `AbortSignal.timeout(8000)`
- `api/ocr.js` — receives `{ image: base64string, mimeType }` POST; calls `gemini-2.5-flash` via the Generative Language API with a structured prompt; returns `{ trades: [...] }` as parsed JSON; requires `GEMINI_API_KEY` env var (free tier: 1500 req/day at aistudio.google.com); 30-second timeout; must be tested via `vercel dev` (not `vite dev`) since Vite can't proxy to a local serverless function

## Vite config
- Fixed port: `server: { port: 5173, strictPort: true }` — will error instead of silently switching ports
- Dev proxy: `/api/gse` → `https://afx.kwayisi.org/gse/` so the same fetch path works in both dev and Vercel prod
- `/api/ocr` and `/api/news` are **not** proxied by Vite — use `vercel dev` (port 3000) when testing screenshot import or the News page locally; `vite dev` (port 5173) is fine for everything else

## Icons
- Tabler Icons loaded via CDN in `index.html`: `https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css`
- Use class `ti ti-<name>` on `<i>` elements — no npm package needed
- Common icons used: `ti-chart-pie` (portfolio), `ti-history` (trades), `ti-trending-up` (markets), `ti-news` (news tab), `ti-settings` (settings), `ti-edit`, `ti-trash`, `ti-alert-circle`, `ti-mail`, `ti-refresh`, `ti-building-bank`, `ti-file-import`, `ti-download`, `ti-bell`, `ti-clock`

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
- `.spinning` utility class — `animation: spin 0.8s linear infinite` (keyframe defined in index.css); use on any `<i>` element for a loading spinner

## Dark theme rules (Glass Studio)

### Typography
- UI / labels / body: Manrope. Weights 400 / 500 / 600 / 700.
- All numbers: JetBrains Mono. No exceptions — prices, percents, volumes, dates.
- Hero numbers: 30–44px, weight 500, `letter-spacing: -1px` to `-1.5px`.
- Body: 13px. Secondary: 11–12px. Microcopy / eyebrows: 10–11px UPPERCASE, `letter-spacing: 0.4px`, weight 600.
- Body text never below 12px; microcopy never below 10px.

### Color usage
- Foreground hierarchy: `--text` → `--muted` → `--dim`. Don't invent in-between grays.
- Gold reserved for: wordmark "Folio", primary action button, active nav item, ticker symbols on logo rows.
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
