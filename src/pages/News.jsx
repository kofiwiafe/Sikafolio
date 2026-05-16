import { useState, useEffect, useMemo } from 'react'
import { GSE_COMPANIES } from '../constants/gseCompanies'
import Logo from '../components/Logo'
import CompanyLogo from '../components/CompanyLogo'

// Build a lookup: symbol → array of search terms drawn from company name + ticker
function buildSearchTerms(symbol) {
  const entry = GSE_COMPANIES[symbol]
  if (!entry) return [symbol]
  const name = entry.name
  const terms = new Set([symbol])
  terms.add(name)
  // Add first word (e.g. "MTN" from "MTN Ghana", "GCB" from "GCB Bank")
  const firstWord = name.split(' ')[0]
  if (firstWord.length >= 3) terms.add(firstWord)
  // Add first two words (e.g. "MTN Ghana")
  const firstTwo = name.split(' ').slice(0, 2).join(' ')
  if (firstTwo !== firstWord) terms.add(firstTwo)
  return [...terms]
}

function articleMatchesSymbol(article, terms) {
  const haystack = (article.title + ' ' + article.description).toLowerCase()
  return terms.some(t => haystack.includes(t.toLowerCase()))
}

function relativeTime(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1)  return 'Just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function TickerChip({ symbol }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 7px', borderRadius: 99,
      background: 'rgba(240,194,94,0.1)',
      border: '1px solid rgba(240,194,94,0.22)',
      fontSize: 10, fontWeight: 700, color: 'var(--gold)',
      fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
    }}>
      {symbol}
    </div>
  )
}

function NewsCard({ article, matchedSymbols }) {
  const [summary, setSummary] = useState(null)
  const [simplifying, setSimplifying] = useState(false)
  const pl = matchedSymbols.length > 0 ? 4 : 0

  async function simplify(e) {
    e.preventDefault()
    e.stopPropagation()
    if (simplifying || summary) return
    setSimplifying(true)
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: article.title, description: article.description }),
      })
      const data = await res.json()
      if (data.summary) setSummary(data.summary)
    } catch {
      // silently fail — original description stays visible
    } finally {
      setSimplifying(false)
    }
  }

  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        padding: '14px 16px',
        marginBottom: 10,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Left accent bar if it matches a holding */}
        {matchedSymbols.length > 0 && (
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
            background: 'linear-gradient(180deg, var(--gold), rgba(240,194,94,0.2))',
          }} />
        )}

        {/* Ticker chips */}
        {matchedSymbols.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8, paddingLeft: pl }}>
            {matchedSymbols.map(sym => <TickerChip key={sym} symbol={sym} />)}
          </div>
        )}

        {/* Headline */}
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--text)',
          lineHeight: 1.4, marginBottom: 6, paddingLeft: pl,
        }}>
          {article.title}
        </div>

        {/* Original description — hidden once summary loads */}
        {article.description && !summary && (
          <div style={{
            fontSize: 12, color: 'var(--muted)', lineHeight: 1.5,
            marginBottom: 10, paddingLeft: pl,
            display: '-webkit-box', WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {article.description}
          </div>
        )}

        {/* Plain-English summary */}
        {summary && (
          <div style={{
            fontSize: 12, color: 'var(--text)', lineHeight: 1.6,
            marginBottom: 10, padding: '8px 10px',
            background: 'rgba(240,194,94,0.07)',
            border: '1px solid rgba(240,194,94,0.15)',
            borderRadius: 8,
          }}>
            <span style={{
              fontSize: 10, color: 'var(--gold)', fontWeight: 700,
              letterSpacing: '0.05em', display: 'block', marginBottom: 4,
              fontFamily: 'var(--font-ui)',
            }}>
              PLAIN ENGLISH
            </span>
            {summary}
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingLeft: pl,
        }}>
          <div style={{ fontSize: 11, color: 'var(--dim)' }}>
            {article.source} · {relativeTime(article.pubDate)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!summary && (
              <button
                onClick={simplify}
                disabled={simplifying}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  cursor: simplifying ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 600,
                  color: simplifying ? 'var(--dim)' : 'var(--muted)',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                <i className={`ti ti-wand${simplifying ? ' spinning' : ''}`} style={{ fontSize: 13 }} />
                {simplifying ? 'Simplifying…' : 'Simplify'}
              </button>
            )}
            <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>
              Read full →
            </div>
          </div>
        </div>
      </div>
    </a>
  )
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', padding: '14px 16px',
        }}>
          <div style={{ width: '30%', height: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 10 }} />
          <div style={{ width: '90%', height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 6 }} />
          <div style={{ width: '75%', height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 10 }} />
          <div style={{ width: '60%', height: 11, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }} />
        </div>
      ))}
    </div>
  )
}

