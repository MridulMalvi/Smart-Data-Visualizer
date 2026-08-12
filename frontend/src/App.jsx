import { useCallback, useEffect, useRef } from 'react'
import useAppStore from './store/useAppStore'
import { fetchChartData, generateInsight, getExportUrl } from './api/client'

import ThemeToggle    from './components/ThemeToggle'
import UploadZone     from './components/UploadZone'
import PreviewTable   from './components/PreviewTable'
import StatsPanel     from './components/StatsPanel'
import FilterBuilder  from './components/FilterBuilder'
import ChartDock      from './components/ChartDock'
import ChartCanvas    from './components/ChartCanvas'
import NLQBar         from './components/NLQBar'
import InsightTile    from './components/InsightTile'

export default function App() {
  const {
    sessionId, theme,
    chartType, xColumn, yColumn, bins, chartData,
    setChartConfig, setChartData, setChartLoading, setChartError,
    setInsight, setInsightLoading,
  } = useAppStore()

  // Apply theme on mount and change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // ── Chart generation ──────────────────────────────────────────────────────

  const requestChart = useCallback(async (config = {}) => {
    if (!sessionId) return
    const ct   = config.chart_type ?? chartType
    const xCol = config.x_column   ?? xColumn
    const yCol = config.y_column   ?? yColumn
    const b    = config.bins       ?? bins

    if (!xCol) return

    // Update store config if driven by NLQ/suggestion
    setChartConfig({ chartType: ct, xColumn: xCol, yColumn: yCol ?? null })

    setChartLoading(true)
    setChartError(null)

    try {
      const { data: chartResp } = await fetchChartData({
        session_id:  sessionId,
        chart_type:  ct,
        x_column:    xCol,
        y_column:    yCol || null,
        bins:        b,
        use_filtered: true,
      })
      setChartData(chartResp)
      // Always call the latest requestInsight via ref — avoids stale closure
      requestInsightRef.current?.(ct, xCol, yCol, chartResp?.stats)
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Chart generation failed.'
      setChartError(msg)
    } finally {
      setChartLoading(false)
    }
  }, [sessionId, chartType, xColumn, yColumn, bins,
      setChartConfig, setChartData, setChartLoading, setChartError])

  // ── Insight generation ────────────────────────────────────────────────────
  // Stored in a ref so requestChart always calls the latest version
  // without needing requestInsight in its own dep array (which causes loops).
  const requestInsightRef = useRef(null)

  const requestInsight = useCallback(async (ct, xCol, yCol, stats) => {
    if (!sessionId) return
    setInsightLoading(true)
    try {
      const { data } = await generateInsight(sessionId, ct, xCol, yCol, stats || {})
      setInsight(data.insight)
    } catch {
      setInsight('Unable to generate insight for this chart.')
    } finally {
      setInsightLoading(false)
    }
  }, [sessionId, setInsightLoading, setInsight])

  // Keep ref always pointing to the latest requestInsight
  requestInsightRef.current = requestInsight

  const handleRegenerate = useCallback(() => {
    if (chartData) {
      requestInsight(chartType, xColumn, yColumn, chartData.stats)
    }
  }, [requestInsight, chartData, chartType, xColumn, yColumn])

  // ── NLQ resolved → run chart ──────────────────────────────────────────────
  const handleNLQResolved = useCallback((config) => {
    requestChart(config)
  }, [requestChart])

  // ── PNG export ────────────────────────────────────────────────────────────
  const exportPNG = useCallback(() => {
    const canvas = document.querySelector('#chart-canvas canvas') ||
                   document.querySelector('.recharts-surface')
    if (!canvas) { alert('No chart canvas found. Generate a chart first.'); return }
    const link = document.createElement('a')
    link.download = `chart-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [])

  const dataLoaded = !!sessionId

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="app-header" role="banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Logo */}
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: 'linear-gradient(135deg, var(--accent-coral), var(--accent-periwinkle))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-clay-sm)', flexShrink: 0,
          }}>
            <span style={{ fontSize: '1.1rem' }}>📊</span>
          </div>
          <div>
            <h1 style={{ fontSize: '1.2rem', lineHeight: 1 }}>Smart Data Visualizer</h1>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
              AI-powered · Zero cost · Fully local
            </p>
          </div>
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {dataLoaded && (
            <>
              <button
                id="export-png-btn"
                className="btn btn-secondary"
                onClick={exportPNG}
                style={{ fontSize: '0.8rem' }}
                aria-label="Export chart as PNG"
              >
                📷 PNG
              </button>
              <a
                id="export-csv-btn"
                className="btn btn-sage"
                href={getExportUrl(sessionId, true)}
                download
                style={{ fontSize: '0.8rem', textDecoration: 'none' }}
                aria-label="Export filtered data as CSV"
              >
                📥 CSV
              </a>
            </>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* ── Main Bento Grid ──────────────────────────────────────────────── */}
      <main className="bento-grid" id="main-content" role="main">

        {/* Upload zone — always visible, collapses when data is loaded */}
        <div className={dataLoaded ? 'bento-upload' : 'bento-upload'} style={dataLoaded ? { display: 'none' } : {}}>
          <UploadZone />
        </div>

        {/* After upload — show the full dashboard */}
        {dataLoaded && (
          <>
            {/* Upload zone (compact, for re-uploading) */}
            <div style={{ gridColumn: '1 / -1' }}>
              <UploadZone />
            </div>

            {/* Preview table */}
            <div className="bento-preview">
              <PreviewTable />
            </div>

            {/* Stats panel */}
            <div className="bento-stats">
              <StatsPanel />
            </div>

            {/* NLQ bar */}
            <div className="bento-nlq">
              <NLQBar onResolved={handleNLQResolved} />
            </div>

            {/* Filter builder */}
            <div className="bento-filter">
              <FilterBuilder />
            </div>

            {/* Chart dock */}
            <div className="bento-dock">
              <ChartDock onChartRequest={requestChart} />
            </div>

            {/* Chart canvas */}
            <div className="bento-chart">
              <ChartCanvas />
            </div>

            {/* Insight tile */}
            <div className="bento-insight">
              <InsightTile onRegenerate={handleRegenerate} />
            </div>
          </>
        )}

        {/* Initial upload state */}
        {!dataLoaded && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px' }}>
            <h2 style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '1rem' }}>
              Upload a CSV or XLSX file above to get started
            </h2>
          </div>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={{
        textAlign: 'center', padding: '24px 20px 40px',
        color: 'var(--text-muted)', fontSize: '0.75rem',
      }} role="contentinfo">
        Smart Data Visualizer · Zero-cost AI/ML · Built with FastAPI + React · No API keys needed
      </footer>
    </div>
  )
}
