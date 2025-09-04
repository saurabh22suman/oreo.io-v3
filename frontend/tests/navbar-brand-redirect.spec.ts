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

test.describe('Navbar brand redirect', () => {
  test('brand click redirects to /landing when logged out', async ({ page }) => {
    // Start from a public page that shows the brand (login page)
    await page.goto('/login')
    // Click the brand link (logo/text)
    await page.getByRole('link', { name: /oreo\.io/i }).click()
    // RootRedirect should send us to /landing
    await expect(page).toHaveURL(/\/landing$/)
  })

  test('brand click redirects to /dashboard when logged in', async ({ page }) => {
    const ts = Date.now()
    const email = `brand_${ts}@example.com`
    await registerAndLogin(page, email)

    // Navigate away from dashboard to ensure click triggers redirect logic
    await page.goto('/projects')
    // Click brand
    await page.getByRole('link', { name: /oreo\.io/i }).click()
    // Should land on /dashboard via RootRedirect
    await expect(page).toHaveURL(/\/dashboard$/)
  })
})
