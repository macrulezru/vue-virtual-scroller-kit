import { test, expect } from '@playwright/test'
import { collectErrors, gotoTab } from './helpers'

test('checkbox row selection: click, shift-range, clear', async ({ page }) => {
  const errors = collectErrors(page)
  await gotoTab(page, 'VirtualTable')

  await page.getByText('Selectable rows (checkbox,').click()
  const checkboxes = page.locator('.vvsk-table__cell input[type="checkbox"]')
  await expect(checkboxes.first()).toBeVisible()

  // Click row 0 and row 3 → 2 selected.
  await checkboxes.nth(0).click()
  await checkboxes.nth(3).click()
  await expect(page.locator('.demo-stat', { hasText: 'Selected' })).toContainText('2')

  // Shift-click row 6 → fills the range from the last-toggled (3) to 6, on top of row 0.
  await checkboxes.nth(6).click({ modifiers: ['Shift'] })
  await expect(page.locator('.demo-stat', { hasText: 'Selected' })).toContainText('5') // 0,3,4,5,6

  // Clear button resets to 0.
  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(page.locator('.demo-stat', { hasText: 'Selected' })).toContainText('0')
  for (let i = 0; i < 4; i++) {
    await expect(checkboxes.nth(i)).not.toBeChecked()
  }

  expect(errors).toEqual([])
})
