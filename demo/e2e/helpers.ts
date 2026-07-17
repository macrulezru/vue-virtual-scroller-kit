import type { Page } from '@playwright/test'

export const TABS = [
  'VirtualList',
  'VirtualTable',
  'GroupedVirtualList',
  'InfiniteLoader',
  'VirtualTree',
  'VirtualGrid',
  'VirtualSelect',
  'Composables',
] as const

/** Collects console `error` messages and uncaught page errors for the lifetime of the page. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))
  return errors
}

export async function gotoTab(page: Page, tabLabel: (typeof TABS)[number]): Promise<void> {
  await page.goto('/')
  // Scoped to the <nav class="app-tabs"> bar and exact-matched: a page-wide/unscoped text
  // search for e.g. "VirtualList" would also match the "GroupedVirtualList" tab (substring,
  // `hasText` on a plain `.locator()` call isn't exact-matchable) and, whenever VirtualList
  // happens to be the already-active default tab, that demo's own <h2> heading too.
  await page.locator('.app-tabs').getByText(tabLabel, { exact: true }).click()
}
