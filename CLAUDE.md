# SikaFolio — Claude Preferences

## App status (as of 2026-05-16, last updated 2026-05-20, sync deployed 2026-05-16)
The app is **live at sikafolio.vercel.app** (deployed via Vercel, auto-deploys from `master`).

### What's built
- **Splash / Auth screen** (`Splash.jsx`) — two-step login (username → passcode), industry-standard sign-up (first name, last name, username with live availability check, passcode, confirm passcode), Google OAuth, session persistence via localStorage
- **6 screens** — Portfolio, Trades, Markets, News, Settings, with a persistent BottomNav (5 tabs; nav button padding 8px to accommodate)
- **ImportScreenshotModal** (`src/components/ImportScreenshotModal.jsx`) — centered modal for importing trades from iC Securities Contract Note screenshots (one trade per note); OCR via **Gemini API** (`api/ocr.js`, model `gemini-2.5-flash`); image is resized client-side to max 1600px and base64-encoded before sending; Gemini returns structured JSON directly (no regex parser needed); prompt extracts: `orderType`, `symbol`, `quantity`, `grossConsideration`, `fee` (exact "Total Charges & Levies" — never estimated), `date` (Trade Date), `settlementDate`, `orderNumber`, `tradeId`; `executionDate` is set to `settlementDate` (falls back to Trade Date); saved with `source: 'contract_note'`; deduplication: `checkDuplicate(tradeId, orderNumber, emailId)` is a **synchronous** function passed in from `useTrades` that checks against the in-memory trades array — if `tradeId` is present, checks only `tradeId` and returns immediately (match = duplicate, no match = not duplicate, stops here); this is critical because iC Securities reuses the same `orderNumber` across partial fills of one order, so falling through to `orderNumber` would wrongly flag a second fill as a duplicate; `orderNumber` check only runs when `tradeId` is absent; final fallback is `emailId` (`screenshot_<orderNumber>` or `screenshot_<SYMBOL>_<date>_<qty>`)
  - **Editable preview** — after OCR, each non-duplicate card shows a pencil icon (✏) to expand inline edit form with: Buy/Sell toggle, symbol input, date text input (dd/mm/yy format), shares + gross + **charges (GHS)** inputs (fee is editable, not derived); net and price-per-share recalculate live from actual fee; "Save changes" writes back to preview state; Import button shows "Finish editing first" and is disabled while any card is open for editing; duplicate cards are dimmed and not editable
  - **Read-only card** — shows `GHS {gross} · Charges {fee} · {date}` and `Order #{orderNumber} · Trade ID {tradeId}` (dim monospace); fields hidden individually if OCR couldn't read them
  - **Date format** — all dates shown as `dd/mm/yy` (e.g. `14/04/26`); edit form uses a `type="text"` input (not `type="date"`) with `toDisplayDate`/`fromDisplayDate` helpers converting between display format and internal `YYYY-MM-DD`; `executionDate` in draft state only updates when the full pattern is matched, so partial typing doesn't corrupt the stored value
  - **Post-import flow** — done screen shows "Import another" (resets modal to idle) + "Done" (closes); enables back-to-back contract note imports without reopening the sheet
  - Props: `onClose`, `addTrades` (from `useTrades`), `checkDuplicate` (from `useTrades`)
