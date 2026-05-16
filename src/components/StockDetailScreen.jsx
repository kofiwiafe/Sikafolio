import { useState, useEffect, useRef } from 'react'
import CompanyLogo from './CompanyLogo'
import { getCompany } from '../constants/gseCompanies'

const fmt = n => n?.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const MAX_LEN = 280

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function iconBtn(color, bg, border) {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
    background: bg, border: `1px solid ${border}`, color,
  }
}

const actionStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 11, fontWeight: 600, color: 'var(--muted)',
  padding: 0, fontFamily: 'var(--font-ui)',
}

// ── Trade row ─────────────────────────────────────────────────────────────────

function TradeRow({ t, isFirst, onEdit, onDelete, pnl }) {
  const isBuy   = t.orderType === 'Buy'
  const dateStr = new Date(t.executionDate).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
  const pnlUp   = (pnl ?? 0) >= 0

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 16px',
      borderTop: isFirst ? 'none' : '1px solid var(--divider)',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 800, letterSpacing: '0.07em',
        color: isBuy ? 'var(--gold)' : 'var(--red)',
        background: isBuy ? 'var(--gold-dim)' : 'var(--red-dim)',
        borderRadius: 4, padding: '2px 6px',
        flexShrink: 0, minWidth: 28, textAlign: 'center',
      }}>
        {t.orderType.toUpperCase()}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text)' }}>
          {t.quantity?.toLocaleString()} shares
          <span style={{ color: 'var(--muted)' }}> @ GHS {fmt(t.pricePerShare)}</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
          {dateStr}
          {t.settlementDate && <span style={{ color: 'var(--dim)' }}> · settled {t.settlementDate}</span>}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div className="mono" style={{ fontSize: 12, color: isBuy ? 'var(--text)' : 'var(--red)', whiteSpace: 'nowrap' }}>
          {isBuy ? '+' : '−'} GHS {fmt(t.netConsideration)}
        </div>
        {pnl != null && (
          <div className="mono" style={{ fontSize: 10, marginTop: 2, color: pnlUp ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
            {pnlUp ? '▲ +' : '▼ '}GHS {fmt(pnl)}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={e => { e.stopPropagation(); onEdit(t) }}
          style={iconBtn('var(--gold)', 'var(--gold-dim)', 'var(--gold-border)')}
        >
          <i className="ti ti-edit" style={{ fontSize: 14 }} />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(t) }}
          style={iconBtn('var(--red)', 'var(--red-dim)', 'var(--red-border)')}
        >
          <i className="ti ti-trash" style={{ fontSize: 14 }} />
        </button>
      </div>
    </div>
  )
}

// ── Trades tab ────────────────────────────────────────────────────────────────

