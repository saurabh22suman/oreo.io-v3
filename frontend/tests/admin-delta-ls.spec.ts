import { test, expect } from '@playwright/test'

// Scenario: register user, create project & dataset with delta backend, append JSON rows, approve change, then
// use admin command line to run `delta ls` and verify the dataset's delta table folder appears (delta_table type).

test.describe('Admin delta ls lists newly created delta table', () => {
  // Admin password defaults for test environment; Playwright provides process normally,
  // but fall back safely if types not present.
  // Avoid direct process reference for TS compile in browser-like context; derive from env via globalThis if present.
  const adminPassword: string = (globalThis as any)?.ADMIN_PASSWORD || 'admin123'

  async function registerAndLogin(page: any, email: string, password: string){
    await page.goto('/register')
    await page.getByPlaceholder('Full name').fill('Delta User')
    await page.getByPlaceholder('Email').fill(email)
    await page.getByPlaceholder('Password', { exact: true }).fill(password)
    await page.getByPlaceholder('Confirm password', { exact: true }).fill(password)
    await page.getByRole('button', { name: /create account/i }).click()
    await page.goto('/login')
    const loginForm = page.locator('form').filter({ hasText: 'Welcome back' })
    await loginForm.getByPlaceholder('Email').fill(email)
    await loginForm.getByPlaceholder('Password', { exact: true }).fill(password)
    await loginForm.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page.getByText(email)).toBeVisible({ timeout: 5000 })
  }

  test('delta ls shows dataset folder', async ({ page }) => {
    const ts = Date.now()
    const email = `delta_${ts}@example.com`
    const password = 'Secret123!'

    // Register & login
    await registerAndLogin(page, email, password)

    // Create project
    await page.goto('/projects')
    await page.getByRole('button', { name: /\+\s*create project/i }).click()
    const projModal = page.locator('.card').filter({ hasText: 'Create Project' })
    const projName = `DeltaProj_${ts}`
    await projModal.getByRole('textbox').first().fill(projName)
  await page.getByRole('button', { name: /^create$/i }).click()
  // Wait for the newly created project row to appear before clicking
  const projRow = page.locator('tr.row-clickable', { hasText: projName }).first()
  await expect(projRow).toBeVisible({ timeout: 20000 })
  await projRow.click()
    const pm = page.url().match(/projects\/(\d+)/)
    const projectId = pm ? Number(pm[1]) : 1

    // Create dataset (delta backend already default). Use API for speed.
    const dsName = `DeltaDS_${ts}`
    const created = await page.evaluate(async (args) => {
      const r = await fetch(`/api/projects/${args.projectId}/datasets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name: args.dsName })
      }); const j = await r.json(); return { ok: r.ok, id: j.id || j.ID }
    }, { projectId, dsName })
    expect(created.ok).toBeTruthy()
    const datasetId = Number(created.id)

    // Append edited JSON rows via validate/open -> approve (single-user self-review path)
    const rows = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
    const vres = await page.evaluate(async (args) => {
      const r = await fetch(`/api/datasets/${args.datasetId}/data/append/json/validate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ rows: args.rows, filename: 'init.json' })
      }); return r.json()
    }, { datasetId, rows })
    expect(vres.ok).toBeTruthy()
    const open = await page.evaluate(async (args) => {
      const r = await fetch(`/api/datasets/${args.datasetId}/data/append/open`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ upload_id: args.uploadId, reviewer_id: args.reviewerId, title: 'Initial load' })
      }); const j = await r.json(); return { ok: r.ok, body: j }
    }, { datasetId, uploadId: Number(vres.upload_id), reviewerId: 0 })
    expect(open.ok).toBeTruthy()
    const changeId = Number(open.body?.change_request?.id || open.body?.change_request?.ID)
    expect(changeId).toBeTruthy()

    // Approve (self-approved since no reviewer_id set)
    const aprov = await page.evaluate(async (args) => {
      const r = await fetch(`/api/projects/${args.projectId}/changes/${args.changeId}/approve`, { method: 'POST', credentials: 'include' });
      return r.ok
    }, { projectId, changeId })
    expect(aprov).toBeTruthy()

    // Navigate to admin_base
    await page.goto('/admin_base')
    await page.getByPlaceholder('admin123').fill(adminPassword)
    await page.getByText('Users').waitFor({ state: 'visible' })

    // Run delta ls command (base path). Retry until a delta_table appears.
    let saw = false
    for(let i=0;i<12;i++){
      await page.getByPlaceholder('delta ls [path]').fill('delta ls')
      await page.getByRole('button', { name: 'Run' }).click()
      await page.waitForTimeout(1000)
      const out = await page.locator('pre').innerText().catch(()=> '')
      if(/delta_table/.test(out)) { saw = true; break }
    }
    expect(saw).toBeTruthy()
  })
})