- **Cloud database** — Neon serverless Postgres (via `@neondatabase/serverless`); connection string in `DATABASE_URL` env var; four tables: `users`, `trades`, `sync_meta`, `comments`; schema in `sql/schema.sql`; all user data syncs across devices automatically
- **Local cache** (`src/services/db.js`) — Dexie/IndexedDB v6; **only** stores `prices` and `priceSnapshots` (local price cache); `users`, `trades`, `syncMeta` were removed from IndexedDB in v6 (migrated to Neon)
- **Trade state** (`src/hooks/useTrades.js`) — fetches all trades for the logged-in user from `/api/trades`; holds them in React state at the App level; provides `addTrade`, `addTrades`, `updateTrade`, `deleteTrade`, `deleteTradesBySource`, `clearAllTrades`, `checkDuplicate`; passed as props down to Portfolio, Trades, Settings, News; no more `useLiveQuery` anywhere in the trade flow
- **Price service** (`priceService.js`) + `usePrices` hook — live GSE stock prices from afx.kwayisi.org via four-tier fetch chain: (1) `/api/gse` Vercel serverless proxy (tries direct fetch + allorigins server-side), (2) allorigins.win client-side CORS proxy, (3) codetabs.com client-side CORS proxy, (4) Dexie cache (filtered to price > 0 only); polls every 5 min during market hours (Mon–Fri 10:00–15:00 GMT); parser captures symbol, name, price, change, changePercent, volume; skips non-ticker rows (only accepts 2–10 uppercase letters); after each successful fetch, upserts a daily `priceSnapshots` record to IndexedDB (used by portfolio history chart); `isMarketOpen()` is **exported** so UI components can use it directly; client-side proxies handle both JSON-wrapped (allorigins) and raw HTML (codetabs) responses
- **Portfolio hook** (`usePortfolio.js`) — **pure computation function** (not a hook with DB access); takes `(trades, prices)` as arguments; computes positions, WAC, unrealized PnL, realized PnL per holding; totals `stocksSold` from ALL sell trades before the holdings filter; when no live price is available, falls back to `pricePerShare` of the most recent buy; exposes `hasLivePrice: boolean` on each holding
- **Portfolio history hook** (`usePortfolioHistory.js`) — returns `{ date, value }[]`; **currently unused** (sparkline was removed); still references Dexie `db.trades` so do not import it without updating first
- **Portfolio page** (`Portfolio.jsx`) — header shows greeting + first name on one line (20px Manrope weight 700, both in `--text`); hero card with two equal columns: left = "Current Balance", right = "Profit / Loss (P&L)"; column labels are 12px Manrope weight 600 `--text` uppercase (prominent, not muted); each column shows "GHS" as a muted 15px label on its own line above the 38px mono value (stacked layout, not inline); Current Balance in `--text`, P&L in green/red; vertical border divider between columns; gold ambient blob top-right; no day-change badge; footnote strip inside the hero card (below a hairline divider): **Invested | Fees paid | Stocks sold | Stocks held** all on one row with vertical pipe separators (9px dim uppercase labels, 11px muted mono values); then `TopPerformers` bar chart; then Holdings list; header right shows market status chip (see below) that opens `PriceInfoSheet` on tap; receives `trades` + `tradesLoading` as props
- **TopPerformers** (`src/components/TopPerformers.jsx`) — pure CSS bar chart inside a glass card; shown between the footnote strip and the Holdings list on the Portfolio page; **only shows profitable holdings** (pnlPct > 0) as green bars, sorted by pnlPct descending, up to 5; bar height proportional to highest pnlPct (min 4px), container height 192px, max bar 144px; label above each bar shows `GHS +XX.XX` (currency gain via `unrealizedPnL`, 11px green weight 600); ticker below bar is white (`#FFFFFF`) 12px weight 700; losing holdings shown as compact dim chips in an "In the red:" row below a hairline divider (symbol + pnlPct%); hidden entirely when no holdings are profitable; requires at least 1 winner to render (no minimum 2 guard); **entry animation**: each bar uses `bar-grow` (0.75s, `cubic-bezier(0.22,1,0.36,1)`, `transform-origin: bottom`) with a 100ms staggered delay per bar; GHS label and ticker use `fade-up` (0.5s ease-out) delayed ~200–250ms after their bar — all keyframes defined in `index.css`
- **Stocks sold stat** — total gross cash received from all sell trades ever (`summary.stocksSold`); not profit, just the money received; includes stocks fully sold (which are excluded from holdings)
- **StockCard** (`src/components/StockCard.jsx`) — three-column flex holding card; outer row uses `alignItems: stretch` so all columns fill the same height:
  - Left column (`flex:1`, stacked): top row = `CompanyLogo` (size="md") + ticker (gold, 15px bold) + share count + company name below; bottom row = "P&L" label + ▲/▼ value + (pct%) all inline
  - Center column (`flex:1`, column + `alignItems:center` + `justifyContent:center`): "Value" label + formatted GHS value + 14px spacer at bottom (matches day-change row height in right column, ensuring VALUE and PRICE numbers land at the same vertical position)
  - Right column (`flexShrink:0`, right-aligned, `justifyContent:center`): "Price" label + price; daily ▲/▼ X.XX% — or `"no live price"` dim text when `hasLivePrice` is false
  - No "X purchases · avg GHS Y" line — that info is not shown on the card
