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

test.describe('Docs open in new tab and anonymous view', () => {
  test('logged-out: navbar Docs opens in new tab and shows anon UI', async ({ page, context }) => {
    await page.goto('/landing')

  // Find the hero CTA link "Read docs" (opens in new tab)
  const docsLink = page.getByRole('link', { name: /read docs/i })
    await expect(docsLink).toBeVisible()
    await expect(docsLink).toHaveAttribute('target', '_blank')

    // Clicking should open a new tab
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      docsLink.click()
    ])
    await newPage.waitForLoadState('domcontentloaded')
    await expect(newPage).toHaveURL(/\/docs$/)

    // Docs page should render as logged-out (no user menu, shows Log in)
    await expect(newPage.getByRole('link', { name: /log in/i })).toBeVisible()
    await expect(newPage.getByRole('button', { name: /logout/i })).toHaveCount(0)
  })

  test('logged-in: docs still renders as logged-out (forced anon)', async ({ page, context }) => {
    const email = `docs_${Date.now()}@example.com`
    await registerAndLogin(page, email)

  // While logged in, the Sidebar contains a Docs link that opens in a new tab
  await page.goto('/dashboard')
  const docsLink = page.locator('aside a[target="_blank"][href*="/docs"]').first()
  await expect(docsLink).toBeVisible()
    await expect(docsLink).toHaveAttribute('target', '_blank')

    // Clicking should open new tab as well
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      docsLink.click()
    ])
    await newPage.waitForLoadState('domcontentloaded')
    await expect(newPage).toHaveURL(/\/docs$/)

    // Navigate directly to /docs; the page should still appear logged-out due to DocsLayout
    await page.goto('/docs')
    await expect(page).toHaveURL(/\/docs$/)
    await expect(page.getByRole('link', { name: /log in/i })).toBeVisible()
    await expect(page.getByText(email)).toHaveCount(0)
  })
})
