import { useState, useRef } from 'react'
import { Sparkles, Send } from 'lucide-react'
import useAppStore from '../store/useAppStore'
import { parseNLQ } from '../api/client'

const EXAMPLE_QUERIES = [
  'show sales by category as bar chart',
  'trend of revenue over month',
  'distribution of price',
  'correlation between age and salary',
  'proportion of sales by region',
]

export default function NLQBar({ onResolved }) {
  const [query, setQuery]   = useState('')
  const { sessionId, nlqLoading, nlqResult, setNLQLoading, setNLQResult } = useAppStore()
  const inputRef = useRef(null)

  if (!sessionId) return null

  const handleSubmit = async (e) => {
    e?.preventDefault()
    const q = query.trim()
    if (!q) return

    setNLQLoading(true)
    setNLQResult(null)

    try {
      const { data } = await parseNLQ(sessionId, q)
      setNLQResult(data)
      if (data.resolved) {
        onResolved?.({
          chart_type: data.chart_type,
          x_column:   data.x_column,
          y_column:   data.y_column,
        })
      }
    } catch (err) {
      setNLQResult({
        resolved: false,
        suggestion: err.response?.data?.detail || 'Query parsing failed.',
      })
    }
  }

  const useExample = (ex) => {
    setQuery(ex)
    inputRef.current?.focus()
  }

  return (
    <div className="clay-card" style={{ padding: 20 }} id="nlq-bar">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'linear-gradient(135deg, var(--accent-periwinkle), var(--accent-coral))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Sparkles size={14} color="#fff" />
        </div>
        <h3>Ask in plain English</h3>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          ref={inputRef}
          id="nlq-input"
          className="clay-input"
          placeholder='e.g. "show sales by month as a line chart"'
          value={query}
          onChange={e => setQuery(e.target.value)}
          disabled={nlqLoading}
          aria-label="Natural language query"
          autoComplete="off"
        />
        <button
          id="nlq-submit"
          className="btn btn-periwinkle"
          type="submit"
          disabled={!query.trim() || nlqLoading}
          aria-label="Submit query"
          style={{ flexShrink: 0 }}
        >
          {nlqLoading
            ? <div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} />
            : <Send size={15} />}
        </button>
      </form>

      {/* Example queries */}
      <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {EXAMPLE_QUERIES.map((ex) => (
          <button
            key={ex}
            className="clay-chip"
            onClick={() => useExample(ex)}
            style={{ fontSize: '0.7rem' }}
            type="button"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Result */}
      {nlqResult && (
        <NLQResult result={nlqResult} />
      )}
    </div>
  )
}

function NLQResult({ result }) {
  if (result.resolved) {
    return (
      <div style={{
        marginTop: 12, padding: '10px 14px', borderRadius: 12,
        background: 'rgba(136, 176, 75, 0.1)', border: '1px solid rgba(136, 176, 75, 0.3)',
      }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--accent-sage)', fontWeight: 600, marginBottom: 4 }}>
          ✓ Resolved · {Math.round(result.confidence * 100)}% confidence
        </p>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
          {result.chart_type} · x={result.x_column}{result.y_column ? ` · y=${result.y_column}` : ''}
        </p>
      </div>
    )
  }

  return (
    <div style={{
      marginTop: 12, padding: '10px 14px', borderRadius: 12,
      background: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.25)',
    }}>
      <p style={{ fontSize: '0.8rem', color: 'var(--accent-coral)', fontWeight: 600, marginBottom: 4 }}>
        Couldn't fully resolve — suggestion:
      </p>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{result.suggestion}</p>
    </div>
  )
}