- **ConfirmCodeModal** (`src/components/ConfirmCodeModal.jsx`) — centered modal for confirming destructive or sensitive actions; generates a random 4-digit code (1000–9999) via `useMemo` on mount, displays it large in accent color, requires exact match in a numeric input before enabling Confirm; `destructive` prop switches theme from gold to red; shake animation on wrong code entry; used by Trades (edit + delete) and Settings (clear all data)
- **AddTradeModal** (`AddTradeModal.jsx`) — file exists but is **not reachable from the UI**; all trade entry is now via Contract Note import; do not wire it back without explicit instruction; also still references Dexie `db.trades` — update before reactivating
- **EditTradeModal** — still active; opened after ConfirmCodeModal confirmation on the edit flow; pre-fills all fields from the existing trade record; calls `onUpdate(trade.id, updates)` prop (wired to `useTrades.updateTrade`); receives `trades` prop for the symbol autocomplete dropdown
- **Trades page** (`Trades.jsx`) — single gold **Import** button (`ti-file-import`) in the header opens `ImportScreenshotModal`; no "Add Trade" button; company list shows one `CompanyCard` per symbol (tap opens `StockDetailScreen`); stats glass card shows STOCKS · TRADES · BUYS · SELLS counts
  - **CompanyCard** — shows logo, symbol (gold), buy/sell count badge, company name, net shares, unrealized PnL; chevron right; tapping opens `StockDetailScreen`
  - Edit flow: tapping Edit in the Trades tab → closes screen → `ConfirmCodeModal` → `EditTradeModal`; Delete flow: `ConfirmCodeModal` → `deleteTrade(trade.id)`
  - Props received: `prices`, `trades`, `tradesLoading`, `updateTrade`, `deleteTrade`, `addTrades`, `checkDuplicate`, `user`
- **StockDetailScreen** (`src/components/StockDetailScreen.jsx`) — full-screen overlay that slides in from the right (`slide-right` keyframe, 0.28s); accessible from both Trades and Markets pages; header shows back arrow, company logo, symbol, name, live price + day change; two tabs when user has trades for the stock, discussion-only when they don't:
  - **My Trades tab** — summary strip (shares, avg cost, P&L); scrollable list of up to 10 trades sorted most-recent-first; each `TradeRow` shows BUY/SELL badge, shares @ price, date, net consideration, per-trade PnL, gold Edit + red Delete buttons; "Showing 10 most recent of N" note when >10
  - **Discussion tab** — community comment thread for that stock symbol; see Community discussion section below
  - `TradeRow` is defined inside `StockDetailScreen.jsx` (not in Trades.jsx); props: `symbol`, `userTrades`, `currentPrice`, `priceInfo`, `user`, `onEdit`, `onDelete`, `onClose`
- **Settings screen** (`Settings.jsx`) — icon-chip rows grouped into glass cards by section:
  - **iC Securities section** — "Direct broker sync" and "Import from statement" rows; both open a `ComingSoonModal` centered modal (gold icon, "Coming soon" copy, "Got it" dismiss); no functionality behind these yet
  - **Data section** — "Export trades" row downloads all trades as a CSV (`sikafolio-trades-YYYY-MM-DD.csv`) via `exportCSV()`; "Notifications" row shows a "Soon" badge (non-tappable); "Clear all portfolio data" row (danger/red styling) triggers `ConfirmCodeModal` then calls `clearAllTrades()`
  - **Sign out** ghost button below the data section
  - **About footer** — `SikaFolio v1.0.0` and `Prices: afx.kwayisi.org · GSE` as 11px dim microcopy
  - `SettingsRow` internal component: accepts `icon`, `label`, `sub`, `value`, `valueColor`, `onClick`, `chevron`, `danger` props; renders a 32px icon chip + text block + optional right value/chevron
  - Props received: `user`, `onLogout`, `trades`, `clearAllTrades`, `refetchTrades`
