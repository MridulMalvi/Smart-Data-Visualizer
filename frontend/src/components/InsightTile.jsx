import { useEffect, useRef } from 'react'
import { Lightbulb, RefreshCw } from 'lucide-react'
import useAppStore from '../store/useAppStore'

export default function InsightTile({ onRegenerate }) {
  const { insight, insightLoading, insightKey, chartData } = useAppStore()
  const tileRef = useRef(null)

  // Re-trigger clay-press-in animation whenever insightKey bumps
  useEffect(() => {
    if (!tileRef.current || !insight) return
    const el = tileRef.current
    el.classList.remove('insight-press-in')
    // Force reflow
    void el.offsetWidth
    el.classList.add('insight-press-in')
  }, [insightKey, insight])

  if (!chartData && !insightLoading) {
    return (
      <div className="clay-card" style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }} id="insight-tile">
        <Lightbulb size={40} strokeWidth={1.3} style={{ color: 'var(--text-muted)' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          AI insight will appear here after you generate a chart.
        </p>
      </div>
    )
  }

  return (
    <div
      ref={tileRef}
      className="clay-card"
      id="insight-tile"
      style={{
        padding: 24,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        background: 'linear-gradient(135deg, var(--bg-card) 60%, rgba(107, 127, 215, 0.08))',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative blob */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 100, height: 100, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,107,107,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--accent-coral), #ff9b4b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: 'var(--shadow-clay-sm)',
          }}>
            <Lightbulb size={15} color="#fff" />
          </div>
          <h3 style={{ fontSize: '1rem' }}>AI Insight</h3>
        </div>

        {insight && (
          <button
            className="btn btn-secondary"
            onClick={onRegenerate}
            style={{ padding: '6px 10px', borderRadius: 10, fontSize: '0.75rem' }}
            title="Regenerate insight"
            aria-label="Regenerate AI insight"
          >
            <RefreshCw size={12} />
          </button>
        )}
      </div>

      {/* Content */}
      {insightLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div className="spinner" />
          <span style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>
            Generating insight…
          </span>
        </div>
      ) : insight ? (
        <div style={{ flex: 1 }}>
          <p style={{
            fontSize: '0.92rem',
            lineHeight: 1.7,
            color: 'var(--text-primary)',
            fontStyle: 'italic',
          }}>
            "{insight}"
          </p>
        </div>
      ) : null}

      {/* Stats snippet */}
      {chartData?.stats && !insightLoading && (
        <StatSnippet stats={chartData.stats} />
      )}
    </div>
  )
}

function StatSnippet({ stats }) {
  const items = []
  if (stats.mean != null)          items.push(['Mean', stats.mean.toFixed?.(2) ?? stats.mean])
  if (stats.min != null)           items.push(['Min', stats.min])
  if (stats.max != null)           items.push(['Max', stats.max])
  if (stats.correlation != null)   items.push(['r', stats.correlation])
  if (stats.outlier_count != null) items.push(['Outliers', stats.outlier_count])

  if (!items.length) return null

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 6,
      paddingTop: 12, borderTop: '1px solid var(--border-clay)',
    }}>
      {items.map(([label, value]) => (
        <div key={label} style={{
          padding: '4px 10px', borderRadius: 8,
          background: 'var(--bg-base)', fontSize: '0.72rem',
          boxShadow: 'var(--shadow-clay-sm)',
        }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.66rem', textTransform: 'uppercase', marginRight: 4 }}>
            {label}
          </span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>
            {value}
          </span>
        </div>
      ))}
    </div>
  )
}
