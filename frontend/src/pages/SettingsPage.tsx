import { useEffect, useState } from 'react'
import { User, Settings, Monitor, Globe, Save, Loader2, Moon, Sun, Clock, Code, Mail, Phone } from 'lucide-react'

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

  if(loading){ 
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    ) 
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Settings</h1>
        <p className="text-sm text-text-muted mt-1">Manage your account and preferences</p>
      </div>

      {err && (
        <div className="bg-danger/10 border border-danger/20 text-danger p-3 rounded-lg text-sm">
          {err}
        </div>
      )}
      {ok && (
        <div className="bg-success/10 border border-success/20 text-success p-3 rounded-lg text-sm">
          {ok}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Account Settings */}
        <div className="bg-surface-2 border border-divider rounded-card">
          <div className="px-4 py-3 border-b border-divider flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-primary/10">
              <User size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="font-medium text-text-primary text-sm">Account</h2>
              <p className="text-xs text-text-muted">Personal information</p>
            </div>
          </div>
          
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-4">
              <img 
                src={profile.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(profile.email||profile.name||'User')} 
                alt="avatar" 
                className="w-14 h-14 rounded-full border-2 border-divider object-cover" 
              />
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-1">Avatar URL</label>
                <input 
                  value={profile.avatar_url} 
                  onChange={e=>setProfile({...profile, avatar_url:e.target.value})} 
                  className="input w-full text-sm" 
                  placeholder="https://..." 
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1 flex items-center gap-1">
                <User size={12} /> Name
              </label>
              <input 
                value={profile.name} 
                onChange={e=>setProfile({...profile, name:e.target.value})} 
                className="input w-full" 
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1 flex items-center gap-1">
                <Mail size={12} /> Email
              </label>
              <input 
                value={profile.email} 
                onChange={e=>setProfile({...profile, email:e.target.value})} 
                className="input w-full" 
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1 flex items-center gap-1">
                <Phone size={12} /> Phone
              </label>
              <input 
                value={profile.phone} 
                onChange={e=>setProfile({...profile, phone:e.target.value})} 
                className="input w-full" 
                placeholder="+1 (555) 000-0000"
              />
            </div>

            <div className="pt-3 border-t border-divider flex justify-end">
              <button 
                onClick={saveProfile} 
                disabled={saving}
                className="btn btn-primary text-sm flex items-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-surface-2 border border-divider rounded-card">
          <div className="px-4 py-3 border-b border-divider flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-secondary/10">
              <Settings size={16} className="text-secondary" />
            </div>
            <div>
              <h2 className="font-medium text-text-primary text-sm">Preferences</h2>
              <p className="text-xs text-text-muted">Customize your experience</p>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-muted mb-1 flex items-center gap-1">
                  <Monitor size={12} /> Theme
                </label>
                <div className="flex bg-surface-3 p-0.5 rounded-md border border-divider">
                  <button 
                    onClick={()=>setPrefs({...prefs, theme:'light'})}
                    className={`flex-1 py-1.5 text-xs rounded flex items-center justify-center gap-1 transition-colors ${prefs.theme==='light' ? 'bg-surface-1 text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                  >
                    <Sun size={12} /> Light
                  </button>
                  <button 
                    onClick={()=>setPrefs({...prefs, theme:'dark'})}
                    className={`flex-1 py-1.5 text-xs rounded flex items-center justify-center gap-1 transition-colors ${prefs.theme==='dark' ? 'bg-surface-1 text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                  >
                    <Moon size={12} /> Dark
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">Density</label>
                <select 
                  value={prefs.density} 
                  onChange={e=>setPrefs({...prefs, density:e.target.value as any})} 
                  className="input w-full"
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-muted mb-1 flex items-center gap-1">
                  <Globe size={12} /> Language
                </label>
                <select 
                  value={prefs.language} 
                  onChange={e=>setPrefs({...prefs, language:e.target.value})} 
                  className="input w-full"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1 flex items-center gap-1">
                  <Clock size={12} /> Timezone
                </label>
                <select 
                  value={prefs.timezone} 
                  onChange={e=>setPrefs({...prefs, timezone:e.target.value})} 
                  className="input w-full"
                >
                  <option value={Intl.DateTimeFormat().resolvedOptions().timeZone}>System Default</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">New York</option>
                  <option value="Europe/London">London</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                </select>
              </div>
            </div>

            {/* Editor Settings */}
            <div className="pt-3 border-t border-divider">
              <h3 className="text-xs font-medium text-text-primary mb-3 flex items-center gap-1.5">
                <Code size={12} className="text-primary" /> Editor
              </h3>
              <div className="space-y-3 bg-surface-3 p-3 rounded-lg border border-divider">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-text-secondary">Default Language</label>
                  <select 
                    value={prefs.editor?.language} 
                    onChange={e=>setPrefs({...prefs, editor:{...prefs.editor, language:e.target.value as any}})} 
                    className="px-2 py-1 bg-surface-1 border border-divider rounded text-xs"
                  >
                    <option value="sql">SQL</option>
                    <option value="python">Python</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-text-secondary">Autocomplete</label>
                  <input 
                    type="checkbox" 
                    checked={prefs.editor?.autocomplete} 
                    onChange={e=>setPrefs({...prefs, editor:{...prefs.editor, autocomplete:e.target.checked}})} 
                    className="w-4 h-4 rounded border-divider bg-surface-1 text-primary focus:ring-primary/30"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-text-secondary">Line Numbers</label>
                  <input 
                    type="checkbox" 
                    checked={prefs.editor?.lineNumbers} 
                    onChange={e=>setPrefs({...prefs, editor:{...prefs.editor, lineNumbers:e.target.checked}})} 
                    className="w-4 h-4 rounded border-divider bg-surface-1 text-primary focus:ring-primary/30"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-divider flex justify-end">
              <button 
                onClick={savePrefs} 
                disabled={saving}
                className="btn btn-primary text-sm flex items-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
