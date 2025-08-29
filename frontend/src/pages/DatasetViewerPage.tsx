import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getDatasetDataTop, getDatasetStatsTop, getProject, queryDatasetTop } from '../api'
import Alert from '../components/Alert'
import AgGridDialog from '../components/AgGridDialog'

export default function DatasetViewerPage(){
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const [project, setProject] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [rows, setRows] = useState<any[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(50)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(()=>{ (async()=>{
    try{
      setProject(await getProject(projectId))
      setStats(await getDatasetStatsTop(dsId))
      // Do not auto-load data; wait for user action
    }catch(e:any){ setError(e.message) }
  })() }, [projectId, dsId])

  async function loadData(){
    try{
      if(filter.trim()){
        // Try simple JSON parse for where filter
        let where: any = {}
        try{ where = JSON.parse(filter) }catch{ where = {} }
        const r = await queryDatasetTop(dsId, where, limit, offset)
  setRows(r.data||[]); setColumns(r.columns||[]); setOpen(true)
      } else {
  const s = await getDatasetDataTop(dsId, limit, offset); setRows(s.data||[]); setColumns(s.columns||[]); setOpen(true)
      }
    }catch(e:any){ setError(e.message) }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Dataset Viewer</h2>
        <div className="flex gap-2 text-sm">
          <Link to={`/projects/${projectId}/datasets/${dsId}/approvals`} className="text-primary hover:underline">Back: Approvals</Link>
        </div>
      </div>
  {error && <Alert type="error" message={error} onClose={()=>setError('')} />}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2 border border-gray-200 bg-white rounded-md p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-700">Rows: {stats?.row_count ?? rows.length} {stats?.owner_name && (<span className="ml-2 text-xs text-gray-500">Owner: {stats.owner_name}</span>)} {stats?.pending_approvals != null && (<span className="ml-2 text-xs text-gray-500">Pending approvals: {stats.pending_approvals}</span>)}</div>
            <div className="flex items-center gap-2 text-xs">
              <label>Limit</label>
              <input type="number" value={limit} onChange={e=>setLimit(Number(e.target.value)||50)} className="w-20 border border-gray-300 rounded-md px-2 py-1" />
              <label>Offset</label>
              <input type="number" value={offset} onChange={e=>setOffset(Number(e.target.value)||0)} className="w-24 border border-gray-300 rounded-md px-2 py-1" />
              <button className="rounded-md border border-gray-300 px-2 py-1 hover:bg-gray-50" onClick={()=> loadData()}>Load data</button>
            </div>
          </div>
          <div className="text-xs text-gray-600">Use Load data to open a popup preview.</div>
        </div>
        <div className="border border-gray-200 bg-white rounded-md p-3">
          <div className="text-sm font-medium mb-2">Filter (JSON)</div>
          <textarea className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-xs" rows={12} placeholder='{"country":"US"}' value={filter} onChange={e=>setFilter(e.target.value)} />
          <div className="flex gap-2 mt-2">
            <button className="rounded-md bg-primary text-white px-3 py-1.5 text-sm hover:bg-indigo-600" onClick={()=> loadData()}>Apply filter</button>
            <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" onClick={async()=>{ try{ setStats(await getDatasetStatsTop(dsId)) }catch(e:any){ setError(e.message) } }}>Refresh stats</button>
          </div>
        </div>
      </div>
      <AgGridDialog
        open={open}
        onOpenChange={setOpen}
        title={`Dataset ${dsId} preview (${rows.length} rows)`}
        rows={rows}
        columns={columns}
        pageSize={50}
  allowEdit={false}
  compact
      />
    </div>
  )
}
