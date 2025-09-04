import { PropsWithChildren } from 'react'
import Navbar from './Navbar'
import Footer from './Footer'
import UserContext from '../context/UserContext'

// Forces a logged-out (anonymous) view for any children
function ForcedAnonProvider({ children }: PropsWithChildren) {
  const value = { user: null, refresh: async () => {}, ready: true }
  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

export default function DocsLayout({ children }: PropsWithChildren){
  return (
    <ForcedAnonProvider>
      <div className="min-h-screen flex flex-col bg-white">
        <Navbar/>
        <main className="main flex-1 p-6 lg:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
        <Footer/>
      </div>
    </ForcedAnonProvider>
  )
}
