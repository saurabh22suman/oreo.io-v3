import { useEffect, useState } from 'react'
import { User, Settings, Monitor, Globe, Save, Loader2, Moon, Sun, Type, Clock, Hash, Code, Mail, Phone, Camera } from 'lucide-react'

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

  if(loading){ 
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    ) 
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-surface-1/80 backdrop-blur-xl border border-divider p-8 shadow-2xl shadow-black/5">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-xs font-bold border border-primary/20 text-primary shadow-sm">
                Configuration
              </span>
            </div>
            <h1 className="text-4xl font-bold mb-4 tracking-tight text-text font-display drop-shadow-sm">Settings</h1>
            <p className="text-text-secondary max-w-lg text-base leading-relaxed">
              Manage your account details, appearance preferences, and editor settings.
            </p>
          </div>
        </div>
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      </div>

      {err && (
        <div className="bg-danger/10 border border-danger/20 text-danger p-4 rounded-xl text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="w-2 h-2 rounded-full bg-danger animate-pulse"></div>
          {err}
        </div>
      )}
      {ok && (
        <div className="bg-success/10 border border-success/20 text-success p-4 rounded-xl text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
          {ok}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Account Settings */}
        <div className="bg-surface-1 rounded-2xl border border-divider p-8 shadow-xl shadow-black/5 h-full flex flex-col">
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-divider">
            <div className="p-3 rounded-xl bg-primary/10 text-primary shadow-inner">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text">Account Settings</h2>
              <p className="text-xs text-text-secondary font-medium">Personal information and contact details</p>
            </div>
          </div>
          
          <div className="space-y-6 flex-1">
            <div className="flex items-center gap-6">
              <div className="relative group">
                <img 
                  src={profile.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(profile.email||profile.name||'User')} 
                  alt="avatar" 
                  className="w-24 h-24 rounded-full border-4 border-surface-2 shadow-lg object-cover transition-transform group-hover:scale-105" 
                />
                <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center text-white cursor-pointer backdrop-blur-sm">
                  <Camera className="w-6 h-6" />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wider">Profile Picture URL</label>
                <input 
                  value={profile.avatar_url} 
                  onChange={e=>setProfile({...profile, avatar_url:e.target.value})} 
                  className="w-full px-4 py-2.5 bg-surface-2 border border-divider rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm" 
                  placeholder="https://..." 
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wider flex items-center gap-2">
                <User className="w-3.5 h-3.5" /> Full Name
              </label>
              <input 
                value={profile.name} 
                onChange={e=>setProfile({...profile, name:e.target.value})} 
                className="w-full px-4 py-2.5 bg-surface-2 border border-divider rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm" 
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wider flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" /> Email Address
              </label>
              <input 
                value={profile.email} 
                onChange={e=>setProfile({...profile, email:e.target.value})} 
                className="w-full px-4 py-2.5 bg-surface-2 border border-divider rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm" 
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wider flex items-center gap-2">
                <Phone className="w-3.5 h-3.5" /> Phone Number
              </label>
              <input 
                value={profile.phone} 
                onChange={e=>setProfile({...profile, phone:e.target.value})} 
                className="w-full px-4 py-2.5 bg-surface-2 border border-divider rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm" 
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-divider flex justify-end">
            <button 
              onClick={saveProfile} 
              disabled={saving}
              className="btn btn-primary flex items-center gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all px-6 py-2.5 rounded-xl"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-surface-1 rounded-2xl border border-divider p-8 shadow-xl shadow-black/5 h-full flex flex-col">
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-divider">
            <div className="p-3 rounded-xl bg-secondary/10 text-secondary shadow-inner">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text">Preferences</h2>
              <p className="text-xs text-text-secondary font-medium">Customize your experience</p>
            </div>
          </div>

          <div className="space-y-8 flex-1">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5" /> Theme
                </label>
                <div className="flex bg-surface-2 p-1.5 rounded-xl border border-divider shadow-inner">
                  <button 
                    onClick={()=>setPrefs({...prefs, theme:'light'})}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${prefs.theme==='light' ? 'bg-white text-primary shadow-sm' : 'text-text-secondary hover:text-text'}`}
                  >
                    <Sun className="w-3.5 h-3.5" /> Light
                  </button>
                  <button 
                    onClick={()=>setPrefs({...prefs, theme:'dark'})}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${prefs.theme==='dark' ? 'bg-slate-700 text-white shadow-sm' : 'text-text-secondary hover:text-text'}`}
                  >
                    <Moon className="w-3.5 h-3.5" /> Dark
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5" /> Density
                </label>
                <select 
                  value={prefs.density} 
                  onChange={e=>setPrefs({...prefs, density:e.target.value as any})} 
                  className="w-full px-4 py-2.5 bg-surface-2 border border-divider rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Language
                </label>
                <select 
                  value={prefs.language} 
                  onChange={e=>setPrefs({...prefs, language:e.target.value})} 
                  className="w-full px-4 py-2.5 bg-surface-2 border border-divider rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Timezone
                </label>
                <select 
                  value={prefs.timezone} 
                  onChange={e=>setPrefs({...prefs, timezone:e.target.value})} 
                  className="w-full px-4 py-2.5 bg-surface-2 border border-divider rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                >
                  <option value={Intl.DateTimeFormat().resolvedOptions().timeZone}>System Default</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">New York</option>
                  <option value="Europe/London">London</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                </select>
              </div>
            </div>

            <div className="pt-6 border-t border-divider">
              <h3 className="text-sm font-bold text-text mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Code className="w-4 h-4 text-primary" /> Editor Settings
              </h3>
              <div className="space-y-4 bg-surface-2/30 p-4 rounded-xl border border-divider">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-text-secondary">Default Language</label>
                  <select 
                    value={prefs.editor?.language} 
                    onChange={e=>setPrefs({...prefs, editor:{...prefs.editor, language:e.target.value as any}})} 
                    className="px-3 py-1.5 bg-surface-1 border border-divider rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                  >
                    <option value="sql">SQL</option>
                    <option value="python">Python</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-text-secondary">Autocomplete</label>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                    <input 
                      type="checkbox" 
                      checked={prefs.editor?.autocomplete} 
                      onChange={e=>setPrefs({...prefs, editor:{...prefs.editor, autocomplete:e.target.checked}})} 
                      className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 right-5 checked:border-primary"
                    />
                    <label className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${prefs.editor?.autocomplete ? 'bg-primary' : 'bg-surface-3'}`}></label>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-text-secondary">Line Numbers</label>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                    <input 
                      type="checkbox" 
                      checked={prefs.editor?.lineNumbers} 
                      onChange={e=>setPrefs({...prefs, editor:{...prefs.editor, lineNumbers:e.target.checked}})} 
                      className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 right-5 checked:border-primary"
                    />
                    <label className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${prefs.editor?.lineNumbers ? 'bg-primary' : 'bg-surface-3'}`}></label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-divider flex justify-end">
            <button 
              onClick={savePrefs} 
              disabled={saving}
              className="btn btn-primary flex items-center gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all px-6 py-2.5 rounded-xl"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
