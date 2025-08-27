import { Route, Routes } from 'react-router-dom'
import AuthPage from './pages/AuthPage'
import ProjectsPage from './pages/ProjectsPage'
import DatasetsPage from './pages/DatasetsPage'
import Layout from './components/Layout'
import MembersPage from './pages/MembersPage'

export default function App(){
  return (
    <Layout>
      <Routes>
        <Route path="/auth" element={<AuthPage/>}/>
        <Route path="/projects/:id" element={<DatasetsPage/>}/>
  <Route path="/projects/:id/members" element={<MembersPage/>}/>
        <Route path="/" element={<ProjectsPage/>}/>
      </Routes>
    </Layout>
  )
}
