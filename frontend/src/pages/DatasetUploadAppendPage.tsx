import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { appendDatasetDataTop, getDatasetDataTop, getProject, previewAppend, appendEditedJSON, inferSchemaFromFile, setDatasetSchemaTop, setDatasetRulesTop, myProjectRole, getDataset, listMembers, openAppendChangeTop, validateEditedJSONTop } from '../api'
import AgGridDialog from '../components/AgGridDialog'
import Alert from '../components/Alert'
import ManageSchemaDialog from '../components/ManageSchemaDialog'

export default function DatasetUploadAppendPage(){
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const [project, setProject] = useState<any>(null)
  const [file, setFile] = useState<File|null>(null)
  const [preview, setPreview] = useState<{data:any[]; columns:string[]; total_rows?:number}|null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [isOwner, setIsOwner] = useState(false)
  // modal state for full data preview/edit when appending
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<any[]>([])
  const [cols, setCols] = useState<string[]>([])
  const [offset, setOffset] = useState(0)
  const [schemaOpen, setSchemaOpen] = useState(false)
  const [schemaInitial, setSchemaInitial] = useState<any>(null)
  const [rulesInitial, setRulesInitial] = useState<any>([])
  const [dialogSample, setDialogSample] = useState<{ data: any[]; columns: string[] }|undefined>(undefined)
  const [members, setMembers] = useState<{id:number; email:string; role:string}[]>([])
  const [reviewerDialog, setReviewerDialog] = useState(false)
  const [selectedReviewer, setSelectedReviewer] = useState<number|undefined>(undefined)
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<number[]>([])
  const [pendingEditedRows, setPendingEditedRows] = useState<any[]|null>(null)
  const [pendingEditedFilename, setPendingEditedFilename] = useState<string>('edited.json')
  const [pendingUploadId, setPendingUploadId] = useState<number|undefined>(undefined)

  useEffect(()=>{ (async()=>{
    try{ 
      setProject(await getProject(projectId)); 
      const me = await myProjectRole(projectId).catch(()=>({role:null as any}))
      setIsOwner(me?.role === 'owner')
  const s = await getDatasetDataTop(dsId, 50, 0); setPreview({ data: s.data||[], columns: s.columns||[], total_rows: s.total_rows }) 
      // Load existing dataset schema/rules for initialization
      const ds = await getDataset(projectId, dsId).catch(()=>null)
      if(ds){
        setSchemaInitial(ds?.schema || null)
        setRulesInitial(ds?.rules ? (typeof ds.rules === 'string'? ds.rules : JSON.stringify(ds.rules, null, 2)) : '[]')
      }
  const membersList = await listMembers(projectId).catch(()=>[])
  setMembers(membersList as any[])
    }catch(e:any){ /* ignore missing */ }
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
  {error && <Alert type="error" message={error} onClose={()=>setError('')} />}
  {toast && <Alert type="success" message={toast} onClose={()=>setToast('')} />}
      <div className="border border-gray-200 bg-white rounded-md p-3 mb-3">
        <div className="flex items-center gap-2">
          <input id="file-up" type="file" className="hidden" accept=".csv,.xlsx,.xls,.json" onChange={e=> setFile(e.target.files?.[0] || null)} />
          <label htmlFor="file-up" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">Choose file</label>
          <span className="text-xs text-gray-600 max-w-[16rem] truncate">{file? file.name : 'No file selected'}</span>
          {isOwner && (
            <button disabled={!file} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60" onClick={async()=>{
              if(!file) return; setError('')
              try{
                // Infer schema from file and open dialog
                const inf = await inferSchemaFromFile(file)
                const schema = inf?.schema || {}
                setSchemaInitial(schema)
                // Pull a single-row sample from the selected file for display
                try{
                  const samp = await previewAppend(projectId, dsId, file, 1, 0)
                  setDialogSample({ data: samp?.data || [], columns: samp?.columns || [] })
                }catch{ setDialogSample(undefined) }
                setSchemaOpen(true)
              }catch(e:any){ setError(e.message || 'Inference failed') }
            }}>Manage schema</button>
          )}
          <button disabled={!file} className="rounded-md bg-primary text-white px-3 py-1.5 text-sm hover:bg-indigo-600 disabled:opacity-60" onClick={async()=>{
            if(!file) return
            setError('')
            try{
              // Validate first to get an upload reference
              const res = await appendDatasetDataTop(dsId, file)
              if(!res?.ok || !res.upload_id){ setError('Validation failed. Check schema & rules.'); return }
              setPendingUploadId(res.upload_id)
              setReviewerDialog(true)
            }catch(e:any){ setError(e.message || 'Validation failed') }
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
  compact
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
      const fname = (file?.name?.replace(/\.[^.]+$/, '') || 'edited') + '.json'
      // Validate edited rows first to get an upload_id, then open change with selected reviewers
      setPendingEditedRows(updated)
      setPendingEditedFilename(fname)
      setReviewerDialog(true)
          }catch(e:any){ setError(e.message || 'Save failed') }
        }}
      />

      {reviewerDialog && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-md p-4 w-[420px] shadow">
            <div className="text-sm font-medium mb-2">Select reviewer(s)</div>
            <select multiple className="w-full border border-gray-300 rounded px-3 py-2 h-28" value={selectedReviewerIds.map(String)} onChange={e=> setSelectedReviewerIds(Array.from(e.target.selectedOptions).map(o=> Number(o.value)).filter(Boolean))}>
              {members.map(a=> <option key={a.id} value={a.id}>{a.email}</option>)}
            </select>
            <div className="flex gap-2 mt-3 justify-end">
              <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" onClick={()=> { setReviewerDialog(false); setPendingEditedRows(null) }}>Cancel</button>
              <button disabled={(selectedReviewerIds.length===0) || (!pendingEditedRows && !pendingUploadId)} className="rounded-md bg-primary text-white px-3 py-1.5 text-sm hover:bg-indigo-600 disabled:opacity-60" onClick={async()=>{
                if(selectedReviewerIds.length===0) return
                setReviewerDialog(false)
                setError('')
                try{
                  if(pendingEditedRows){
                    // validate edited JSON to store as an upload, then open change with selected reviewers
                    const v = await validateEditedJSONTop(dsId, pendingEditedRows, pendingEditedFilename)
                    if(!v?.ok || !v?.upload_id){ setError('Validation failed'); return }
                    const res = await openAppendChangeTop(dsId, v.upload_id, selectedReviewerIds)
                    if(res?.ok){ setToast('Change Request opened for approval.'); setOpen(false); setPendingEditedRows(null); setSelectedReviewerIds([]) } else { setError('Failed to open change.') }
                  } else if(pendingUploadId){
                    const res = await openAppendChangeTop(dsId, pendingUploadId, selectedReviewerIds)
                    if(res?.ok){
                      setToast('Change Request opened for approval.')
                      setFile(null)
                      setSelectedReviewer(undefined); setSelectedReviewerIds([])
                      setPendingUploadId(undefined)
                    } else {
                      setError('Failed to open change.')
                    }
                  }
                }catch(e:any){ setError(e.message) }
              }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
      <ManageSchemaDialog
        open={schemaOpen}
        onOpenChange={setSchemaOpen}
        file={file || undefined}
        initialSchema={schemaInitial}
        initialRules={rulesInitial}
        sample={dialogSample}
        onSave={async(schema, rules)=>{
          setError('')
          await setDatasetSchemaTop(dsId, schema)
          await setDatasetRulesTop(dsId, rules)
          setToast('Schema and rules saved')
        }}
      />
    </div>
  )
}