function TradesTab({ trades, currentPrice, onEdit, onDelete }) {
  const buyTrades   = trades.filter(t => t.orderType === 'Buy')
  const totalBought = buyTrades.reduce((s, t) => s + (t.quantity || 0), 0)
  const totalSold   = trades.filter(t => t.orderType === 'Sell').reduce((s, t) => s + (t.quantity || 0), 0)
  const netShares   = totalBought - totalSold
  const avgCost     = totalBought > 0
    ? buyTrades.reduce((s, t) => s + t.pricePerShare * (t.quantity || 0), 0) / totalBought
    : 0
  const unrealizedPnL = currentPrice != null && netShares > 0
    ? (currentPrice - avgCost) * netShares
    : null
  const pnlUp = (unrealizedPnL ?? 0) >= 0

  const tradePnLs = {}
  if (currentPrice != null) {
    for (const t of buyTrades) tradePnLs[t.id] = (currentPrice - t.pricePerShare) * t.quantity
  }

  const sorted = [...trades]
    .sort((a, b) => new Date(b.executionDate) - new Date(a.executionDate))
    .slice(0, 10)

  const statLabel = { fontSize: 9, color: 'var(--dim)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 3 }

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>
      {/* Summary strip */}
      <div style={{
        display: 'flex', gap: 24, padding: '12px 16px',
        borderBottom: '1px solid var(--divider)',
      }}>
        <div>
          <div style={statLabel}>Shares</div>
          <div className="mono" style={{ fontSize: 13, color: 'var(--text)' }}>{netShares.toLocaleString()}</div>
        </div>
        <div>
          <div style={statLabel}>Avg Cost</div>
          <div className="mono" style={{ fontSize: 13, color: 'var(--text)' }}>GHS {fmt(avgCost)}</div>
        </div>
        {unrealizedPnL != null && (
          <div>
            <div style={statLabel}>P&L</div>
            <div className="mono" style={{ fontSize: 13, color: pnlUp ? 'var(--green)' : 'var(--red)' }}>
              {pnlUp ? '▲ +' : '▼ '}GHS {fmt(unrealizedPnL)}
            </div>
          </div>
        )}
      </div>

      {sorted.map((t, i) => (
        <TradeRow
          key={t.id}
          t={t}
          isFirst={i === 0}
          onEdit={onEdit}
          onDelete={onDelete}
          pnl={tradePnLs[t.id] ?? null}
        />
      ))}

      {trades.length > 10 && (
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--dim)', padding: '8px 0 20px' }}>
          Showing 10 most recent of {trades.length} trades
        </div>
      )}
    </div>
  )
}

// ── Comment card ──────────────────────────────────────────────────────────────

function HolderBadge({ size = 8 }) {
  return (
    <span style={{
      fontSize: size, fontWeight: 700, letterSpacing: '0.06em',
      color: 'var(--gold)', background: 'var(--gold-dim)',
      border: '1px solid var(--gold-border)',
      borderRadius: 4, padding: '1px 5px', flexShrink: 0,
    }}>
      HOLDER
    </span>
  )
}

function ReplyRow({ r, userEmail, onDelete, onFlag, reported }) {
  const isOwn = r.userEmail === userEmail
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{r.displayName}</span>
        {r.isHolder && <HolderBadge size={7} />}
        <span style={{ fontSize: 9, color: 'var(--dim)', marginLeft: 'auto' }}>{timeAgo(r.createdAt)}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.55, marginBottom: 5 }}>{r.body}</div>
      <div style={{ display: 'flex', gap: 14 }}>
        {isOwn
          ? <button onClick={() => onDelete(r.id)} style={{ ...actionStyle, color: 'var(--red)' }}>Delete</button>
          : <button onClick={() => onFlag(r.id)} style={{ ...actionStyle, color: reported ? 'var(--green)' : 'var(--dim)' }}>
              {reported ? 'Reported' : 'Report'}
            </button>
        }
      </div>
    </div>
  )
}

