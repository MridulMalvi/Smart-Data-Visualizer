import { useState } from 'react'
import { Plus, Trash2, Filter, RotateCcw } from 'lucide-react'
import useAppStore from '../store/useAppStore'
import { applyFilter, resetFilter } from '../api/client'

const OPERATORS_NUMERIC = ['==', '!=', '>', '>=', '<', '<=']
const OPERATORS_STRING  = ['contains', '==', '!=']
const ALL_OPS = ['==', '!=', '>', '>=', '<', '<=', 'contains']

export default function FilterBuilder() {
  const {
    sessionId, columns, summary, filterRules, filterResult,
    addFilterRule, updateFilterRule, removeFilterRule, setFilterResult,
  } = useAppStore()

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  if (!sessionId) return null

  const getOps = (col) => {
    const meta = summary?.column_meta?.find(c => c.name === col)
    if (!meta) return ALL_OPS
    return meta.dtype.startsWith('object') || meta.dtype === 'category'
      ? OPERATORS_STRING
      : OPERATORS_NUMERIC
  }

  const handleApply = async () => {
    setLoading(true)
    setError(null)
    try {
      const rules = filterRules.map(({ id, ...r }) => r)
      const { data } = await applyFilter(sessionId, rules)
      setFilterResult(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Filter failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await resetFilter(sessionId)
      setFilterResult({ rows_before: data.rows_after, rows_after: data.rows_after })
      // Clear rules
      filterRules.forEach(r => removeFilterRule(r.id))
    } catch (err) {
      setError(err.response?.data?.detail || 'Reset failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="clay-card" style={{ padding: 20 }} id="filter-builder">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={16} style={{ color: 'var(--accent-periwinkle)' }} />
          Filter Data
        </h3>
        {filterResult && (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {filterResult.rows_after.toLocaleString()} / {filterResult.rows_before.toLocaleString()} rows
          </span>
        )}
      </div>

      {/* Rules */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {filterRules.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>
            No filters applied. Add a rule below.
          </p>
        )}
        {filterRules.map((rule) => {
          const ops = getOps(rule.column)
          return (
            <div key={rule.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Column select */}
              <select
                id={`filter-col-${rule.id}`}
                className="clay-input"
                style={{ flex: '1 1 120px', minWidth: 100 }}
                value={rule.column}
                onChange={e => updateFilterRule(rule.id, { column: e.target.value, operator: getOps(e.target.value)[0] })}
                aria-label="Filter column"
              >
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              {/* Operator select */}
              <select
                id={`filter-op-${rule.id}`}
                className="clay-input"
                style={{ flex: '0 0 90px' }}
                value={rule.operator}
                onChange={e => updateFilterRule(rule.id, { operator: e.target.value })}
                aria-label="Filter operator"
              >
                {ops.map(op => <option key={op} value={op}>{op}</option>)}
              </select>

              {/* Value input */}
              <input
                id={`filter-val-${rule.id}`}
                className="clay-input"
                style={{ flex: '1 1 100px', minWidth: 80 }}
                placeholder="value"
                value={rule.value}
                onChange={e => updateFilterRule(rule.id, { value: e.target.value })}
                aria-label="Filter value"
              />

              {/* Remove */}
              <button
                className="btn btn-secondary"
                style={{ padding: '8px', borderRadius: '10px', flexShrink: 0 }}
                onClick={() => removeFilterRule(rule.id)}
                aria-label="Remove filter rule"
              >
                <Trash2 size={14} color="var(--accent-coral)" />
              </button>
            </div>
          )
        })}
      </div>

      {error && (
        <p style={{ fontSize: '0.8rem', color: 'var(--accent-coral)', marginBottom: 10 }}>{error}</p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={addFilterRule} style={{ fontSize: '0.83rem' }}>
          <Plus size={14} />
          Add Rule
        </button>
        <button
          className="btn btn-periwinkle"
          onClick={handleApply}
          disabled={loading || filterRules.length === 0}
          style={{ fontSize: '0.83rem' }}
        >
          {loading ? <div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} /> : <Filter size={14} />}
          Apply
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleReset}
          disabled={loading}
          style={{ fontSize: '0.83rem' }}
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>
    </div>
  )
}
