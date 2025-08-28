import { Route, Routes } from 'react-router-dom'
import AuthPage from './pages/AuthPage'
import ProjectsPage from './pages/ProjectsPage'
import DatasetsPage from './pages/DatasetsPage'
import DatasetDetailsPage from './pages/DatasetDetailsPage'
import Layout from './components/Layout'
import MembersPage from './pages/MembersPage'
import DatasetCreatePage from './pages/DatasetCreatePage'
import DatasetSchemaRulesPage from './pages/DatasetSchemaRulesPage'
import DatasetUploadAppendPage from './pages/DatasetUploadAppendPage'
import DatasetApprovalsPage from './pages/DatasetApprovalsPage'
import DatasetViewerPage from './pages/DatasetViewerPage'
import ChangeDetailsPage from './pages/ChangeDetailsPage'
import AdminBasePage from './pages/AdminBasePage'

export default function App(){
  return (
    <Layout>
      <Routes>
        <Route path="/auth" element={<AuthPage/>}/>
  <Route path="/admin_base" element={<AdminBasePage/>}/>
        <Route path="/projects/:id" element={<DatasetsPage/>}/>
  <Route path="/projects/:id/datasets/:datasetId" element={<DatasetDetailsPage/>}/>
  <Route path="/projects/:id/members" element={<MembersPage/>}/>
  <Route path="/projects/:id/datasets/new" element={<DatasetCreatePage/>}/>
  <Route path="/projects/:id/datasets/:datasetId/schema" element={<DatasetSchemaRulesPage/>}/>
  <Route path="/projects/:id/datasets/:datasetId/upload" element={<DatasetUploadAppendPage/>}/>
  <Route path="/projects/:id/datasets/:datasetId/approvals" element={<DatasetApprovalsPage/>}/>
  <Route path="/projects/:id/datasets/:datasetId/view" element={<DatasetViewerPage/>}/>
  <Route path="/projects/:id/datasets/:datasetId/changes/:changeId" element={<ChangeDetailsPage/>}/>
        <Route path="/" element={<ProjectsPage/>}/>
      </Routes>
    </Layout>
  )
}
