import useAppStore from '../store/useAppStore'
import { Database, Hash, AlertTriangle } from 'lucide-react'

const DTYPE_COLOR = {
  int:      'badge-sage',
  float:    'badge-periwinkle',
  object:   'badge-coral',
  bool:     'badge-coral',
  datetime: 'badge-periwinkle',
  category: 'badge-neutral',
}

function dtypeBadge(dtype) {
  const key = Object.keys(DTYPE_COLOR).find(k => dtype.startsWith(k)) || 'object'
  return DTYPE_COLOR[key] || 'badge-neutral'
}

export default function StatsPanel() {
  const { summary } = useAppStore()
  if (!summary) return null

  const { column_meta, missing_counts, describe_stats, row_count, col_count } = summary
  const totalCells = row_count * col_count || 1
  const totalMissing = Object.values(missing_counts).reduce((a, b) => a + b, 0)

  return (
    <div className="clay-card" style={{ padding: 20, height: '100%' }} id="stats-panel">
      <h3 style={{ marginBottom: 16 }}>Dataset Summary</h3>

      {/* Overview tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <StatTile label="Rows" value={row_count.toLocaleString()} icon={<Database size={14} />} />
        <StatTile label="Columns" value={col_count} icon={<Hash size={14} />} />
        <StatTile
          label="Total Missing"
          value={totalMissing}
          icon={<AlertTriangle size={14} />}
          accent={totalMissing > 0 ? 'var(--accent-coral)' : undefined}
        />
        <StatTile
          label="Completeness"
          value={`${(100 - (totalMissing / (row_count * col_count)) * 100).toFixed(1)}%`}
          icon={<Hash size={14} />}
          accent="var(--accent-sage)"
        />
      </div>

      {/* Column details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 340, overflowY: 'auto' }}>
        {column_meta.map((col) => {
          const missing = missing_counts[col.name] || 0
          const missingPct = row_count ? (missing / row_count) * 100 : 0
          const desc = describe_stats[col.name]

          return (
            <div key={col.name} className="stat-tile">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {col.name}
                </span>
                <span className={`badge ${dtypeBadge(col.dtype)}`} style={{ flexShrink: 0 }}>
                  {col.dtype}
                </span>
              </div>

              {/* Missing bar */}
              <div style={{ marginTop: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {missing > 0 ? `${missing} missing (${missingPct.toFixed(1)}%)` : 'No missing values'}
                  </span>
                </div>
                <div className="missing-bar-track">
                  <div className="missing-bar-fill" style={{ width: `${missingPct}%` }} />
                </div>
              </div>

              {/* Describe stats if numeric */}
              {desc && (
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px 8px',
                  marginTop: 8, fontSize: '0.7rem',
                }}>
                  {['mean', 'std', 'min', '50%', 'max'].map(k => desc[k] != null && (
                    <div key={k} style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.62rem', letterSpacing: '0.05em' }}>
                        {k === '50%' ? 'median' : k}
                      </span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
                        {typeof desc[k] === 'number' ? desc[k].toFixed(2) : desc[k]}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Sample values */}
              {col.sample?.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {col.sample.map((s, i) => (
                    <span key={i} className="clay-chip" style={{ fontSize: '0.68rem', padding: '2px 8px', cursor: 'default' }}>
                      {String(s).substring(0, 20)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatTile({ label, value, icon, accent }) {
  return (
    <div className="stat-tile">
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: accent || 'var(--text-muted)' }}>
        {icon}
        <span className="stat-label">{label}</span>
      </div>
      <span className="stat-value" style={{ color: accent || 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}
