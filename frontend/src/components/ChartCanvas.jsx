import { useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
  ComposedChart, Area,
  ReferenceDot,
} from 'recharts'
import useAppStore from '../store/useAppStore'

const COLORS = ['#FF6B6B', '#88B04B', '#6B7FD7', '#FFB347', '#A78BFA', '#34D399']

// ── Custom Tooltip ─────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-clay)',
      borderRadius: 12, padding: '10px 14px', boxShadow: 'var(--shadow-clay-sm)',
      fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem',
    }}>
      {label !== undefined && <p style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color || 'var(--text-primary)' }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 4 }) : entry.value}
        </p>
      ))}
    </div>
  )
}

// ── Box Plot (ComposedChart approximation) ─────────────────────────────────

function BoxChart({ data, xKey }) {
  if (!data?.length) return <EmptyState />
  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-clay)" />
        <XAxis dataKey={xKey || 'group'} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
        <Tooltip content={<CustomTooltip />} />
        {/* Min-Max range bar */}
        <Bar dataKey="min" fill="transparent" stackId="box" />
        <Bar dataKey="q1"  fill="rgba(107,127,215,0.25)" stackId="box" />
        <Bar dataKey="median" fill="var(--accent-periwinkle)" stackId="box" />
        <Bar dataKey="q3"  fill="rgba(107,127,215,0.25)" stackId="box" />
        <Bar dataKey="max" fill="transparent" stackId="box" />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ message = 'No data available' }) {
  return (
    <div style={{
      height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic',
    }}>
      {message}
    </div>
  )
}

// ── Main ChartCanvas ────────────────────────────────────────────────────────

