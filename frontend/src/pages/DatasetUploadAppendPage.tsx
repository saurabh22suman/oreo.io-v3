import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { appendDatasetDataTop, getDatasetDataTop, getProject, previewAppend, appendEditedJSON, inferSchemaFromFile, setDatasetSchemaTop, setDatasetRulesTop, myProjectRole, getDataset, listMembers, openAppendChangeTop, validateEditedJSONTop } from '../api'
import AgGridDialog from '../components/AgGridDialog'
import Alert from '../components/Alert'
import ManageSchemaDialog from '../components/ManageSchemaDialog'

export default function DatasetUploadAppendPage(){
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Deprecated: Upload & Append</h1>
      <p className="mt-2 text-sm text-gray-600">
        This legacy page has been replaced by the new Append Flow.
        Go to the Dataset details and click "Open append flow".
      </p>
    </div>
  )
}

