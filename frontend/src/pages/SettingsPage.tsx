import { useEffect, useState } from 'react'
import Container from '../components/Container'
import PageHeader from '../components/PageHeader'

type Prefs = {
  theme?: 'light'|'dark'
  density?: 'compact'|'comfortable'
  fontScale?: number
  language?: string
  timezone?: string
  dateFormat?: string
  numberFormat?: string
  editor?: { language?: 'sql'|'python'; autocomplete?: boolean; historySize?: number; lineNumbers?: boolean; syntaxHighlight?: boolean }
}

async function fetchJSON(url: string, opts: RequestInit = {}){
  const r = await fetch(url, { credentials: 'include', headers: { 'Content-Type':'application/json' }, ...opts })
  if(!r.ok){ throw new Error(await r.text() || r.statusText) }
  return r.json()
}

export default function SettingsPage(){
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string|undefined>()
  const [ok, setOk] = useState<string|undefined>()

  const [profile, setProfile] = useState<any>({ name:'', email:'', phone:'', avatar_url:'' })
  const [prefs, setPrefs] = useState<Prefs>({ theme:'light', density:'comfortable', fontScale:100, language:'en', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, dateFormat:'YYYY-MM-DD', numberFormat:'1,234.56', editor:{ language:'sql', autocomplete:true, historySize:100, lineNumbers:true, syntaxHighlight:true } })

  useEffect(()=>{
    let mounted = true
    ;(async()=>{
      try{
        const [p, pr]: [any, Prefs] = await Promise.all([
          fetchJSON('/api/me/profile'),
          fetchJSON('/api/me/preferences').catch(()=>({}))
        ])
        if(!mounted) return
        setProfile({ name: p.name||'', email: p.email||'', phone: p.phone||'', avatar_url: p.avatar_url||'' })
        setPrefs(prev => ({ ...prev, ...(pr||{}) }))
        // apply theme on load
        document.documentElement.classList.toggle('dark', (pr?.theme||prevTheme()) === 'dark')
      }catch(e:any){ if(mounted) setErr(e?.message||'Failed to load settings') }
      finally{ if(mounted) setLoading(false) }
    })()
    return ()=>{ mounted=false }
  }, [])

  function prevTheme(){ return (localStorage.getItem('oreo.theme') as any) || 'light' }

  function applyTheme(theme: 'light'|'dark'){
    document.documentElement.classList.toggle('dark', theme==='dark')
    localStorage.setItem('oreo.theme', theme)
  }

  async function saveProfile(){
    setSaving(true); setErr(undefined); setOk(undefined)
    try{
      const body = { name: profile.name, email: profile.email, phone: profile.phone, avatar_url: profile.avatar_url }
      const p = await fetchJSON('/api/me/profile', { method:'PUT', body: JSON.stringify(body) })
      setProfile({ name: p.name||'', email: p.email||profile.email, phone: p.phone||'', avatar_url: p.avatar_url||'' })
      setOk('Profile updated')
    }catch(e:any){ setErr(e?.message||'Failed to save') }
    finally{ setSaving(false) }
  }

  async function savePrefs(){
    setSaving(true); setErr(undefined); setOk(undefined)
    try{
      const pr = await fetchJSON('/api/me/preferences', { method:'PUT', body: JSON.stringify(prefs) })
      setPrefs(pr)
      if(pr?.theme) applyTheme(pr.theme)
      setOk('Preferences saved')
    }catch(e:any){ setErr(e?.message||'Failed to save') }
    finally{ setSaving(false) }
  }

  if(loading){ return <div className="p-6">Loading settings...</div> }

  return (
        <Container>
          <PageHeader title="Settings" subtitle="Manage your account and preferences." />

          {err && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4 text-sm">{err}</div>}
          {ok && <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded mb-4 text-sm">{ok}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Account Settings */}
            <section className="bg-white rounded-xl p-4 border">
              <h2 className="text-lg font-semibold mb-3">Account Settings</h2>
              <div className="flex items-center gap-4 mb-4">
                <img src={profile.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(profile.email||profile.name||'User')} alt="avatar" className="w-16 h-16 rounded-full border" />
                <div className="flex-1">
                  <label className="block text-sm text-gray-600">Profile picture URL</label>
                  <input value={profile.avatar_url} onChange={e=>setProfile({...profile, avatar_url:e.target.value})} className="mt-1 w-full border rounded px-3 py-2" placeholder="https://..." />
                </div>
              </div>
              <label className="block text-sm text-gray-600">Name</label>
              <input value={profile.name} onChange={e=>setProfile({...profile, name:e.target.value})} className="mt-1 w-full border rounded px-3 py-2 mb-3" />
              <label className="block text-sm text-gray-600">Email (primary, editable with verification)</label>
              <input value={profile.email} onChange={e=>setProfile({...profile, email:e.target.value})} className="mt-1 w-full border rounded px-3 py-2 mb-3" />
              <div className="text-xs text-gray-500 mb-2">If you change your email, we’ll send a verification link to confirm.</div>
              <label className="block text-sm text-gray-600">Phone (optional)</label>
              <input value={profile.phone} onChange={e=>setProfile({...profile, phone:e.target.value})} className="mt-1 w-full border rounded px-3 py-2 mb-4" />
              <button disabled={saving} onClick={saveProfile} className="btn-primary px-4 py-2">Save Profile</button>
            </section>

            {/* Preferences */}
            <section className="bg-white rounded-xl p-4 border">
              <h2 className="text-lg font-semibold mb-3">Preferences</h2>
              {/* Theme & Appearance */}
              <div className="mb-4">
                <h3 className="font-medium mb-2">Theme & Appearance</h3>
                <div className="flex items-center gap-3 mb-2">
                  <label className="text-sm">Theme</label>
                  <select value={prefs.theme} onChange={e=>{ const v = e.target.value as 'light'|'dark'; setPrefs({...prefs, theme:v}); applyTheme(v)}} className="border rounded px-2 py-1">
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <label className="text-sm">Layout density</label>
                  <select value={prefs.density} onChange={e=>setPrefs({...prefs, density: e.target.value as any})} className="border rounded px-2 py-1">
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm">Font size</label>
                  <input type="number" min={80} max={140} value={prefs.fontScale||100} onChange={e=>setPrefs({...prefs, fontScale: Number(e.target.value)})} className="border rounded px-2 py-1 w-24" />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              </div>

              {/* Language & Locale */}
              <div className="mb-4">
                <h3 className="font-medium mb-2">Language & Locale</h3>
                <div className="flex items-center gap-3 mb-2">
                  <label className="text-sm">Language</label>
                  <select value={prefs.language} onChange={e=>setPrefs({...prefs, language: e.target.value})} className="border rounded px-2 py-1">
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                  </select>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <label className="text-sm">Timezone</label>
                  <input value={prefs.timezone||''} onChange={e=>setPrefs({...prefs, timezone:e.target.value})} className="border rounded px-2 py-1" />
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <label className="text-sm">Date format</label>
                  <input value={prefs.dateFormat||''} onChange={e=>setPrefs({...prefs, dateFormat:e.target.value})} className="border rounded px-2 py-1" />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm">Number format</label>
                  <input value={prefs.numberFormat||''} onChange={e=>setPrefs({...prefs, numberFormat:e.target.value})} className="border rounded px-2 py-1" />
                </div>
              </div>

              {/* Query Editor */}
              <div>
                <h3 className="font-medium mb-2">Query Editor</h3>
                <div className="flex items-center gap-3 mb-2">
                  <label className="text-sm">Default language</label>
                  <select value={prefs.editor?.language||'sql'} onChange={e=>setPrefs({...prefs, editor:{ ...(prefs.editor||{}), language: e.target.value as any }})} className="border rounded px-2 py-1">
                    <option value="sql">SQL</option>
                    <option value="python">Python</option>
                  </select>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <label className="text-sm">Autocomplete</label>
                  <input type="checkbox" checked={!!prefs.editor?.autocomplete} onChange={e=>setPrefs({...prefs, editor:{ ...(prefs.editor||{}), autocomplete: e.target.checked }})} />
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <label className="text-sm">History size</label>
                  <input type="number" min={0} max={1000} value={prefs.editor?.historySize||100} onChange={e=>setPrefs({...prefs, editor:{ ...(prefs.editor||{}), historySize: Number(e.target.value) }})} className="border rounded px-2 py-1 w-24" />
                </div>
                <div className="flex items-center gap-4">
                  <label className="text-sm">Line numbers</label>
                  <input type="checkbox" checked={!!prefs.editor?.lineNumbers} onChange={e=>setPrefs({...prefs, editor:{ ...(prefs.editor||{}), lineNumbers: e.target.checked }})} />
                  <label className="text-sm">Syntax highlighting</label>
                  <input type="checkbox" checked={!!prefs.editor?.syntaxHighlight} onChange={e=>setPrefs({...prefs, editor:{ ...(prefs.editor||{}), syntaxHighlight: e.target.checked }})} />
                </div>
              </div>

              <div className="mt-4">
                <button disabled={saving} onClick={savePrefs} className="btn-primary px-4 py-2">Save Preferences</button>
              </div>
            </section>
          </div>
  </Container>
  )
}
