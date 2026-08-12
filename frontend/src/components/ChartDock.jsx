import { BarChart2, TrendingUp, GitBranch, Activity, PieChart, Box } from 'lucide-react'
import useAppStore from '../store/useAppStore'

const CHART_TYPES = [
  { type: 'bar',       label: 'Bar',       Icon: BarChart2,  color: 'var(--accent-coral)' },
  { type: 'line',      label: 'Line',      Icon: TrendingUp, color: 'var(--accent-sage)' },
  { type: 'scatter',   label: 'Scatter',   Icon: GitBranch,  color: 'var(--accent-periwinkle)' },
  { type: 'histogram', label: 'Histogram', Icon: Activity,   color: 'var(--accent-coral)' },
  { type: 'pie',       label: 'Pie',       Icon: PieChart,   color: 'var(--accent-sage)' },
  { type: 'box',       label: 'Box Plot',  Icon: Box,        color: 'var(--accent-periwinkle)' },
]

export default function ChartDock({ onChartRequest }) {
  const {
    sessionId, columns, summary,
    chartType, xColumn, yColumn, bins,
    setChartConfig,
    showTrendline, showOutliers, toggleTrendline, toggleOutliers,
    suggestedCharts,
  } = useAppStore()

  if (!sessionId) return null

  const numericCols = summary?.column_meta
    ?.filter(c => !c.dtype.startsWith('object') && !c.dtype.startsWith('bool') && !c.dtype.startsWith('category'))
    ?.map(c => c.name) || columns

  const handleChartTypeSelect = (type) => {
    setChartConfig({ chartType: type })
  }

  const handleSuggestedClick = (sug) => {
    setChartConfig({
      chartType: sug.chart_type,
      xColumn: sug.x_column,
      yColumn: sug.y_column,
    })
    onChartRequest?.({
      chart_type: sug.chart_type,
      x_column: sug.x_column,
      y_column: sug.y_column,
    })
  }

  const needsYColumn = ['bar', 'line', 'scatter', 'box'].includes(chartType)
  const supportsML    = ['line', 'scatter'].includes(chartType)

  return (
    <div className="clay-card" style={{ padding: 20 }} id="chart-dock">
      {/* Chart type selector */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Chart Type</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CHART_TYPES.map(({ type, label, Icon, color }) => (
            <button
              key={type}
              id={`chart-type-${type}`}
              className={`clay-chip ${chartType === type ? 'active' : ''}`}
              onClick={() => handleChartTypeSelect(type)}
              aria-pressed={chartType === type}
              aria-label={`Select ${label} chart`}
              style={chartType === type ? {} : { '--chip-accent': color }}
            >
              <Icon size={13} style={{ color: chartType === type ? '#fff' : color }} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Column selectors */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {/* X Column */}
        <div style={{ flex: '1 1 140px' }}>
          <label htmlFor="x-col-select" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 600 }}>
            X Axis
          </label>
          <select
            id="x-col-select"
            className="clay-input"
            style={{ marginTop: 4 }}
            value={xColumn || ''}
            onChange={e => setChartConfig({ xColumn: e.target.value })}
          >
            {columns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Y Column (not for histogram, box without group) */}
        {(needsYColumn || chartType === 'pie') && (
          <div style={{ flex: '1 1 140px' }}>
            <label htmlFor="y-col-select" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 600 }}>
              Y Axis
            </label>
            <select
              id="y-col-select"
              className="clay-input"
              style={{ marginTop: 4 }}
              value={yColumn || ''}
              onChange={e => setChartConfig({ yColumn: e.target.value || null })}
            >
              <option value="">— none —</option>
              {numericCols.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Bins (histogram only) */}
        {chartType === 'histogram' && (
          <div style={{ flex: '0 0 80px' }}>
            <label htmlFor="bins-input" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 600 }}>
              Bins
            </label>
            <input
              id="bins-input"
              className="clay-input"
              style={{ marginTop: 4 }}
              type="number"
              min={2}
              max={100}
              value={bins}
              onChange={e => setChartConfig({ bins: parseInt(e.target.value) || 20 })}
            />
          </div>
        )}
      </div>

      {/* ML toggles */}
      {supportsML && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button
            id="toggle-trendline"
            className={`clay-chip ${showTrendline ? 'active' : ''}`}
            onClick={toggleTrendline}
            aria-pressed={showTrendline}
            style={{ fontSize: '0.78rem' }}
          >
            📈 Trendline
          </button>
          <button
            id="toggle-outliers"
            className={`clay-chip ${showOutliers ? 'active' : ''}`}
            onClick={toggleOutliers}
            aria-pressed={showOutliers}
            style={{ fontSize: '0.78rem' }}
          >
            ⚠️ Outliers
          </button>
        </div>
      )}

      {/* Generate chart button */}
      <button
        id="generate-chart-btn"
        className="btn btn-primary"
        onClick={() => onChartRequest?.({ chart_type: chartType, x_column: xColumn, y_column: yColumn, bins })}
        disabled={!xColumn}
        style={{ width: '100%', justifyContent: 'center', fontSize: '0.9rem', padding: '12px' }}
      >
        Generate Chart
      </button>

      {/* Suggested charts */}
      {suggestedCharts.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>
            ✨ AI Suggestions
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {suggestedCharts.slice(0, 5).map((s, i) => (
              <button
                key={i}
                className="clay-chip"
                onClick={() => handleSuggestedClick(s)}
                style={{ fontSize: '0.72rem' }}
                title={s.label}
              >
                {s.chart_type} · {s.label?.substring(0, 24)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
