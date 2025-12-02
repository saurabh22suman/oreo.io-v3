import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getDatasetDataTop, getDatasetStatsTop, getProject, getDataset, getDatasetSchemaTop } from '../api'
import Alert from '../components/Alert'
import { DataTable, DataType } from '../components/DataTable'
import {
  Table2, RefreshCw, Edit2, ArrowLeft
} from 'lucide-react'

export default function DatasetViewerPage() {
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  
  const [project, setProject] = useState<any>(null)
  const [dataset, setDataset] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [rows, setRows] = useState<any[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({})
  const [columnTypes, setColumnTypes] = useState<Record<string, DataType>>({})
  const [page, setPage] = useState(0)
  const [pageSize] = useState(50)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [runtime, setRuntime] = useState<number>(0)
  const [lastRefreshed, setLastRefreshed] = useState<Date | undefined>()

  const loadData = useCallback(async (offset: number, limit: number) => {
    try {
      setLoading(true)
      const start = performance.now()
      const response = await getDatasetDataTop(dsId, limit, offset)
      const end = performance.now()
      setRuntime((end - start) / 1000)
      setLastRefreshed(new Date())

      if (!response) throw new Error('No response from server')

      const dataArray = response.data || response.rows || []
      const columnsArray = response.columns || []

      setRows(dataArray)
      setColumns(columnsArray)
    } catch (e: any) {
      console.error('[DataViewer] Error loading data:', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [dsId])

  useEffect(() => {
    (async () => {
      try {
        setProject(await getProject(projectId))
        setDataset(await getDataset(projectId, dsId))
        setStats(await getDatasetStatsTop(dsId))
        
        // Fetch schema to get column mappings and types
        try {
          const schemaResp = await getDatasetSchemaTop(dsId)
          if (schemaResp?.schema) {
            const schemaObj = typeof schemaResp.schema === 'string' 
              ? JSON.parse(schemaResp.schema) 
              : schemaResp.schema
            
            // Build mappings and types from schema
            const mappings: Record<string, string> = {}
            const types: Record<string, DataType> = {}
            
            if (schemaObj.properties) {
              Object.entries(schemaObj.properties).forEach(([key, prop]: [string, any]) => {
                // Column mappings
                if (prop.originalName && prop.originalName !== key) {
                  mappings[prop.originalName] = key
                }
                // Column types from schema
                if (prop.type === 'integer' || prop.type === 'number') {
                  types[key] = 'number'
                } else if (prop.type === 'boolean') {
                  types[key] = 'boolean'
                } else if (prop.format === 'date' || prop.format === 'date-time') {
                  types[key] = prop.format === 'date-time' ? 'timestamp' : 'date'
                } else {
                  types[key] = 'text'
                }
              })
            }
            
            setColumnMappings(mappings)
            setColumnTypes(types)
          }
        } catch (schemaErr) {
          console.warn('Could not fetch schema for column mappings:', schemaErr)
        }
        
        await loadData(0, 50)
      } catch (e: any) {
        setError(e.message)
        setLoading(false)
      }
    })()
  }, [projectId, dsId, loadData])

  const handlePageChange = useCallback((newPage: number, newPageSize: number) => {
    setPage(newPage - 1)
    loadData((newPage - 1) * newPageSize, newPageSize)
  }, [loadData])

  const handleRefresh = useCallback(async () => {
    try {
      setStats(await getDatasetStatsTop(dsId))
      await loadData(page * pageSize, pageSize)
    } catch (e: any) {
      setError(e.message)
    }
  }, [dsId, page, pageSize, loadData])

  // Auto-detect column types from data if not from schema
  const detectedColumnTypes = useMemo(() => {
    if (Object.keys(columnTypes).length > 0) return columnTypes
    
    const types: Record<string, DataType> = {}
    if (rows.length > 0) {
      columns.forEach(col => {
        const val = rows[0][col]
        if (typeof val === 'number') types[col] = 'number'
        else if (typeof val === 'boolean') types[col] = 'boolean'
        else if (val instanceof Date) types[col] = 'date'
        else if (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '') types[col] = 'number'
        else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) types[col] = 'timestamp'
        else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) types[col] = 'date'
        else types[col] = 'text'
      })
    }
    return types
  }, [rows, columns, columnTypes])

  return (
    <div className="min-h-screen bg-surface-1 text-text animate-fade-in">
      <div className="bg-surface-1/50 backdrop-blur-sm border-b border-divider sticky top-0 z-40">
        <div className="max-w-full px-4 py-3">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <Link
                to={`/projects/${projectId}/datasets/${dsId}`}
                className="p-2 rounded-full hover:bg-surface-2 text-text-secondary hover:text-text transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5">
                  <Table2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-text leading-tight font-display tracking-tight">Data Viewer</h1>
                  <p className="text-text-secondary text-sm font-medium mt-1">Explore {dataset?.name}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Link
                to={`/projects/${projectId}/datasets/${dsId}/live-edit`}
                className="flex items-center gap-2 px-4 py-2 bg-warning/10 hover:bg-warning/20 border border-warning/20 text-warning text-sm font-bold rounded-xl transition-all hover:-translate-y-0.5"
                title="Live Edit (Experimental)"
              >
                <Edit2 className="w-4 h-4" />
                Live Edit
                <span className="text-[10px] bg-warning text-white px-1.5 py-0.5 rounded-md ml-1">Beta</span>
              </Link>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface-3 border border-divider text-text-secondary hover:text-text text-sm font-medium rounded-xl transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full">
        {error && <div className="px-4 py-2"><Alert type="error" message={error} onClose={() => setError('')} /></div>}

        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center h-[calc(100vh-140px)]">
            <div className="text-text-secondary flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading data...
            </div>
          </div>
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            columnTypes={detectedColumnTypes}
            columnMappings={columnMappings}
            title={dataset?.name || 'Dataset'}
            height="calc(100vh - 140px)"
            allowEdit={false}
            allowSearch={true}
            allowFilter={true}
            allowColumnToggle={true}
            allowExport={true}
            allowRefresh={true}
            pageSize={pageSize}
            totalRows={stats?.row_count}
            currentPage={page + 1}
            onPageChange={handlePageChange}
            onRefresh={handleRefresh}
            runtime={runtime}
            lastRefreshed={lastRefreshed}
          />
        )}
      </div>
    </div>
  )
}
