/**
 * Zustand global store — single source of truth for the entire app.
 */
import { create } from 'zustand'

const useAppStore = create((set, get) => ({
  // ── Session ──────────────────────────────────────────────────────────────
  sessionId:    null,
  filename:     null,
  uploadStatus: 'idle',   // 'idle' | 'uploading' | 'done' | 'error'
  uploadError:  null,
  uploadProgress: 0,

  // ── Dataset meta ─────────────────────────────────────────────────────────
  columns:      [],        // string[]
  totalRows:    0,
  suggestedCharts: [],    // [{chart_type, x_column, y_column, label}]

  // ── Preview ───────────────────────────────────────────────────────────────
  previewRows:  [],
  previewCols:  [],

  // ── Summary ───────────────────────────────────────────────────────────────
  summary:      null,      // SummaryResponse

  // ── Filters ───────────────────────────────────────────────────────────────
  filterRules:  [],        // [{id, column, operator, value}]
  filterResult: null,      // {rows_before, rows_after}

  // ── Chart config ──────────────────────────────────────────────────────────
  chartType:    'bar',
  xColumn:      null,
  yColumn:      null,
  bins:         20,

  // ── Chart data ────────────────────────────────────────────────────────────
  chartData:       null,   // ChartResponse
  chartLoading:    false,
  chartError:      null,

  // ── ML features ──────────────────────────────────────────────────────────
  showTrendline:   false,
  showOutliers:    false,

  // ── Insight ───────────────────────────────────────────────────────────────
  insight:         null,
  insightLoading:  false,
  insightKey:      0,      // bumped to trigger re-animation

  // ── NLQ ───────────────────────────────────────────────────────────────────
  nlqResult:       null,
  nlqLoading:      false,

  // ── Theme ─────────────────────────────────────────────────────────────────
  theme: localStorage.getItem('sdv-theme') || 'light',

  // ── Actions ───────────────────────────────────────────────────────────────

  setUploadStatus: (status, error = null) =>
    set({ uploadStatus: status, uploadError: error }),

  setUploadProgress: (p) => set({ uploadProgress: p }),

  setSession: (data) =>
    set({
      sessionId:       data.session_id,
      filename:        data.filename,
      columns:         data.columns,
      totalRows:       data.rows,
      suggestedCharts: data.suggested_charts,
      uploadStatus:    'done',
      uploadProgress:  100,
      // Reset dependent state
      filterRules:  [],
      filterResult: null,
      chartData:    null,
      insight:      null,
      xColumn:      data.columns[0] || null,
      yColumn:      data.columns[1] || null,
    }),

  setPreview: (preview) =>
    set({ previewRows: preview.rows, previewCols: preview.columns }),

  setSummary: (summary) => set({ summary }),

  addFilterRule: () =>
    set((s) => ({
      filterRules: [
        ...s.filterRules,
        { id: Date.now(), column: s.columns[0] || '', operator: '==', value: '' },
      ],
    })),

  updateFilterRule: (id, patch) =>
    set((s) => ({
      filterRules: s.filterRules.map((r) => r.id === id ? { ...r, ...patch } : r),
    })),

  removeFilterRule: (id) =>
    set((s) => ({ filterRules: s.filterRules.filter((r) => r.id !== id) })),

  setFilterResult: (result) => set({ filterResult: result }),

  setChartConfig: (config) => set({ ...config }),

  setChartData: (data) =>
    set({ chartData: data, chartLoading: false, chartError: null }),

  setChartLoading: (v) => set({ chartLoading: v }),
  setChartError:   (e) => set({ chartError: e, chartLoading: false }),

  setInsight: (text) =>
    set((s) => ({ insight: text, insightLoading: false, insightKey: s.insightKey + 1 })),

  setInsightLoading: (v) => set({ insightLoading: v }),

  setNLQResult: (result) => set({ nlqResult: result, nlqLoading: false }),
  setNLQLoading: (v)     => set({ nlqLoading: v }),

  toggleTrendline: () => set((s) => ({ showTrendline: !s.showTrendline })),
  toggleOutliers:  () => set((s) => ({ showOutliers:  !s.showOutliers  })),

  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'light' ? 'dark' : 'light'
      localStorage.setItem('sdv-theme', next)
      document.documentElement.setAttribute('data-theme', next)
      return { theme: next }
    }),

  reset: () =>
    set({
      sessionId: null, filename: null, uploadStatus: 'idle', uploadError: null,
      uploadProgress: 0, columns: [], totalRows: 0, suggestedCharts: [],
      previewRows: [], previewCols: [], summary: null, filterRules: [],
      filterResult: null, chartData: null, insight: null, nlqResult: null,
    }),
}))

export default useAppStore