- **Markets page** (`Markets.jsx`) — lists all GSE-listed equities with company logo, full name, ticker, live price, absolute + percentage change (colour-coded green/red), and volume; shows GSE Composite Index card at top; header right shows market status chip (see below) that opens `PriceInfoSheet` on tap; every stock row is tappable (chevron indicator) and opens `StockDetailScreen`; receives `prices`, `user`, `trades` props; filters `trades` by symbol before passing `userTrades` to the screen
- **Market status chip** — appears in the top-right header of Portfolio and Markets pages; uses `isMarketOpen()` to show `● MARKET OPEN` (green tint, animated dot) or `● MARKET CLOSED` (muted, static grey dot) + `ⓘ` icon; tapping opens `PriceInfoSheet`
- **PriceInfoSheet** (`src/components/PriceInfoSheet.jsx`) — centered modal explaining price data context; states prices are official GSE closing prices (updated once after each session, 15:00 GMT), not real-time broker feed prices; shows source row (afx.kwayisi.org + last-updated time); backdrop tap or "Got it" button to dismiss; used by Portfolio and Markets
- **Company logo system** — `CompanyLogo` component (`src/components/CompanyLogo.jsx`) with three-tier fallback: Clearbit full logo → Google S2 favicon → coloured letter avatar; accepts `size` prop (`"sm"` 32px / `"md"` 40px / `"lg"` 52px); import it anywhere a company logo is needed
- **GSE company registry** (`src/constants/gseCompanies.js`) — single source of truth mapping every GSE ticker to `{ name, domain }`; `getCompany(symbol)` helper returns the entry or a sensible default; update this file when adding new tickers or correcting domains, not inside components
- **News page** (`src/pages/News.jsx`) — 5th tab (`ti-news`); fetches Ghanaian financial news RSS feeds via `/api/news` Vercel proxy; two tabs: "Your stocks" (default) filters articles matching user's holdings, "All GSE news" shows everything; receives `trades` prop and derives held symbols from it (no DB access):
  - **Matching logic** — `buildSearchTerms(symbol)` generates search terms from `GSE_COMPANIES`: full name, first word, first two words, and the ticker itself (e.g. MTNGH → ["MTN Ghana", "MTN", "MTNGH"]); `articleMatchesSymbol()` checks title + description case-insensitively
  - **NewsCard** — gold ticker chips for each matched holding, gold left-accent bar, headline (13px 600), description excerpt (3-line clamp), source + relative timestamp footer, full-page `<a>` link to article; accent bar only appears when the card matches a holding
  - **States** — skeleton loading (4 placeholder cards), error state with retry button, empty state for "Your stocks" with escape hatch to "All GSE news"
  - **Refresh** — header button with `.spinning` CSS animation while loading
  - **Tab count badge** — "Your stocks · N" shows match count when non-zero

- **Community discussion** (inside `StockDetailScreen`) — per-stock comment thread visible to all users; posting gated to users who have **ever held** the stock (server verifies via `trades` table on every POST — cannot be faked client-side):
  - **Display name** — `user.name` from session, denormalised into the `comments` row at post time
  - **Holder badge** — gold "HOLDER" chip shown next to commenter's name; stored as `is_holder` on the comment row
  - **Threading** — one reply level only; replies indented with a left border; no further nesting
  - **Character limit** — 280 chars; live countdown turns red below 20; server also enforces via `CHECK` constraint
  - **Banned phrase filter** — server-side list rejects posts containing guaranteed returns, insider info, pump/dump phrases, risk-free claims, etc.; returns 400 with an explanatory message
  - **Disclaimer bar** — pinned above the list: "User opinions only · Not financial advice · No insider information"
  - **Report** — any comment can be flagged by other users; sets `flagged = TRUE` in DB; flagged comments are excluded from GET responses; admin reviews/deletes via Neon dashboard
  - **Delete own comment** — soft delete (`deleted_at = NOW()`); excluded from GET responses
  - **Non-holders** — can read all comments; compose box shows "You must hold {symbol} to post" instead of textarea
  - **Empty state** — icon + "Be the first to share…" (holder) or "Only X holders can post" (non-holder)
  - **Optimistic updates** — new comment/reply prepended to local state immediately; no refetch needed

