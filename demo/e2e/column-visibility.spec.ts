import { test, expect } from '@playwright/test'
import { collectErrors, gotoTab } from './helpers'

test('column visibility checklist hides and re-shows a column', async ({ page }) => {
  const errors = collectErrors(page)
  await gotoTab(page, 'VirtualTable')

  const headerText = () => page.locator('.vvsk-table__header-cell').allInnerTexts()
  // `.allInnerTexts()` doesn't auto-wait like assertions do — give the table a render tick.
  await expect(page.locator('.vvsk-table__header-cell').first()).toBeVisible()
  const before = await headerText()
  expect(before.some((t) => t.includes('Email'))).toBe(true)

  const emailCheckbox = page.locator('.demo-sidebar__check', { hasText: 'Email' }).locator('input')
  await emailCheckbox.uncheck()

  const afterHide = await headerText()
  expect(afterHide.some((t) => t.includes('Email'))).toBe(false)

  await emailCheckbox.check()
  const afterShow = await headerText()
  expect(afterShow.some((t) => t.includes('Email'))).toBe(true)

  expect(errors).toEqual([])
})
