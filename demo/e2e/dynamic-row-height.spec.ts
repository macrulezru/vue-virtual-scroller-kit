import { test, expect } from '@playwright/test'
import { collectErrors, gotoTab } from './helpers'

test('VirtualGrid dynamicRowHeight measures cells of different natural heights', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await gotoTab(page, 'VirtualGrid')

  await page.getByText('Dynamic row height (measured per row)').click()
  await page.waitForTimeout(200)

  const rows = page.locator('[data-virtual-row-index]')
  const count = await rows.count()
  expect(count).toBeGreaterThan(1)

  const heights = new Set<number>()
  for (let i = 0; i < Math.min(count, 15); i++) {
    const box = await rows.nth(i).boundingBox()
    if (box) heights.add(Math.round(box.height))
  }
  // With aspect-varied cell content, rows should not all collapse to one identical height.
  expect(heights.size).toBeGreaterThan(1)

  expect(errors).toEqual([])
})