function CommentCard({ comment, userEmail, onReply, onDelete, onFlag, reported }) {
  const isOwn = comment.userEmail === userEmail
  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--divider)' }}>
      {/* Author */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{comment.displayName}</span>
        {comment.isHolder && <HolderBadge />}
        <span style={{ fontSize: 10, color: 'var(--dim)', marginLeft: 'auto' }}>{timeAgo(comment.createdAt)}</span>
      </div>
      {/* Body */}
      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55, marginBottom: 9 }}>{comment.body}</div>
      {/* Actions */}
      <div style={{ display: 'flex', gap: 14 }}>
        <button onClick={() => onReply(comment)} style={actionStyle}>Reply</button>
        {isOwn
          ? <button onClick={() => onDelete(comment.id)} style={{ ...actionStyle, color: 'var(--red)' }}>Delete</button>
          : <button onClick={() => onFlag(comment.id)} style={{ ...actionStyle, color: reported ? 'var(--green)' : 'var(--dim)' }}>
              {reported ? 'Reported' : 'Report'}
            </button>
        }
      </div>
      {/* Replies */}
      {comment.replies?.length > 0 && (
        <div style={{ marginTop: 12, marginLeft: 14, borderLeft: '2px solid var(--divider)', paddingLeft: 12 }}>
          {comment.replies.map(r => (
            <ReplyRow
              key={r.id}
              r={r}
              userEmail={userEmail}
              onDelete={onDelete}
              onFlag={onFlag}
              reported={reported}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Discussion tab ────────────────────────────────────────────────────────────

function DiscussionTab({ symbol, user, isHolder }) {
  const [comments, setComments] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [body,     setBody]     = useState('')
  const [replyTo,  setReplyTo]  = useState(null)
  const [posting,  setPosting]  = useState(false)
  const [error,    setError]    = useState(null)
  const [reported, setReported] = useState(new Set())
  const textareaRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/comments?symbol=${encodeURIComponent(symbol)}`)
      .then(r => r.json())
      .then(d => setComments(d.comments || []))
      .catch(() => setComments([]))
      .finally(() => setLoading(false))
  }, [symbol])

  async function post() {
    const trimmed = body.trim()
    if (!trimmed || posting) return
    setPosting(true)
    setError(null)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          userEmail:   user.email,
          displayName: user.name,
          body:        trimmed,
          parentId:    replyTo?.id ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to post'); return }
      const nc = data.comment
      if (replyTo) {
        setComments(prev => prev.map(c =>
          c.id === replyTo.id ? { ...c, replies: [...(c.replies || []), nc] } : c
        ))
      } else {
        setComments(prev => [nc, ...prev])
      }
      setBody('')
      setReplyTo(null)
    } catch {
      setError('Network error — try again')
    } finally {
      setPosting(false)
    }
  }

  async function remove(id) {
    await fetch(`/api/comments?id=${id}&email=${encodeURIComponent(user.email)}`, { method: 'DELETE' })
    setComments(prev =>
      prev.filter(c => c.id !== id)
          .map(c => ({ ...c, replies: (c.replies || []).filter(r => r.id !== id) }))
    )
  }

  async function flag(id) {
    await fetch('/api/comments?flag=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setReported(prev => new Set([...prev, id]))
  }

  function handleReply(comment) {
    setReplyTo({ id: comment.id, displayName: comment.displayName })
    setTimeout(() => textareaRef.current?.focus(), 80)
  }

  const remaining = MAX_LEN - body.length
  const canPost   = body.trim().length > 0 && remaining >= 0 && !posting && isHolder

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Disclaimer bar */}
      <div style={{
        padding: '7px 16px',
        borderBottom: '1px solid var(--divider)',
        fontSize: 9, color: 'var(--dim)', textAlign: 'center',
        letterSpacing: '0.04em', textTransform: 'uppercase',
        background: 'rgba(240,194,94,0.04)', flexShrink: 0,
      }}>
        User opinions only · Not financial advice · No insider information
      </div>

      {/* Comment list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>
            Loading discussion…
          </div>
        ) : comments.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <i className="ti ti-message-circle" style={{ fontSize: 32, color: 'var(--dim)', display: 'block', marginBottom: 10 }} />
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>No comments yet</div>
            <div style={{ fontSize: 11, color: 'var(--dim)' }}>
              {isHolder
                ? `Be the first to share your thoughts on ${symbol}`
                : `Only ${symbol} holders can post`}
            </div>
          </div>
        ) : (
          comments.map(c => (
            <CommentCard
              key={c.id}
              comment={c}
              userEmail={user.email}
              onReply={handleReply}
              onDelete={remove}
              onFlag={flag}
              reported={reported.has(c.id)}
            />
          ))
        )}
      </div>

      {/* Compose box */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface-solid)',
        flexShrink: 0,
      }}>
        {replyTo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginBottom: 8, fontSize: 11, color: 'var(--gold)',
          }}>
            <i className="ti ti-corner-down-right" style={{ fontSize: 12 }} />
            <span>Replying to {replyTo.displayName}</span>
            <button
              onClick={() => setReplyTo(null)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)', fontSize: 18, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        )}

        {isHolder ? (
          <>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Share your insight…"
              rows={2}
              style={{
                width: '100%', resize: 'none',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                borderRadius: 10, padding: '10px 12px',
                color: 'var(--text)', fontSize: 13,
                fontFamily: 'var(--font-ui)', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
              <span className="mono" style={{ fontSize: 10, color: remaining < 20 ? 'var(--red)' : 'var(--dim)' }}>
                {remaining}
              </span>
              {error && (
                <span style={{ fontSize: 10, color: 'var(--red)', marginLeft: 10, flex: 1 }}>{error}</span>
              )}
              <button
                onClick={post}
                disabled={!canPost}
                style={{
                  marginLeft: 'auto',
                  background: canPost ? 'var(--gold-grad)' : 'rgba(255,255,255,0.06)',
                  border: 'none', borderRadius: 8, padding: '7px 18px',
                  fontSize: 12, fontWeight: 600,
                  color: canPost ? '#080A10' : 'var(--dim)',
                  cursor: canPost ? 'pointer' : 'default',
                  boxShadow: canPost ? 'var(--gold-glow)' : 'none',
                  fontFamily: 'var(--font-ui)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--dim)', padding: '6px 0' }}>
            You must hold {symbol} to post in this discussion
          </div>
        )}
      </div>
    </div>
  )
}

// ── Stock Detail Screen ───────────────────────────────────────────────────────

export default function StockDetailScreen({
  symbol, userTrades, currentPrice, priceInfo,
  user, onEdit, onDelete, onClose,
}) {
  const company   = getCompany(symbol)
  const hasTrades = (userTrades?.length ?? 0) > 0
  const isHolder  = hasTrades
  const [tab, setTab] = useState(hasTrades ? 'trades' : 'discussion')

  const price  = priceInfo?.price  ?? currentPrice
  const change = priceInfo?.change ?? null
  const chPct  = priceInfo?.changePercent ?? null
  const up     = (change ?? 0) > 0
  const flat   = change === 0 || change == null

  const TABS = [
    { key: 'trades',     label: 'My Trades' },
    { key: 'discussion', label: 'Discussion' },
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'var(--bg)',
      backgroundImage: 'var(--bg-grad)',
      display: 'flex', flexDirection: 'column',
      animation: 'slide-right 0.28s cubic-bezier(0.22,1,0.36,1) both',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px 12px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, borderRadius: 10, cursor: 'pointer',
            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
            color: 'var(--muted)', flexShrink: 0,
          }}
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 16 }} />
        </button>

        <CompanyLogo symbol={symbol} size="md" />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>{symbol}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {company.name}
          </div>
        </div>

        {price != null && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
              GHS {Number(price).toFixed(2)}
            </div>
            {!flat && change != null && (
              <div className="mono" style={{ fontSize: 10, marginTop: 1, color: up ? 'var(--green)' : 'var(--red)' }}>
                {up ? '▲ +' : '▼ '}{Number(change).toFixed(2)} ({up ? '+' : ''}{Number(chPct).toFixed(2)}%)
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab bar — only when user has trades for this stock */}
      {hasTrades && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                flex: 1, padding: '11px 0',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                color: tab === key ? 'var(--gold)' : 'var(--muted)',
                borderBottom: tab === key ? '2px solid var(--gold)' : '2px solid transparent',
                fontFamily: 'var(--font-ui)',
                transition: 'color 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'trades' && hasTrades && (
          <TradesTab
            trades={userTrades}
            currentPrice={currentPrice}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )}
        {(tab === 'discussion' || !hasTrades) && (
          <DiscussionTab symbol={symbol} user={user} isHolder={isHolder} />
        )}
      </div>
    </div>
  )
}
