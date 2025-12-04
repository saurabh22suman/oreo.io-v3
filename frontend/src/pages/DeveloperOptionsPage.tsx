import { useEffect, useState, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getDataset, getProject } from '../api'
import Alert from '../components/Alert'
import {
  ArrowLeft, Play, Loader2, Code2, Share2, Copy, Check, Download,
  Table2, Clock, Database, AlertCircle, ChevronDown, X, Link2, ExternalLink,
  Trash2, LinkIcon
} from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

type QueryResult = {
  columns: string[]
  rows: any[][]
  total: number
  executionTime?: number
}

type SharedLink = {
  id: string
  dataset_id: number
  project_id: number
  sql: string
  total: number
  dataset_name: string
  project_name: string
  created_at: string
}

type TabType = 'sql-query' | 'shared-links'

// ============================================================================
// Constants
// ============================================================================

const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const MAX_ROWS = 1000

const SAMPLE_QUERIES = [
  { label: 'Select All', sql: 'SELECT * FROM dataset' },
  { label: 'Count Rows', sql: 'SELECT COUNT(*) as total FROM dataset' },
  { label: 'First 10 Rows', sql: 'SELECT * FROM dataset LIMIT 10' },
  { label: 'Distinct Values', sql: 'SELECT DISTINCT column_name FROM dataset' },
]