### What's not yet built (known gaps)
- Push notifications / true background sync
- Access token refresh for Google OAuth (tokens expire after ~1 hour; user must re-login)
- Comment moderation UI (currently admin deletes flagged comments directly via Neon dashboard)

## Auth system

### Local accounts
- Username (stored in the `email` column as unique identifier) + passcode
- Two-step login: step 1 enter username → `GET /api/users?email=...` → step 2 enter passcode (checked client-side against returned user object)
- Sign-up collects: first name, last name, username (min 3 chars, no spaces, live availability check via `GET /api/users`), passcode (min 4 chars), confirm passcode; creates user via `POST /api/users`
- Username availability checked debounced 500ms, shown as "✓ Available" / "✕ Taken" next to the field
- Input border turns green/red to reflect passcode match and username availability

### Google accounts
- OAuth via `@react-oauth/google` using `useGoogleLogin` implicit flow
- Scopes: `openid email profile` only — no Gmail access
- On success: fetches `https://www.googleapis.com/oauth2/v2/userinfo`, upserts to Neon via `POST /api/users` with `provider: 'google'`
- Google users have no username or passcode — they always sign in via "Continue with Google"
- Google Client ID is in `.env` as `VITE_GOOGLE_CLIENT_ID`
- Google Cloud project: **Sikafolio** (project=sikafolio)
- OAuth app is in **Testing** mode — only explicitly added test users can sign in
- Test user added: `asaresylvester8@gmail.com`
- Authorized JS origins: `http://localhost:5173`, `https://sikafolio.vercel.app`

### Session persistence
- On login, `{ email, name, avatar }` stored to localStorage under key `sikafolio_session`
- Access token kept in memory only (not persisted — short-lived, no refresh token)
- On app load: if session exists → skip splash, go straight to portfolio; `useTrades(user.email)` fires immediately to load trades
- On logout: localStorage cleared, state reset, returns to splash

## Data architecture

### Neon Postgres (cloud — syncs across devices)
Tables (see `sql/schema.sql`):
- `users` — `id, email (unique), name, passcode, avatar, provider, created_at`
- `trades` — `id, user_email, email_id, order_number, trade_id, symbol, order_type, quantity, gross_consideration, processing_fee, net_consideration, price_per_share, settlement_date, execution_date, status, source, created_at`; indexed on `user_email`, `trade_id`, `order_number`, `email_id`; **unique partial indexes** on `(user_email, trade_id) WHERE trade_id IS NOT NULL` and `(user_email, email_id) WHERE email_id IS NOT NULL` — enforces server-side dedup so duplicate contract notes are rejected even if the client-side check is bypassed; migration in `sql/migrate_dedup_constraints.sql` (already applied to production)
- `sync_meta` — `(user_email, key)` composite PK, `value TEXT`; currently unused but kept for future sync state
- `comments` — `id, symbol, user_email, display_name, body (≤280 chars), parent_id (nullable — NULL = top-level), is_holder (bool), flagged (bool), deleted_at (nullable), created_at`; indexed on `(symbol, created_at DESC)` and `parent_id`; soft-deleted rows and flagged rows excluded from GET responses; `display_name` is denormalised from `user.name` at post time

API responses map snake_case DB columns → camelCase for the frontend.

### IndexedDB / Dexie (local — device only)
`src/services/db.js` at version 6:
- `prices` — live price cache keyed by symbol
- `priceSnapshots` — daily `{ date, values: { SYMBOL: price } }` written by `usePrices` after each successful fetch; used by `usePortfolioHistory`
- `trades`, `users`, `syncMeta` tables were **dropped** in version 6

