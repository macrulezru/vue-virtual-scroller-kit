import { test, expect } from '@playwright/test'
import { collectErrors, gotoTab } from './helpers'

test('VirtualList horizontal layout scrolls along scrollLeft and updates the visible range', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await gotoTab(page, 'VirtualList')
  await page.getByRole('button', { name: 'Horizontal', exact: true }).click()

  const list = page.locator('.vvsk-list')
  await expect(list.locator('.issue-card').first()).toBeVisible()

  const statsBefore = await page.locator('.demo-sidebar__stats').innerText()

  await list.evaluate((el) => {
    el.scrollLeft = 3000
  })
  await list.dispatchEvent('scroll')
  await page.waitForTimeout(100)

  const statsAfter = await page.locator('.demo-sidebar__stats').innerText()
  expect(statsAfter).not.toBe(statsBefore)

  // Horizontal mode must never touch scrollTop.
  const scrollTop = await list.evaluate((el) => el.scrollTop)
  expect(scrollTop).toBe(0)

  expect(errors).toEqual([])
})

test('VirtualList horizontal + RTL renders and scrolls cleanly together', async ({ page }) => {
  const errors = collectErrors(page)
  await gotoTab(page, 'VirtualList')
  await page.getByRole('button', { name: 'Horizontal', exact: true }).click()
  await page.getByRole('button', { name: /Direction:/ }).click()
  await expect(page.locator('.app-content')).toHaveAttribute('dir', 'rtl')

  const list = page.locator('.vvsk-list')
  await expect(list.locator('.issue-card').first()).toBeVisible()

  await list.evaluate((el) => {
    el.scrollLeft = -1000
  })
  await list.dispatchEvent('scroll')
  await page.waitForTimeout(100)

  await expect(list.locator('.issue-card').first()).toBeVisible()
  expect(errors).toEqual([])
})
