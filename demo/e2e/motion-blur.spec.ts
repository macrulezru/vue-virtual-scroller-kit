import { test, expect } from '@playwright/test'
import { collectErrors, gotoTab } from './helpers'

test('motion blur applies during fast scroll and clears once settled', async ({ page }) => {
  const errors = collectErrors(page)
  await gotoTab(page, 'VirtualList')

  await page.getByText('Motion blur while scrolling fast').click()

  // Track the peak blur radius observed on the row-content wrapper while scrolling —
  // sampling only after the scroll finishes would race the ~150ms clear debounce.
  await page.evaluate(() => {
    ;(window as unknown as { __maxBlur: number }).__maxBlur = 0
    const el = document.querySelector('.vvsk-list > div')!
    const tick = (): void => {
      const m = /blur\(([\d.]+)px\)/.exec(getComputedStyle(el).filter)
      if (m) {
        const w = window as unknown as { __maxBlur: number }
        w.__maxBlur = Math.max(w.__maxBlur, parseFloat(m[1]))
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

  const viewport = page.locator('.demo-viewport')
  await viewport.hover()
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, 1000)
  }

  const maxBlur = await page.evaluate(() => (window as unknown as { __maxBlur: number }).__maxBlur)
  expect(maxBlur).toBeGreaterThan(0)

  await page.waitForTimeout(400)
  const settledFilter = await page.evaluate(
    () => getComputedStyle(document.querySelector('.vvsk-list > div')!).filter,
  )
  expect(settledFilter).toBe('none')

  expect(errors).toEqual([])
})
