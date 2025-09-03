import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react'

const CollapseContext = createContext<{ collapsed: boolean; setCollapsed: (v:boolean)=>void } | null>(null)

export function CollapseProvider({ children }: { children: ReactNode }){
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { const v = localStorage.getItem('layout.sidebar.collapsed'); return v === 'true' } catch { return false }
  })
  useEffect(() => { try { localStorage.setItem('layout.sidebar.collapsed', collapsed ? 'true' : 'false') } catch {} }, [collapsed])
  return <CollapseContext.Provider value={{ collapsed, setCollapsed }}>{children}</CollapseContext.Provider>
}

export function useCollapse(){
  const ctx = useContext(CollapseContext)
  if (!ctx) throw new Error('useCollapse must be used under CollapseProvider')
  return ctx
}

export default CollapseContext
