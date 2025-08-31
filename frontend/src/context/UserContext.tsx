import React, { createContext, useContext, useEffect, useState } from 'react'
import { currentUser } from '../api'

type User = { email?: string } | null

const UserContext = createContext<{ user: User; refresh: () => Promise<void> }>({ user: null, refresh: async () => {} })

export function UserProvider({ children }: { children: React.ReactNode }){
  const [user, setUser] = useState<User>(null)

  async function refresh(){
    try{
      const u = await currentUser()
      setUser({ email: u?.email })
    }catch{ setUser(null) }
  }

  useEffect(()=>{ refresh() }, [])

  return <UserContext.Provider value={{ user, refresh }}>{children}</UserContext.Provider>
}

export function useUser(){ return useContext(UserContext) }

export default UserContext
