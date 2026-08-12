import { useState } from 'react'
import { Search } from 'lucide-react'
import useAppStore from '../store/useAppStore'

export default function PreviewTable() {
  const { previewRows, previewCols, totalRows, filename } = useAppStore()
  const [search, setSearch] = useState('')

  if (!previewRows.length) return null

  // Filter visible columns by search term
  const visibleCols = search.trim()
    ? previewCols.filter(c => c.toLowerCase().includes(search.toLowerCase()))
    : previewCols

  return (
    <div className="clay-card" style={{ padding: '20px' }} id="preview-table-card">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ marginBottom: 2 }}>Data Preview</h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Showing first {previewRows.length} of {totalRows.toLocaleString()} rows · {filename}
          </p>
        </div>

        {/* Column search */}
        <div style={{ position: 'relative', minWidth: 180 }}>
          <Search size={14} style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
          <input
            id="preview-col-search"
            className="clay-input"
            style={{ paddingLeft: 32, fontSize: '0.8rem', height: 36 }}
            placeholder="Search columns…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search columns"
          />
        </div>
      </div>

      {/* Table */}
      <div className="clay-table-wrap" style={{ maxHeight: 300 }}>
        <table className="clay-table" role="grid">
          <thead>
            <tr>
              <th style={{ minWidth: 40 }}>#</th>
              {visibleCols.map(col => (
                <th key={col} title={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, i) => (
              <tr key={i}>
                <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                {visibleCols.map(col => (
                  <td key={col} title={String(row[col] ?? '')}>
                    {row[col] === null || row[col] === undefined
                      ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>null</span>
                      : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {visibleCols.length === 0 && (
          <p style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No columns match "{search}"
          </p>
        )}
      </div>
    </div>
  )
}
