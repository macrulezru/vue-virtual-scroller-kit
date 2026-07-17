import { test, expect } from '@playwright/test'
import { collectErrors, gotoTab } from './helpers'

test('smooth scrollTo reaches the target row instead of stopping partway', async ({ page }) => {
  const errors = collectErrors(page)
  await gotoTab(page, 'VirtualList')

  await page.getByText("Smooth scroll (native", { exact: false }).click()
  await page.locator('input[type="number"]').fill('50000')
  await page.getByRole('button', { name: 'Go' }).click()

  // Native smooth-scroll over a multi-million-pixel distance can take a couple of
  // seconds — longer under a fully-parallel test run competing for CPU — so poll with a
  // generous timeout rather than a single fixed wait. The target offset is computed from
  // *estimated* row heights, and these rows have variable actual heights, so landing
  // within a few thousand rows of the target (not stuck ~45000 rows short at row
  // ~1000-3000, which is the actual bug this guards against) counts as success.
  await expect(async () => {
    const text = await page.locator('.demo-sidebar__stats').innerText()
    // `.innerText` inserts newlines at block/inline-element boundaries, so allow any
    // whitespace between tokens rather than assuming a literal single space.
    const match = /Visible\s+\d+\s+\((\d+)\D+(\d+)\)/.exec(text)
    expect(match).not.toBeNull()
    const [, , end] = match!
    expect(Number(end)).toBeGreaterThan(45000)
  }).toPass({ timeout: 15000 })

  expect(errors).toEqual([])
})