### Trade state flow
`useTrades(userEmail)` in `App.jsx` → fetches from `/api/trades` on mount → holds array in React state → passed as `trades` prop to all pages that need it → mutations (`addTrade`, `updateTrade`, `deleteTrade`, etc.) call the API and update local state optimistically.

`checkDuplicate(tradeId, orderNumber, emailId)` runs synchronously against the in-memory array — no async DB call needed.

### Portfolio calculation
- `usePortfolio(trades, prices)` — pure function, no side effects, called in `Portfolio.jsx`
- Groups trades by symbol, then by `orderType === 'Buy'` vs sell
- WAC (weighted average cost) = total gross consideration / total shares bought
- `netShares = totalBought - totalSold` — if ≤ 0, position is excluded from holdings
- `stocksSold` is computed from raw `trades` BEFORE the holdings filter so fully-sold stocks are counted; it is the sum of `grossConsideration` on all sell trades (not profit)
- `bookValue = (totalGross + totalFees) * (netShares / totalBought)` — includes buy fees so break-even reflects real cash outlay; this is what "Invested" and PnL are measured against
- `currentPrice` = live price from API; falls back to `pricePerShare` of the most recent buy trade when no live price is available (so balance is never 0)
- `hasLivePrice: boolean` on each holding — false when using the buy-price fallback; StockCard shows `"no live price"` instead of a day-change % in that case
- PnL = `(currentPrice * netShares) - bookValue` using live GSE prices (or buy-price fallback)
- Prices keyed by uppercase ticker symbol (e.g., `'MTNGH'`, `'SIC'`, `'GCB'`, `'CAL'`) — must match parsed trade symbols exactly

### Trade date fields
- `executionDate` — used for display and sort order in Trades.jsx; stored as `YYYY-MM-DD` by contract note import; all consumers use `new Date(executionDate)` or `.slice(0, 10)` so both formats work
- `settlementDate` — secondary display field ("settled …"); `YYYY-MM-DD` from contract note/edit; used by `usePortfolioHistory`

## Vercel API routes

### Data routes (Neon-backed)
- `api/_db.js` — shared helper; exports `getDb()` which returns `neon(process.env.DATABASE_URL)`; imported by all data routes; requires `DATABASE_URL` env var set in Vercel
- `api/users.js` — `GET ?email=` returns user or 404; `POST` body `{ email, name, passcode, avatar, provider }` upserts (ON CONFLICT updates name/avatar only, never overwrites passcode)
- `api/trades.js` — `GET ?email=` returns all trades for user sorted by `execution_date DESC`; `POST` body `{ email, trade }` inserts one or `{ email, trades: [...] }` bulk inserts (skips errors individually); `PUT ?id=&` body `{ email, updates }` partial update; `DELETE ?id=&email=` deletes one, `?email=&source=` deletes by source, `?email=&clearAll=true` deletes all
- `api/sync-meta.js` — `GET ?email=&key=` returns `{ value }`; `PUT` body `{ email, key, value }` upserts; `DELETE ?email=&key=` removes
- `api/comments.js` — `GET ?symbol=` returns `{ comments: [...] }` (top-level with nested `replies[]`, excludes deleted + flagged); `POST` body `{ symbol, userEmail, displayName, body, parentId? }` inserts (verifies holder status server-side, enforces 280-char limit + banned-phrase filter); `POST ?flag=true` body `{ id }` sets `flagged=true`; `DELETE ?id=&email=` soft-deletes own comment

