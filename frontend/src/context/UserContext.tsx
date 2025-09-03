import React, { createContext, useContext, useEffect, useState } from 'react'
import { currentUser } from '../api'

type User = { email?: string } | null

type UserContextValue = { user: User; refresh: () => Promise<void>; ready: boolean }

const UserContext = createContext<UserContextValue>({ user: null, refresh: async () => {}, ready: false })

export function UserProvider({ children }: { children: React.ReactNode }){
  const [user, setUser] = useState<User>(null)
  const [ready, setReady] = useState(false)

  async function refresh(){
    try{
      const u = await currentUser()
      setUser(u?.email ? { email: u.email } : null)
    }catch{ 
      setUser(null) 
    } finally {
      setReady(true)
    }
  }

  useEffect(()=>{ 
    // On first mount, determine auth status; "ready" prevents flicker on guarded routes
    refresh() 
  }, [])

  return <UserContext.Provider value={{ user, refresh, ready }}>{children}</UserContext.Provider>
}

export function useUser(){ return useContext(UserContext) }

export default UserContext
