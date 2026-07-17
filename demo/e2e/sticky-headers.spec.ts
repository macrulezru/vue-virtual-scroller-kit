import { test, expect } from '@playwright/test'
import { collectErrors, gotoTab } from './helpers'

test('sticky group header overlay shows the current group and updates on scroll', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await gotoTab(page, 'GroupedVirtualList')

  // Off by default — no overlay yet.
  await expect(page.locator('.vvsk-grouped-sticky-header')).toHaveCount(0)

  await page.getByText('Sticky group headers (overlay)').click()
  const sticky = page.locator('.vvsk-grouped-sticky-header')
  await expect(sticky).toBeVisible()
  await expect(sticky).toContainText('North America')

  const viewport = page.locator('.demo-viewport')
  await viewport.hover()
  for (let i = 0; i < 15; i++) {
    await page.mouse.wheel(0, 1000)
  }

  // After scrolling well past the first group's ~100 items, the overlay should have
  // moved on to a later continent — not still showing the first group.
  await expect(sticky).not.toContainText('North America')

  expect(errors).toEqual([])
})