export default function News({ trades }) {
  const [articles, setArticles]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [tab, setTab]             = useState('mine') // 'mine' | 'all'
  const [lastFetched, setLastFetched] = useState(null)

  // All unique symbols the user has traded, derived from prop
  const heldSymbols = useMemo(() => [...new Set((trades || []).map(t => t.symbol))], [trades])

  // Map each held symbol to its search terms
  const symbolTerms = useMemo(() => {
    return Object.fromEntries(heldSymbols.map(sym => [sym, buildSearchTerms(sym)]))
  }, [heldSymbols])

  async function fetchNews() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/news')
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()
      setArticles(data)
      setLastFetched(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchNews() }, [])

  // Annotate each article with which of the user's symbols it mentions
  const annotated = useMemo(() => {
    return articles.map(article => {
      const matchedSymbols = Object.entries(symbolTerms)
        .filter(([, terms]) => articleMatchesSymbol(article, terms))
        .map(([sym]) => sym)
      return { ...article, matchedSymbols }
    })
  }, [articles, symbolTerms])

  const displayed = tab === 'mine'
    ? annotated.filter(a => a.matchedSymbols.length > 0)
    : annotated

  const myCount = annotated.filter(a => a.matchedSymbols.length > 0).length

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ padding: '10px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo />
        <button
          onClick={fetchNews}
          disabled={loading}
          style={{
            background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer',
            padding: 6, color: loading ? 'var(--dim)' : 'var(--muted)',
          }}
          title="Refresh"
        >
          <i className={`ti ti-refresh${loading ? ' spinning' : ''}`} style={{ fontSize: 18 }} />
        </button>
      </div>

      {/* Title + last fetched */}
      <div style={{ padding: '10px 20px 0' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>News</div>
        {lastFetched && !loading && (
          <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>
            Updated {relativeTime(lastFetched)}
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div style={{ padding: '14px 20px 0' }}>
        <div style={{
          display: 'flex', gap: 6,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border)',
          borderRadius: 99, padding: 4,
        }}>
          {[
            { id: 'mine', label: `Your stocks${myCount > 0 ? ` · ${myCount}` : ''}` },
            { id: 'all',  label: 'All GSE news' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '7px 0',
                borderRadius: 99, border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600,
                background: tab === t.id
                  ? 'linear-gradient(180deg, #F0C25E 0%, #C99A38 100%)'
                  : 'transparent',
                color: tab === t.id ? '#080A10' : 'var(--muted)',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '14px 16px 0' }}>
        {loading && <Skeleton />}

        {!loading && error && (
          <div style={{
            textAlign: 'center', padding: '40px 20px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
          }}>
            <i className="ti ti-wifi-off" style={{ fontSize: 32, color: 'var(--dim)', display: 'block', marginBottom: 10 }} />
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Couldn't load news</div>
            <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 16 }}>{error}</div>
            <button
              onClick={fetchNews}
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)', padding: '8px 20px',
                fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--muted)',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && tab === 'mine' && displayed.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '40px 20px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
          }}>
            <i className="ti ti-news-off" style={{ fontSize: 32, color: 'var(--dim)', display: 'block', marginBottom: 10 }} />
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>No news about your stocks right now</div>
            <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 16 }}>
              {heldSymbols?.length
                ? `Watching: ${heldSymbols.join(', ')}`
                : 'Add some trades to track relevant news here'}
            </div>
            <button
              onClick={() => setTab('all')}
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)', padding: '8px 20px',
                fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--muted)',
                cursor: 'pointer',
              }}
            >
              Show all GSE news
            </button>
          </div>
        )}

        {!loading && !error && displayed.map((article, i) => (
          <NewsCard key={`${article.link}-${i}`} article={article} matchedSymbols={article.matchedSymbols} />
        ))}
      </div>
    </div>
  )
}
