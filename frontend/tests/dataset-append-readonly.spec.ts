import { test, expect } from '@playwright/test'

async function registerAndLogin(page, email: string, password = 'secret123!'){
  await page.goto('/register')
  await page.getByPlaceholder('Full name').fill('E2E User')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password', { exact: true }).fill(password)
  await page.getByRole('button', { name: /create account/i }).click()
  await page.goto('/login')
  const loginForm = page.locator('form').filter({ hasText: 'Welcome back' })
  await loginForm.getByPlaceholder('Email').fill(email)
  await loginForm.getByLabel('Password', { exact: true }).fill(password)
  await loginForm.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText(email)).toBeVisible({ timeout: 5000 })
}

// End-to-end: dataset create -> append (json validate/open) -> approve -> stats row_count updated
// Also verify query editor blocks non-SELECT queries client-side and server returns only-select error.
test('dataset append approval flow + query read-only', async ({ page }) => {
  const ts = Date.now()
  const email = `user_${ts}@example.com`
  await registerAndLogin(page, email)

  // Create project
  await page.goto('/projects')
  // Open create project modal (UI shows "+ Create Project" button)
  await page.getByRole('button', { name: /\+\s*create project/i }).click()
  const projName = `P_${ts}`
  // Modal input isn't label-associated; target the first visible textbox within the modal card
  const modal = page.locator('.card').filter({ hasText: 'Create Project' })
  await modal.getByRole('textbox').first().fill(projName)
  await page.getByRole('button', { name: /^create$/i }).click()
  // Click the newly created project row to navigate into it
  await page.locator('tr.row-clickable', { hasText: projName }).first().click()
  // Extract project id from URL
  const pm = page.url().match(/projects\/(\d+)/)
  let projectId = pm ? Number(pm[1]) : 1

  // Create dataset
  // Create dataset via browser fetch to share auth cookies
  const dsName = `DS_${ts}`
  const tableSlug = dsName.toLowerCase().replace(/[^a-z0-9_]+/g, '_')
  const created = await page.evaluate(async (args) => {
    const r = await fetch(`/api/projects/${args.projectId}/datasets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: args.dsName,
        dataset_name: args.dsName,
        schema: 'public',
        table: args.tableSlug,
        source: 's3',
        sourceConfig: { s3: { accessKeyId: 'x', secretAccessKey: 'y', region: 'us-east-1', bucket: 'dummy', path: 'data.csv' } },
        target: { type: 'table', dsn: `public.${args.tableSlug}` }
      })
    })
    const j = await r.json()
    return { ok: r.ok, id: j.id || j.ID }
  }, { projectId, dsName, tableSlug })
  expect(created.ok).toBeTruthy()
  const datasetId = Number(created.id)

  // Append JSON: validate first (top-level)
  const rows = [{ id: 1, name: 'Alice' }]
  const vres = await page.evaluate(async (args) => {
    const r = await fetch(`/api/datasets/${args.datasetId}/data/append/json/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ rows: args.rows, filename: 'edited.json' })
    })
    const j = await r.json()
    return { ok: r.ok, body: j }
  }, { datasetId, rows })
  expect(vres.ok).toBeTruthy()
  const { ok, upload_id } = vres.body
  expect(ok).toBeTruthy()
  expect(upload_id).toBeTruthy()

  // Open change assigning to self (user id 1 in dev often applies; backend validates membership)
  // Fetch current user id for reviewer assignment
  const me = await page.evaluate(async () => {
    const r = await fetch('/api/auth/me', { credentials: 'include' }); const j = await r.json(); return j
  })
  const ores = await page.evaluate(async (args) => {
    const r = await fetch(`/api/datasets/${args.datasetId}/data/append/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ upload_id: args.upload_id, reviewer_ids: [args.userId], title: 'Append data' })
    })
    const j = await r.json()
    return { ok: r.ok, body: j }
  }, { datasetId, upload_id, userId: Number((me?.id)|| (me?.ID) || 0) })
  expect(ores.ok).toBeTruthy()
  const oj = ores.body
  const changeId = oj?.change_request?.id || oj?.change_request?.ID
  expect(changeId).toBeTruthy()

  // Approve change via project changes route
  // projectId already known from API
  const aprov = await page.evaluate(async (args) => {
    const r = await fetch(`/api/projects/${args.projectId}/changes/${args.changeId}/approve`, { method: 'POST', credentials: 'include' })
    return r.ok
  }, { projectId, changeId })
  expect(aprov).toBeTruthy()

  // Stats should reflect row_count >= 1
  const sj = await page.evaluate(async (args) => {
    const r = await fetch(`/api/datasets/${args.datasetId}/stats`, { credentials: 'include' })
    const j = await r.json(); return j
  }, { datasetId })
  expect(Number(sj.row_count)).toBeGreaterThanOrEqual(1)

  // Query page read-only: client blocks non-SELECT
  await page.goto(`/projects/${projectId}/query`)
  await expect(page.getByText('Query Editor')).toBeVisible()
  // Wait for editor to be ready and Run enabled
  const runBtn = page.getByRole('button', { name: 'Run' })
  await expect(runBtn).toBeEnabled()
  // Replace SQL in Monaco editor with a non-SELECT and try running
  const editor = page.locator('.monaco-editor').first()
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.type('DELETE FROM some_table;')
  await runBtn.click()
  await expect(page.getByText('Modifications are not allowed. Use append flow.')).toBeVisible()

  // Server enforcement: API should also reject
  const badStatus = await page.evaluate(async (args) => {
    const r = await fetch('/api/query/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sql: 'DELETE FROM x', page: 1, limit: 10, project_id: args.projectId })
    })
    return r.status
  }, { projectId })
  expect(badStatus).toBe(403)
})
