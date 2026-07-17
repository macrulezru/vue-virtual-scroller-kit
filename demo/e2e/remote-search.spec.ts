import { test, expect } from '@playwright/test'
import { collectErrors, gotoTab } from './helpers'

test('VirtualSelect remote search: debounces, shows loading, then results', async ({ page }) => {
  const errors = collectErrors(page)
  await gotoTab(page, 'VirtualSelect')

  const section = page.locator('.demo-section', { hasText: 'Remote search' })
  await section.locator('.vvsk-select__trigger').click()

  // Initial "first page" (20 options) — the dropdown is itself virtualized, so only a
  // handful render in the DOM at once; just confirm some are visible.
  await expect(page.locator('.vvsk-select__option').first()).toBeVisible()

  await page.locator('.vvsk-select__search').fill('Country 1')

  // Debounced 300ms, then a simulated 500ms "network" delay — the loading state should
  // appear before results arrive, not flash "No options" in between.
  await expect(page.locator('.vvsk-select__loading')).toBeVisible({ timeout: 1000 })
  await expect(page.locator('.vvsk-select__empty')).toHaveCount(0)

  await expect(page.locator('.vvsk-select__loading')).toBeHidden({ timeout: 2000 })
  const results = page.locator('.vvsk-select__option')
  await expect(results.first()).toBeVisible()
  const count = await results.count()
  expect(count).toBeGreaterThan(0)
  await expect(results.first()).toContainText('Country 1')

  expect(errors).toEqual([])
})
