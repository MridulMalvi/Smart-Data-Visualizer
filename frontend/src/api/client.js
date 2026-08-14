/**
 * Axios client — thin wrapper around the backend API.
 * Uses Vite proxy (/api → 127.0.0.1:8000) in dev.
 */
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 120_000,   // 2 min — NLG model inference can be slow on first call
})

// ── Upload ─────────────────────────────────────────────────────────────────

export const uploadFile = (file, onProgress) => {
  const fd = new FormData()
  fd.append('file', file)
  // NOTE: Do NOT set Content-Type manually.
  // When FormData is passed, axios (and the browser) set it automatically
  // as: multipart/form-data; boundary=----FormBoundaryXXXX
  // Setting it manually removes the boundary, breaking the server parser.
  return api.post('/upload/', fd, {
    onUploadProgress: e => onProgress?.(Math.round((e.loaded / (e.total || e.loaded)) * 100)),
  })
}

// ── Preview ────────────────────────────────────────────────────────────────

export const fetchPreview = (sessionId, rows = 10, useFiltered = false) =>
  api.get(`/preview/${sessionId}`, { params: { rows, use_filtered: useFiltered } })

// ── Summary ────────────────────────────────────────────────────────────────

export const fetchSummary = (sessionId) =>
  api.get(`/summary/${sessionId}`)

// ── Filter ─────────────────────────────────────────────────────────────────

export const applyFilter = (sessionId, rules) =>
  api.post('/filter/apply', { session_id: sessionId, rules })

export const resetFilter = (sessionId) =>
  api.post('/filter/reset', { session_id: sessionId })

// ── Chart ──────────────────────────────────────────────────────────────────

export const fetchChartData = (payload) =>
  api.post('/chart/data', payload)

// ── NLQ ────────────────────────────────────────────────────────────────────

export const parseNLQ = (sessionId, query) =>
  api.post('/nlq/parse', { session_id: sessionId, query })

// ── Insight ────────────────────────────────────────────────────────────────

export const generateInsight = (sessionId, chartType, xColumn, yColumn, stats) =>
  api.post('/insight/generate', {
    session_id: sessionId,
    chart_type: chartType,
    x_column: xColumn,
    y_column: yColumn,
    stats,
  })

// ── Export ─────────────────────────────────────────────────────────────────

export const getExportUrl = (sessionId, useFiltered = true) =>
  `/api/export/csv/${sessionId}?use_filtered=${useFiltered}`

export default api
