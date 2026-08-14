import { useCallback, useRef, useState } from 'react'
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react'
import useAppStore from '../store/useAppStore'
import { uploadFile, fetchPreview, fetchSummary } from '../api/client'

const ALLOWED_EXTS = ['.csv', '.xlsx']
const MAX_MB = 50

export default function UploadZone() {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)
  const {
    uploadStatus, uploadError, uploadProgress,
    setUploadStatus, setUploadProgress, setSession, setPreview, setSummary,
  } = useAppStore()

  const processFile = useCallback(async (file) => {
    // Validate
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!ALLOWED_EXTS.includes(ext)) {
      setUploadStatus('error', `Unsupported format "${ext}". Please upload a CSV or XLSX file.`)
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setUploadStatus('error', `File exceeds ${MAX_MB} MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`)
      return
    }

    setUploadStatus('uploading')
    setUploadProgress(0)

    try {
      const { data } = await uploadFile(file, setUploadProgress)
      setSession(data)

      // Fetch preview + summary in parallel
      const [prev, summ] = await Promise.all([
        fetchPreview(data.session_id, 10),
        fetchSummary(data.session_id),
      ])
      setPreview(prev.data)
      setSummary(summ.data)
    } catch (err) {
      let msg = err.response?.data?.detail || err.message || 'Upload failed.'
      // Axios wraps connection failures as "Network Error" with no response
      if (!err.response && (err.message === 'Network Error' || err.code === 'ERR_NETWORK')) {
        msg = 'Cannot connect to the backend server. Make sure it is running on port 8000 (uvicorn app.main:app --port 8000).'
      }
      setUploadStatus('error', msg)
    }
  }, [setUploadStatus, setUploadProgress, setSession, setPreview, setSummary])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)
  const onInputChange = (e) => { const f = e.target.files[0]; if (f) processFile(f) }

  const isLoading = uploadStatus === 'uploading'

  return (
    <div
      id="upload-zone"
      className={`upload-zone clay-card ${dragging ? 'dragover' : ''}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      style={{ padding: '48px 32px', textAlign: 'center', cursor: isLoading ? 'wait' : 'pointer' }}
      onClick={() => !isLoading && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="Upload CSV or XLSX file"
      onKeyDown={(e) => e.key === 'Enter' && !isLoading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx"
        style={{ display: 'none' }}
        onChange={onInputChange}
        id="file-input"
      />

      {uploadStatus === 'done' ? (
        <UploadSuccess />
      ) : (
        <>
          {/* Icon area */}
          <div style={{
            width: 72, height: 72, borderRadius: '20px',
            background: 'var(--accent-coral)', margin: '0 auto 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-clay-sm)',
          }}>
            {isLoading
              ? <div className="spinner" style={{ width: 28, height: 28, borderTopColor: '#fff' }} />
              : <Upload size={30} color="#fff" strokeWidth={2} />}
          </div>

          <h2 style={{ marginBottom: 8, fontSize: '1.3rem' }}>
            {dragging ? 'Drop your file here!' : 'Drag & drop your dataset'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: '0.9rem' }}>
            CSV or XLSX · up to {MAX_MB} MB
          </p>

          {/* Progress bar */}
          {isLoading && (
            <div style={{ margin: '0 auto 16px', maxWidth: 320 }}>
              <div className="missing-bar-track">
                <div className="missing-bar-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6 }}>
                Uploading… {uploadProgress}%
              </p>
            </div>
          )}

          {!isLoading && (
            <button className="btn btn-primary" tabIndex={-1} type="button">
              <FileText size={16} />
              Browse files
            </button>
          )}

          {/* Error */}
          {uploadStatus === 'error' && uploadError && (
            <div style={{
              marginTop: 16, padding: '10px 16px', borderRadius: 12,
              background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.3)',
              display: 'flex', alignItems: 'flex-start', gap: 8, textAlign: 'left',
              maxWidth: 480, margin: '16px auto 0',
            }}>
              <AlertCircle size={16} color="var(--accent-coral)" style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: '0.83rem', color: 'var(--accent-coral)' }}>{uploadError}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function UploadSuccess() {
  const { filename, totalRows, columns, reset } = useAppStore()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <CheckCircle2 size={48} color="var(--accent-sage)" strokeWidth={1.5} />
      <div>
        <h3 style={{ marginBottom: 4 }}>{filename}</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          {totalRows.toLocaleString()} rows · {columns.length} columns
        </p>
      </div>
      <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); reset() }} style={{ fontSize: '0.8rem' }}>
        Upload a different file
      </button>
    </div>
  )
}
