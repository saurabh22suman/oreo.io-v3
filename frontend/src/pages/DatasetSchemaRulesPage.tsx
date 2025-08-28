import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getDatasetSchemaTop, setDatasetRulesTop, setDatasetSchemaTop, getProject } from '../api'

export default function DatasetSchemaRulesPage(){
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const [project, setProject] = useState<any>(null)
  const [schemaText, setSchemaText] = useState('')
  const [rulesText, setRulesText] = useState('[\n  { "type": "required", "columns": [] }\n]')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(()=>{ (async()=>{
    try{
      setProject(await getProject(projectId))
      const s = await getDatasetSchemaTop(dsId)
      if(s?.schema){ setSchemaText(typeof s.schema === 'string' ? s.schema : JSON.stringify(s.schema, null, 2)) }
    }catch(e:any){ setError(e.message) }
  })() }, [projectId, dsId])

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Schema & Rules</h2>
        <div className="flex gap-2 text-sm">
          <Link to={`/projects/${projectId}`} className="text-primary hover:underline">Back</Link>
          <Link to={`/projects/${projectId}/datasets/${dsId}/upload`} className="text-primary hover:underline">Next: Upload & Append</Link>
        </div>
      </div>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      {toast && <div className="text-sm text-green-700 mb-2">{toast}</div>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="border border-gray-200 bg-white rounded-md p-3">
          <div className="text-sm font-medium mb-2">JSON Schema</div>
          <textarea className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-xs" rows={18} value={schemaText} onChange={e=>setSchemaText(e.target.value)} />
          <div className="mt-2 flex gap-2">
            <button className="rounded-md bg-primary text-white px-3 py-1.5 text-sm hover:bg-indigo-600" onClick={async()=>{
              setError('')
              try{ const parsed = JSON.parse(schemaText); await setDatasetSchemaTop(dsId, parsed); setToast('Schema saved.') }catch(e:any){ setError(e.message || 'Invalid schema JSON') }
            }}>Save schema</button>
          </div>
        </div>
        <div className="border border-gray-200 bg-white rounded-md p-3">
          <div className="text-sm font-medium mb-2">Business Rules</div>
          <textarea className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-xs" rows={18} value={rulesText} onChange={e=>setRulesText(e.target.value)} />
          <div className="mt-2 flex gap-2">
            <button className="rounded-md bg-primary text-white px-3 py-1.5 text-sm hover:bg-indigo-600" onClick={async()=>{
              setError('')
              try{ const parsed = JSON.parse(rulesText || '[]'); await setDatasetRulesTop(dsId, parsed); setToast('Rules saved.') }catch(e:any){ setError(e.message || 'Invalid rules JSON') }
            }}>Save rules</button>
          </div>
        </div>
      </div>
    </div>
  )
}