### Proxy / utility routes
- `api/gse.js` — proxies `https://afx.kwayisi.org/gse/`; uses full Chrome browser headers + 8s `AbortSignal` timeout on the direct fetch; falls back to allorigins.win server-side before giving up; returns raw HTML with `Cache-Control: s-maxage=300`
- `api/news.js` — fetches RSS feeds from CitiBusinessNews, Myjoyonline Business, and GhanaBusinessNews in parallel via `Promise.allSettled`; parses XML with regex (handles CDATA + HTML entity decoding); caps at 60 articles sorted by pubDate; `Cache-Control: s-maxage=900` (15 min); returns `{ title, link, description, pubDate, source }[]`; partial failures are silently swallowed; 8-second per-feed timeout via `AbortSignal.timeout(8000)`
- `api/ocr.js` — receives `{ image: base64string, mimeType }` POST; calls `gemini-2.5-flash` via the Generative Language API with a structured prompt; returns `{ trades: [...] }` as parsed JSON; requires `GEMINI_API_KEY` env var (free tier: 1500 req/day at aistudio.google.com); 30-second timeout; proxied to production Vercel in local dev (see Vite config)
- `api/ping.js` — `GET` only; runs `SELECT 1` against Neon and returns `{ ok: true, ts: ISO }` or 500; used by the cron-job.org keep-alive job (every 5 min) to prevent Neon compute from suspending

## Vite config
- Fixed port: `server: { port: 5173, strictPort: true }` — will error instead of silently switching ports
- All API routes are proxied in dev so `npm run dev` (port 5173) is fully functional — no need for `vercel dev` for day-to-day work:
  - `/api/gse` → `https://afx.kwayisi.org/gse/` (direct, rewrites path)
  - `/api/trades`, `/api/users`, `/api/sync-meta`, `/api/ocr`, `/api/news`, `/api/comments` → `https://sikafolio.vercel.app` (forwards to production Vercel, `changeOrigin: true`)
- `vercel dev` (port 3000) is only needed if you want to test API route code changes locally before deploying; **do not use `vercel dev` for UI work** — the SPA rewrite intercepts Vite module requests and causes a blank page

## vercel.json
- `vercel.json` contains a single SPA rewrite: all non-`/api/` paths → `/index.html`
- **Do not use `vercel dev` for UI work** — the rewrite intercepts Vite's internal module requests (`/@vite/client`, `/src/...`) and returns `index.html` instead, causing a blank white page; this is a `vercel dev` limitation, not a production bug
- In production Vercel serves static files from `dist/` before checking rewrites, so the rewrite only fires for unknown routes (correct SPA behaviour)
- For local development: `npm run dev` (Vite on port 5173) for UI; `vercel dev` (port 3000) only when you need to exercise API routes

## Keep-alive / Neon
- Neon free tier suspends compute after ~5 min of inactivity
- cron-job.org job "sikafolio" pings `https://sikafolio.vercel.app/api/ping` every 5 minutes to keep the DB warm
- `DATABASE_URL` is set in Vercel environment variables (Production + Preview)

## Icons
- Tabler Icons loaded via CDN in `index.html`: `https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css`
- Use class `ti ti-<name>` on `<i>` elements — no npm package needed
- Common icons used: `ti-chart-pie` (portfolio), `ti-history` (trades), `ti-trending-up` (markets), `ti-news` (news tab), `ti-settings` (settings), `ti-edit`, `ti-trash`, `ti-alert-circle`, `ti-refresh`, `ti-building-bank`, `ti-file-import`, `ti-download`, `ti-bell`, `ti-clock`

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
- Surface solid: `#10131A` (modals)
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
- **Modal animation** — all modals use `animation: modal-in 0.28s cubic-bezier(0.22,1,0.36,1) both` (`scale(0.95)+translateY(8px)` → identity); keyframe in `index.css`; overlay always uses `display:flex; alignItems:center; justifyContent:center; padding:0 20px`; inner panel: `width:100%; maxWidth:400–480; borderRadius:20; border:1px solid var(--border)`; **no bottom sheets anywhere in the app**
- **Chart animation keyframes** (in `index.css`): `bar-grow` (scaleY 0→1, used by TopPerformers bars), `fade-up` (opacity+translateY, used by TopPerformers labels/tickers), `sheet-up` (translateY 100%→0, unused but kept)
- **Page transition keyframe** (in `index.css`): `slide-right` (translateX 100%→0, used by `StockDetailScreen` for a full-screen page-push effect)

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