export default function ChartCanvas() {
  const {
    chartData, chartLoading, chartError,
    chartType, xColumn, yColumn,
    showTrendline, showOutliers,
  } = useAppStore()

  // Find outlier row indices for highlight
  const outlierIndices = useMemo(
    () => new Set(chartData?.outliers?.row_indices || []),
    [chartData]
  )

  if (chartLoading) {
    return (
      <div className="clay-card chart-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div className="spinner" />
        <span style={{ color: 'var(--text-muted)' }}>Generating chart…</span>
      </div>
    )
  }

  if (chartError) {
    return (
      <div className="clay-card chart-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--accent-coral)', fontSize: '0.9rem' }}>⚠ {chartError}</p>
      </div>
    )
  }

  if (!chartData) {
    return (
      <div className="clay-card chart-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <span style={{ fontSize: '2.5rem' }}>📊</span>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Configure your chart and press <strong>Generate Chart</strong>
        </p>
      </div>
    )
  }

  // Guard: API may return no data field in edge cases
  const { data: rawData, x_key, y_key, trendline } = chartData
  const data = Array.isArray(rawData) ? rawData : []
  const xKey = x_key || 'x'
  const yKey = y_key || 'y'

  const commonProps = {
    margin: { top: 10, right: 20, left: 0, bottom: 40 },
  }
  const axisProps = {
    tick: { fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' },
    axisLine: { stroke: 'var(--border-clay)' },
    tickLine: false,
  }

  // ── Enrich scatter data with outlier flag ─────────────────────────────────
  const enrichedData = useMemo(() => {
    if (!data.length) return []
    if (!showOutliers || chartType !== 'scatter') return data
    return data.map((row, i) => ({ ...row, _outlier: outlierIndices.has(i) }))
  }, [data, showOutliers, chartType, outlierIndices])

  let chart

  switch (chartType) {
    case 'line':
      chart = (
        <ComposedChart data={data} {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-clay)" />
          <XAxis dataKey={xKey} {...axisProps} angle={-30} textAnchor="end" height={55} />
          <YAxis {...axisProps} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '0.78rem', paddingTop: 8 }} />
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={COLORS[0]}
            strokeWidth={2.5}
            dot={{ r: 3, fill: COLORS[0] }}
            activeDot={{ r: 5 }}
            name={yColumn || xColumn}
          />
          {/* Trendline overlay */}
          {showTrendline && trendline?.points && (
            <Line
              data={trendline.points}
              type="linear"
              dataKey="trend"
              stroke={COLORS[2]}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              name={`Trend (R²=${trendline.r_squared})`}
            />
          )}
        </ComposedChart>
      )
      break

    case 'bar':
      chart = (
        <BarChart data={data} {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-clay)" />
          <XAxis dataKey={xKey} {...axisProps} angle={-30} textAnchor="end" height={55} />
          <YAxis {...axisProps} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '0.78rem', paddingTop: 8 }} />
          <Bar dataKey={yKey} fill={COLORS[0]} radius={[6, 6, 0, 0]} name={yColumn || xColumn} maxBarSize={60} />
        </BarChart>
      )
      break

    case 'scatter':
      chart = (
        <ComposedChart data={enrichedData} {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-clay)" />
          <XAxis dataKey={xKey} type="number" {...axisProps} name={xColumn} />
          <YAxis dataKey={yKey} type="number" {...axisProps} name={yColumn} />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter
            dataKey={yKey}
            fill={COLORS[2]}
            name={`${xColumn} vs ${yColumn}`}
          >
            {enrichedData.map((entry, i) => (
              <Cell
                key={i}
                fill={showOutliers && entry._outlier ? COLORS[0] : COLORS[2]}
                opacity={showOutliers && entry._outlier ? 1 : 0.75}
              />
            ))}
          </Scatter>
          {/* Trendline overlay */}
          {showTrendline && trendline?.points && (
            <Line
              data={trendline.points}
              type="linear"
              dataKey="trend"
              stroke={COLORS[1]}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              name={`Trend (R²=${trendline.r_squared})`}
            />
          )}
        </ComposedChart>
      )
      break

    case 'histogram':
      chart = (
        <BarChart data={data} {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-clay)" />
          <XAxis dataKey={xKey} {...axisProps} tickFormatter={v => Number(v).toFixed(1)} angle={-20} textAnchor="end" height={45} />
          <YAxis {...axisProps} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey={yKey} fill={COLORS[1]} name="Count" />
        </BarChart>
      )
      break

    case 'pie': {
      const RADIAN = Math.PI / 180
      const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
        if (percent < 0.04) return null
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5
        const x = cx + radius * Math.cos(-midAngle * RADIAN)
        const y = cy + radius * Math.sin(-midAngle * RADIAN)
        return (
          <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11}>
            {`${(percent * 100).toFixed(1)}%`}
          </text>
        )
      }
      chart = (
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="70%"
            labelLine={false}
            label={renderLabel}
          >
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '0.78rem', paddingTop: 8 }} />
        </PieChart>
      )
      break
    }

    case 'box':
      return (
        <div className="clay-card chart-container" style={{ padding: 20 }} id="chart-canvas">
          <ChartHeader chartType={chartType} />
          <BoxChart data={data} xKey="group" />
          <ChartFooter trendline={trendline} showTrendline={showTrendline} outliers={chartData?.outliers} showOutliers={showOutliers} />
        </div>
      )

    default:
      chart = <EmptyState message="Unsupported chart type" />
  }

  return (
    <div className="clay-card chart-container" style={{ padding: 20 }} id="chart-canvas">
      <ChartHeader chartType={chartType} />
      <ResponsiveContainer width="100%" height={340}>
        {chart}
      </ResponsiveContainer>
      <ChartFooter trendline={trendline} showTrendline={showTrendline} outliers={chartData?.outliers} showOutliers={showOutliers} />
    </div>
  )
}

function ChartHeader({ chartType }) {
  const { xColumn, yColumn } = useAppStore()
  return (
    <div style={{ marginBottom: 12 }}>
      <h3 style={{ textTransform: 'capitalize' }}>{chartType} Chart</h3>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        {xColumn}{yColumn ? ` · ${yColumn}` : ''}
      </p>
    </div>
  )
}

function ChartFooter({ trendline, showTrendline, outliers, showOutliers }) {
  if (!trendline && !outliers?.count) return null
  return (
    <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {showTrendline && trendline && (
        <span className="badge badge-periwinkle">
          slope: {trendline.slope.toFixed(4)} · R²: {trendline.r_squared}
        </span>
      )}
      {showOutliers && outliers?.count > 0 && (
        <span className="badge badge-coral">
          {outliers.count} outlier{outliers.count !== 1 ? 's' : ''} ({outliers.method.toUpperCase()})
        </span>
      )}
    </div>
  )
}
