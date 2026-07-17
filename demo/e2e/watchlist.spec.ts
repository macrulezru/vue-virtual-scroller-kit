import { test, expect } from '@playwright/test'
import { collectErrors, gotoTab } from './helpers'

test('watchlist dot lights up when a watched row scrolls into view and dims when it scrolls out', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await gotoTab(page, 'VirtualList')

  const watchedItem = page.locator('.demo-watchlist__item', { hasText: '#50000' })
  await expect(watchedItem).toBeVisible()
  await expect(watchedItem).not.toHaveClass(/demo-watchlist__item--visible/)

  // Jump straight to the watched row's index (id 50000 → index 49999). Text checks are
  // scoped to .demo-viewport — the watchlist sidebar entry itself always contains this
  // same text, regardless of scroll position, so an unscoped match would be vacuous.
  const list = page.locator('.demo-viewport')
  await page.locator('input[type="number"]').fill('49999')
  await page.getByRole('button', { name: 'Go' }).click()
  await expect(list.getByText('#50000', { exact: false }).first()).toBeVisible()

  await expect(watchedItem).toHaveClass(/demo-watchlist__item--visible/)

  // Jump far away — the watched row unmounts (virtualized out) and the dot dims again.
  await page.locator('input[type="number"]').fill('0')
  await page.getByRole('button', { name: 'Go' }).click()
  await expect(list.getByText('[Bug Report] Issue #1 —', { exact: false }).first()).toBeVisible()

  await expect(watchedItem).not.toHaveClass(/demo-watchlist__item--visible/)

  expect(errors).toEqual([])
})

test('starring a row adds it to the watchlist and unstarring removes it', async ({ page }) => {
  const errors = collectErrors(page)
  await gotoTab(page, 'VirtualList')

  const secondRowStar = page.locator('.issue-row__watch').nth(1)
  await expect(secondRowStar).toHaveText('☆')
  await secondRowStar.click()
  await expect(secondRowStar).toHaveText('★')

  const watchlistLabel = page.locator('.demo-sidebar__label', { hasText: 'Watchlist' })
  await expect(watchlistLabel).toContainText('4') // 3 defaults + this one

  await secondRowStar.click()
  await expect(secondRowStar).toHaveText('☆')
  await expect(watchlistLabel).toContainText('3')

  expect(errors).toEqual([])
})

test('a single click on a watchlist entry reliably lands the target row in view, in either direction', async ({
  page,
}) => {
  // Regression test: with a flat estimatedItemSize, 2/3 of rows carrying an extra description
  // paragraph meant a single scrollTo() on a distant row could settle short of the target.
  // scrollToWatched() now jumps straight to a per-row size estimate (accounting for the
  // description) and glides the short remainder in smoothly. Exercise it forward and backward
  // across several distances so a one-off lucky landing (or a regression that only shows up
  // going one direction) doesn't slip through.
  const errors = collectErrors(page)
  await gotoTab(page, 'VirtualList')
  // Scoped to .demo-viewport — the watchlist sidebar entry always contains this same
  // text regardless of scroll position, so an unscoped match would be vacuous.
  const list = page.locator('.demo-viewport')

  async function clickAndExpectVisible(target: string, textMatch: string) {
    const watchedItem = page.locator('.demo-watchlist__item', { hasText: target })
    await watchedItem.click()
    await expect(list.getByText(textMatch, { exact: false }).first()).toBeVisible({ timeout: 8000 })
    await expect(watchedItem).toHaveClass(/demo-watchlist__item--visible/, { timeout: 8000 })
  }

  await clickAndExpectVisible('#95000', '#95000') // forward, far
  await clickAndExpectVisible('#50000', '#50000') // backward, mid
  await clickAndExpectVisible('#1 ', '[Bug Report] Issue #1 —') // backward, all the way
  await clickAndExpectVisible('#95000', '#95000') // forward, far again

  expect(errors).toEqual([])
})