// ============================================================================
// Helper Functions
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function downloadCSV(columns: string[], rows: any[][], filename: string) {
  const header = columns.join(',')
  const csvRows = rows.map(row =>
    row.map(cell => {
      if (cell === null || cell === undefined) return ''
      const str = String(cell)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(',')
  )
  const csv = [header, ...csvRows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function authHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

function ResultsTable({ result }: { result: QueryResult }) {
  if (!result.columns.length) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        <p>No results to display</p>
      </div>
    )
  }

  return (
    <div className="overflow-auto max-h-[600px] border border-divider rounded-xl">
      <table className="w-full text-sm">
        <thead className="bg-surface-2/50 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider border-b border-divider w-12">
              #
            </th>
            {result.columns.map((col, i) => (
              <th
                key={i}
                className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider border-b border-divider whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {result.rows.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-surface-2/30 transition-colors">
              <td className="px-4 py-2.5 text-text-muted text-xs font-mono">
                {rowIdx + 1}
              </td>
              {row.map((cell, cellIdx) => (
                <td
                  key={cellIdx}
                  className="px-4 py-2.5 text-text whitespace-nowrap max-w-[300px] truncate"
                  title={cell !== null ? String(cell) : 'NULL'}
                >
                  {cell === null ? (
                    <span className="text-text-muted italic">NULL</span>
                  ) : typeof cell === 'boolean' ? (
                    <span className={cell ? 'text-success' : 'text-danger'}>
                      {String(cell)}
                    </span>
                  ) : (
                    String(cell)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ShareModal({
  isOpen,
  onClose,
  shareUrl,
  onCopy,
  copied,
}: {
  isOpen: boolean
  onClose: () => void
  shareUrl: string
  onCopy: () => void
  copied: boolean
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-1 rounded-2xl border border-divider shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-divider flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Link2 className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-text">Share Query Results</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-text-secondary">
            Anyone with this link can view the query results. The link is public and does not require authentication.
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 px-4 py-3 rounded-xl border border-divider bg-surface-2 text-text text-sm font-mono"
            />
            <button
              onClick={onCopy}
              className="px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium transition-colors flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            Open in new tab
          </a>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export default function DeveloperOptionsPage() {
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('sql-query')

  // State
  const [project, setProject] = useState<any>(null)
  const [dataset, setDataset] = useState<any>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)

  // Query state
  const [sql, setSql] = useState(`SELECT * FROM dataset LIMIT 100`)
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [queryError, setQueryError] = useState('')

  // Share state
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  // Shared links state
  const [sharedLinks, setSharedLinks] = useState<SharedLink[]>([])
  const [loadingLinks, setLoadingLinks] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Sample queries dropdown
  const [showSamples, setShowSamples] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load data
  useEffect(() => {
    (async () => {
      try {
        const [proj, ds] = await Promise.all([
          getProject(projectId),
          getDataset(projectId, dsId),
        ])
        setProject(proj)
        setDataset(ds)
      } catch (e: any) {
        setError(e.message || 'Failed to load dataset')
      } finally {
        setLoading(false)
      }
    })()
  }, [projectId, dsId])

  // Load shared links when tab is active
  const loadSharedLinks = async () => {
    setLoadingLinks(true)
    try {
      const response = await fetch(
        `${API_BASE}/shared-queries?dataset_id=${dsId}&project_id=${projectId}`,
        { headers: authHeaders() }
      )
      if (!response.ok) throw new Error('Failed to fetch shared links')
      const data = await response.json()
      setSharedLinks(data || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load shared links')
    } finally {
      setLoadingLinks(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'shared-links') {
      loadSharedLinks()
    }
  }, [activeTab, dsId, projectId])

  // Delete shared link
  const deleteSharedLink = async (id: string) => {
    setDeletingId(id)
    try {
      const response = await fetch(`${API_BASE}/shared-queries/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!response.ok) throw new Error('Failed to delete shared link')
      setSharedLinks(prev => prev.filter(link => link.id !== id))
      setToast('Shared link deleted')
    } catch (e: any) {
      setError(e.message || 'Failed to delete shared link')
    } finally {
      setDeletingId(null)
    }
  }

  // Execute query
  const executeQuery = async () => {
    if (!sql.trim()) {
      setQueryError('Please enter a SQL query')
      return
    }

    setExecuting(true)
    setQueryError('')
    setResult(null)

    const startTime = Date.now()

    try {
      // Build table mapping: dataset -> project_id/dataset_id
      const tableMappings: Record<string, string> = {
        dataset: `${projectId}/${dsId}`,
      }

      // Also support schema.table format using target_schema.target_table if available
      if (dataset?.target_schema && dataset?.target_table) {
        tableMappings[`${dataset.target_schema}.${dataset.target_table}`] = `${projectId}/${dsId}`
      }

      const response = await fetch(`${API_BASE}/delta/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          sql: sql.trim(),
          table_mappings: tableMappings,
          limit: MAX_ROWS,
          offset: 0,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || err.error || 'Query execution failed')
      }

      const data = await response.json()
      const executionTime = Date.now() - startTime

      setResult({
        columns: data.columns || [],
        rows: data.rows || [],
        total: data.total || data.rows?.length || 0,
        executionTime,
      })
    } catch (e: any) {
      setQueryError(e.message || 'Query execution failed')
    } finally {
      setExecuting(false)
    }
  }

  // Share results
  const handleShare = async () => {
    if (!result) return

    setSharing(true)
    try {
      // Store in backend for public sharing
      const response = await fetch(`${API_BASE}/shared-queries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          dataset_id: dsId,
          project_id: projectId,
          sql,
          columns: result.columns,
          rows: result.rows,
          total: result.total,
          dataset_name: dataset?.name || 'Unknown',
          project_name: project?.name || 'Unknown',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create share link')
      }

      const data = await response.json()
      const url = `${window.location.origin}/share/${data.id}`
      setShareUrl(url)
      setShareModalOpen(true)
    } catch (e: any) {
      setError('Failed to create share link')
    } finally {
      setSharing(false)
    }
  }

  // Copy share URL
  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Download results as CSV
  const handleDownload = () => {
    if (!result) return
    const filename = `query_results_${dataset?.name || 'data'}_${new Date().toISOString().split('T')[0]}.csv`
    downloadCSV(result.columns, result.rows, filename)
    setToast('Results downloaded')
  }

  // Insert sample query
  const insertSample = (sampleSql: string) => {
    setSql(sampleSql)
    setShowSamples(false)
    textareaRef.current?.focus()
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      executeQuery()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-1 text-text animate-fade-in">
      {/* Header */}
      <div className="bg-surface-1/50 backdrop-blur-sm border-b border-divider sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to={`/projects/${projectId}/labs?dataset=${dsId}`}
                className="p-2 rounded-xl hover:bg-surface-2 text-text-secondary hover:text-text transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <Code2 className="w-6 h-6 text-info" />
                  <h1 className="text-2xl font-bold text-text">Developer Options</h1>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-info/10 text-info border border-info/20 uppercase tracking-wider">
                    Beta
                  </span>
                </div>
                <p className="text-sm text-text-secondary mt-1">
                  {dataset?.name} • Run SQL queries and share results
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 border-b border-divider">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('sql-query')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'sql-query'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text hover:border-divider'
                }`}
              >
                <Database className="w-4 h-4" />
                SQL Query
              </button>
              <button
                onClick={() => setActiveTab('shared-links')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'shared-links'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text hover:border-divider'
                }`}
              >
                <LinkIcon className="w-4 h-4" />
                Shared Links
                {sharedLinks.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-surface-3 text-xs">
                    {sharedLinks.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="px-6 pt-4 space-y-2">
        {error && <Alert type="error" message={error} onClose={() => setError('')} />}
        {toast && <Alert type="success" message={toast} onClose={() => setToast('')} autoDismiss />}
      </div>

      {/* Main Content */}
      <div className="px-6 py-6 space-y-6">
        {/* SQL Query Tab */}
        {activeTab === 'sql-query' && (
          <>
        {/* SQL Editor Section */}
        <div className="bg-surface-1 rounded-2xl border border-divider overflow-hidden shadow-sm">
          {/* Editor Header */}
          <div className="px-5 py-4 border-b border-divider bg-surface-2/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-text-muted" />
              <h2 className="font-semibold text-text">SQL Query Editor</h2>
              <span className="text-xs text-text-muted">
                Use <code className="px-1.5 py-0.5 rounded bg-surface-3 font-mono">dataset</code> as table name
              </span>
            </div>

            {/* Sample Queries Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSamples(!showSamples)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-text-secondary text-sm transition-colors"
              >
                Sample Queries
                <ChevronDown className={`w-4 h-4 transition-transform ${showSamples ? 'rotate-180' : ''}`} />
              </button>
              {showSamples && (
                <div className="absolute right-0 mt-2 w-64 bg-surface-1 rounded-xl border border-divider shadow-xl z-20 overflow-hidden">
                  {SAMPLE_QUERIES.map((sample, i) => (
                    <button
                      key={i}
                      onClick={() => insertSample(sample.sql)}
                      className="w-full px-4 py-3 text-left hover:bg-surface-2 transition-colors border-b border-divider last:border-b-0"
                    >
                      <span className="text-sm font-medium text-text">{sample.label}</span>
                      <span className="block text-xs text-text-muted font-mono mt-1 truncate">
                        {sample.sql}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Editor */}
          <div className="p-4">
            <textarea
              ref={textareaRef}
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your SQL query here..."
              className="w-full h-48 px-4 py-3 rounded-xl border border-divider bg-surface-2 text-text font-mono text-sm resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-text-muted"
              spellCheck={false}
            />

            {/* Query Error */}
            {queryError && (
              <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20">
                <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                <p className="text-sm text-danger">{queryError}</p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-text-muted">
                Press <kbd className="px-1.5 py-0.5 rounded bg-surface-3 font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-surface-3 font-mono text-[10px]">Enter</kbd> to run query • Max {MAX_ROWS} rows
              </p>

              <div className="flex items-center gap-3">
                {result && (
                  <>
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-secondary font-medium transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download CSV
                    </button>
                    <button
                      onClick={handleShare}
                      disabled={sharing}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent font-medium transition-colors border border-accent/20"
                    >
                      {sharing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Share2 className="w-4 h-4" />
                      )}
                      Share Results
                    </button>
                  </>
                )}
                <button
                  onClick={executeQuery}
                  disabled={executing || !sql.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
                >
                  {executing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Run Query
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {result && (
          <div className="bg-surface-1 rounded-2xl border border-divider overflow-hidden shadow-sm">
            {/* Results Header */}
            <div className="px-5 py-4 border-b border-divider bg-surface-2/30 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Table2 className="w-5 h-5 text-text-muted" />
                  <h2 className="font-semibold text-text">Query Results</h2>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-surface-3 text-xs font-medium text-text-secondary">
                  {result.total.toLocaleString()} row{result.total !== 1 ? 's' : ''}
                </span>
                {result.total >= MAX_ROWS && (
                  <span className="px-2.5 py-1 rounded-lg bg-warning/10 text-xs font-medium text-warning border border-warning/20">
                    Limited to {MAX_ROWS} rows
                  </span>
                )}
              </div>

              {result.executionTime && (
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <Clock className="w-4 h-4" />
                  {formatDuration(result.executionTime)}
                </div>
              )}
            </div>

            {/* Results Table */}
            <div className="p-4">
              <ResultsTable result={result} />
            </div>
          </div>
        )}

        {/* Empty State */}
        {!result && !executing && (
          <div className="bg-surface-1 rounded-2xl border border-divider p-12 text-center">
            <div className="inline-flex p-4 rounded-2xl bg-surface-2 mb-4">
              <Code2 className="w-8 h-8 text-text-muted" />
            </div>
            <h3 className="text-lg font-semibold text-text mb-2">No Results Yet</h3>
            <p className="text-text-secondary text-sm max-w-md mx-auto">
              Write a SQL query above and click "Run Query" to see results. Use <code className="px-1.5 py-0.5 rounded bg-surface-2 font-mono text-xs">dataset</code> as the table name to query your data.
            </p>
          </div>
        )}
          </>
        )}

        {/* Shared Links Tab */}
        {activeTab === 'shared-links' && (
          <div className="bg-surface-1 rounded-2xl border border-divider overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-divider bg-surface-2/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LinkIcon className="w-5 h-5 text-text-muted" />
                <h2 className="font-semibold text-text">Active Shared Links</h2>
                <span className="text-xs text-text-muted">
                  Manage public links to query results
                </span>
              </div>
              <button
                onClick={loadSharedLinks}
                disabled={loadingLinks}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-text-secondary text-sm transition-colors"
              >
                {loadingLinks ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Refresh'
                )}
              </button>
            </div>

            <div className="p-4">
              {loadingLinks ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : sharedLinks.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex p-4 rounded-2xl bg-surface-2 mb-4">
                    <LinkIcon className="w-8 h-8 text-text-muted" />
                  </div>
                  <h3 className="text-lg font-semibold text-text mb-2">No Shared Links</h3>
                  <p className="text-text-secondary text-sm max-w-md mx-auto">
                    When you share query results, the links will appear here. You can delete them at any time.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sharedLinks.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-4 rounded-xl border border-divider bg-surface-2/30 hover:bg-surface-2/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <code className="text-xs font-mono text-text-muted bg-surface-3 px-2 py-0.5 rounded">
                            {link.id}
                          </code>
                          <span className="text-xs text-text-muted">
                            {formatRelativeTime(link.created_at)}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-medium">
                            {link.total} rows
                          </span>
                        </div>
                        <p className="text-sm text-text font-mono truncate" title={link.sql}>
                          {link.sql}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <a
                          href={`${window.location.origin}/share/${link.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg hover:bg-surface-3 text-text-secondary hover:text-primary transition-colors"
                          title="Open link"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/share/${link.id}`)
                            setToast('Link copied to clipboard')
                          }}
                          className="p-2 rounded-lg hover:bg-surface-3 text-text-secondary hover:text-text transition-colors"
                          title="Copy link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteSharedLink(link.id)}
                          disabled={deletingId === link.id}
                          className="p-2 rounded-lg hover:bg-danger/10 text-text-secondary hover:text-danger transition-colors"
                          title="Delete link"
                        >
                          {deletingId === link.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        shareUrl={shareUrl}
        onCopy={copyShareUrl}
        copied={copied}
      />
    </div>
  )
}
