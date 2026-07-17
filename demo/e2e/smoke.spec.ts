import { test, expect } from '@playwright/test'
import { TABS, collectErrors, gotoTab } from './helpers'

test.describe('demo smoke: every tab loads without console errors', () => {
  for (const tab of TABS) {
    test(`${tab} tab loads cleanly`, async ({ page }) => {
      const errors = collectErrors(page)
      await gotoTab(page, tab)
      await expect(page.locator('.app-content')).toBeVisible()
      // Let async-component/Suspense loading settle.
      await page.waitForTimeout(300)
      expect(errors).toEqual([])
    })
  }
})
