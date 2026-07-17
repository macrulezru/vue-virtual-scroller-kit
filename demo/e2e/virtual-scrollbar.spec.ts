import { test, expect } from '@playwright/test'
import { collectErrors, gotoTab } from './helpers'

test('VirtualScrollbar thumb reflects content ratio and drag updates scroll position', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await gotoTab(page, 'VirtualList')

  const thumb = page.locator('.vvsk-scrollbar__thumb')
  await expect(thumb).toBeVisible()

  // 100k rows at ~72px each vs. an ~800px viewport → thumb should clamp to the minimum
  // grabbable size (24px default), not shrink to a sub-pixel sliver.
  const box = await thumb.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.height).toBeGreaterThanOrEqual(20)
  expect(box!.height).toBeLessThan(50)

  const scrollTopBefore = await page.evaluate(
    () => document.querySelector('.vvsk-list')?.scrollTop,
  )

  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 300, { steps: 10 })
  await page.mouse.up()

  const scrollTopAfter = await page.evaluate(
    () => document.querySelector('.vvsk-list')?.scrollTop,
  )
  expect(scrollTopAfter).not.toBe(scrollTopBefore)

  expect(errors).toEqual([])
})
