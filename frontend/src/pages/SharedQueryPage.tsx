import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { 
  Code2, Download, Clock, Database, Table2, ExternalLink, 
  Loader2, AlertCircle, ArrowLeft 
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

type SharedQuery = {
  id: string
  sql: string
  columns: string
  rows: string
  total: number
  created_at: string
  dataset_name: string
  project_name: string
}

type ParsedSharedQuery = {
  id: string
  sql: string
  result: QueryResult
  createdAt: string
  datasetName: string
  projectName: string
}

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
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

// ============================================================================
// Main Component
// ============================================================================

export default function SharedQueryPage() {
  const { shareId } = useParams()
  const [sharedQuery, setSharedQuery] = useState<ParsedSharedQuery | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // Load shared query from backend
    const fetchSharedQuery = async () => {
      try {
        const response = await fetch(`${API_BASE}/shared-queries/${shareId}`)
        
        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Shared query not found')
        }

        const data: SharedQuery = await response.json()
        
        // Parse JSON strings for columns and rows
        const columns = JSON.parse(data.columns || '[]')
        const rows = JSON.parse(data.rows || '[]')
        
        setSharedQuery({
          id: data.id,
          sql: data.sql,
          result: {
            columns,
            rows,
            total: data.total,
          },
          createdAt: data.created_at,
          datasetName: data.dataset_name,
          projectName: data.project_name,
        })
      } catch (e: any) {
        setError(e.message || 'Failed to load shared query')
      } finally {
        setLoading(false)
      }
    }

    fetchSharedQuery()
  }, [shareId])

  const handleDownload = () => {
    if (!sharedQuery) return
    const filename = `shared_query_${sharedQuery.datasetName}_${new Date().toISOString().split('T')[0]}.csv`
    downloadCSV(sharedQuery.result.columns, sharedQuery.result.rows, filename)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-1">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !sharedQuery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-1 p-6">
        <div className="bg-surface-1 rounded-2xl border border-divider p-8 max-w-md text-center shadow-lg">
          <div className="inline-flex p-4 rounded-2xl bg-danger/10 mb-4">
            <AlertCircle className="w-8 h-8 text-danger" />
          </div>
          <h1 className="text-xl font-bold text-text mb-2">Query Not Found</h1>
          <p className="text-text-secondary mb-6">
            {error || 'The shared query you are looking for does not exist or has expired.'}
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-1 text-text">
      {/* Header */}
      <div className="bg-surface-1/50 backdrop-blur-sm border-b border-divider sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-xl bg-info/10">
                <Code2 className="w-6 h-6 text-info" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text">Shared Query Results</h1>
                <p className="text-sm text-text-secondary">
                  {sharedQuery.projectName} / {sharedQuery.datasetName}
                </p>
              </div>
            </div>

            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Query Info */}
        <div className="bg-surface-1 rounded-2xl border border-divider overflow-hidden">
          <div className="px-5 py-4 border-b border-divider bg-surface-2/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-text-muted" />
              <h2 className="font-semibold text-text">SQL Query</h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Clock className="w-4 h-4" />
              Shared on {formatDate(sharedQuery.createdAt)}
            </div>
          </div>
          <div className="p-4">
            <pre className="px-4 py-3 rounded-xl bg-surface-2 border border-divider text-sm font-mono text-text overflow-x-auto">
              {sharedQuery.sql}
            </pre>
          </div>
        </div>

        {/* Results */}
        <div className="bg-surface-1 rounded-2xl border border-divider overflow-hidden">
          <div className="px-5 py-4 border-b border-divider bg-surface-2/30 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Table2 className="w-5 h-5 text-text-muted" />
              <h2 className="font-semibold text-text">Results</h2>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-surface-3 text-xs font-medium text-text-secondary">
              {sharedQuery.result.total.toLocaleString()} row{sharedQuery.result.total !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="p-4">
            <ResultsTable result={sharedQuery.result} />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-sm text-text-muted">
            Powered by{' '}
            <a href="/" className="text-primary hover:underline inline-flex items-center gap-1">
              Oreo.io
              <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
