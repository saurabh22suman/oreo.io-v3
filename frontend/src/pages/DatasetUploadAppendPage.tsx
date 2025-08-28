import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { appendDatasetDataTop, getDatasetDataTop, getProject, previewAppend, appendEditedJSON } from '../api'
import AgGridDialog from '../components/AgGridDialog'

export default function DatasetUploadAppendPage(){
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const [project, setProject] = useState<any>(null)
  const [file, setFile] = useState<File|null>(null)
  const [preview, setPreview] = useState<{data:any[]; columns:string[]; total_rows?:number}|null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  // modal state for full data preview/edit when appending
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<any[]>([])
  const [cols, setCols] = useState<string[]>([])
  const [offset, setOffset] = useState(0)

  useEffect(()=>{ (async()=>{
    try{ setProject(await getProject(projectId)); const s = await getDatasetDataTop(dsId, 50, 0); setPreview({ data: s.data||[], columns: s.columns||[], total_rows: s.total_rows }) }catch(e:any){ /* ignore missing */ }
  })() }, [projectId, dsId])

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Upload & Append</h2>
        <div className="flex gap-2 text-sm">
          <Link to={`/projects/${projectId}/datasets/${dsId}/schema`} className="text-primary hover:underline">Back: Schema</Link>
          <Link to={`/projects/${projectId}/datasets/${dsId}/approvals`} className="text-primary hover:underline">Next: Approvals</Link>
        </div>
      </div>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      {toast && <div className="text-sm text-green-700 mb-2">{toast}</div>}
      <div className="border border-gray-200 bg-white rounded-md p-3 mb-3">
        <div className="flex items-center gap-2">
          <input id="file-up" type="file" className="hidden" accept=".csv,.xlsx,.xls,.json" onChange={e=> setFile(e.target.files?.[0] || null)} />
          <label htmlFor="file-up" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">Choose file</label>
          <span className="text-xs text-gray-600 max-w-[16rem] truncate">{file? file.name : 'No file selected'}</span>
          <button disabled={!file} className="rounded-md bg-primary text-white px-3 py-1.5 text-sm hover:bg-indigo-600 disabled:opacity-60" onClick={async()=>{
            if(!file) return; setError('')
            if(file.size > 100*1024*1024){ setError('File too large. Max allowed size is 100 MB.'); return }
            try{
              const res = await appendDatasetDataTop(dsId, file)
              if(res?.ok){ setToast('Validation passed. Change Request opened for approval.') } else { setError('Validation failed. Check schema & rules.') }
            }catch(e:any){ setError(e.message) }
          }}>Validate & open change</button>
          <button disabled={!file} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60" onClick={async()=>{
            if(!file) return; setError('')
            try{
              const pv = await previewAppend(projectId, dsId, file, 500, 0)
              setRows(pv.data || []); setCols(pv.columns || []); setOffset((pv.rows||0))
              setOpen(true)
            }catch(e:any){ setError(e.message || 'Preview failed') }
          }}>Preview full data</button>
        </div>
      </div>
      {preview && (
        <div className="border border-gray-200 bg-white rounded-md p-3">
          <div className="text-sm text-gray-700 mb-2">Current data preview ({preview.total_rows ?? preview.data.length} rows)</div>
          <div className="overflow-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-gray-50">{preview.columns.map(c=> <th key={c} className="text-left px-3 py-2 border-b border-gray-200">{c}</th>)}</tr>
              </thead>
              <tbody>
                {preview.data.map((r,i)=> (
                  <tr key={i} className={i%2? 'bg-white':'bg-gray-50'}>
                    {preview.columns.map(c=> <td key={c} className="px-3 py-2 border-b border-gray-100">{String(r[c] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <AgGridDialog
        open={open}
        onOpenChange={setOpen}
        title={`Append preview: ${file?.name || ''}`}
        rows={rows}
        columns={cols}
        pageSize={100}
        allowEdit
        onFetchMore={async()=>{
          if(!file) return []
          try{
            const pv = await previewAppend(projectId, dsId, file, 500, offset)
            setOffset(offset + (pv.rows || (pv.data?.length || 0)))
            return pv.data || []
          }catch{ return [] }
        }}
        onSave={async(updated)=>{
          try{
            const r = await appendEditedJSON(projectId, dsId, updated, file?.name?.replace(/\.[^.]+$/, '') + '.json')
            setToast('Saved as change request #' + (r?.change_request?.id || ''))
            setOpen(false)
          }catch(e:any){ setError(e.message || 'Save failed') }
        }}
      />
    </div>
  )
}

