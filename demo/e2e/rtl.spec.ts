import { test, expect } from '@playwright/test'
import { TABS, collectErrors, gotoTab } from './helpers'

async function enableRtl(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: /Direction:/ }).click()
  await expect(page.locator('.app-content')).toHaveAttribute('dir', 'rtl')
}

test.describe('RTL', () => {
  for (const tab of TABS) {
    test(`${tab} tab renders cleanly under dir="rtl"`, async ({ page }) => {
      const errors = collectErrors(page)
      await gotoTab(page, tab)
      await enableRtl(page)
      await page.waitForTimeout(300)
      expect(errors).toEqual([])
    })
  }

  test('VirtualTable fixed-left column pins to the physical right edge', async ({ page }) => {
    await gotoTab(page, 'VirtualTable')
    await enableRtl(page)

    const table = page.locator('.vvsk-table').first()
    const tableBox = await table.boundingBox()
    expect(tableBox).not.toBeNull()

    // The "#" column has `fixed: 'left'` → pinned to the logical *start* edge, which is
    // the physical right in RTL.
    const idHeader = page.locator('.vvsk-table__header-cell', { hasText: '#' }).first()
    const idBox = await idHeader.boundingBox()
    expect(idBox).not.toBeNull()

    const distanceFromRight = tableBox!.x + tableBox!.width - (idBox!.x + idBox!.width)
    const distanceFromLeft = idBox!.x - tableBox!.x
    expect(distanceFromRight).toBeLessThan(distanceFromLeft)
  })

  test('column resize still grows the column when dragged toward the start edge in RTL', async ({
    page,
  }) => {
    await gotoTab(page, 'VirtualTable')
    await page.getByText('Resizable columns').click()
    await enableRtl(page)

    const idHeader = page.locator('.vvsk-table__header-cell', { hasText: '#' }).first()
    const widthBefore = (await idHeader.boundingBox())!.width

    const handle = idHeader.locator('.vvsk-table__resize-handle')
    const handleBox = await handle.boundingBox()
    expect(handleBox).not.toBeNull()

    // The handle sits on the column's end edge — physically the *left* side in RTL.
    // Dragging further left (away from the column) should grow it, not shrink it.
    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(handleBox!.x - 40, handleBox!.y + handleBox!.height / 2, { steps: 5 })
    await page.mouse.up()

    const widthAfter = (await idHeader.boundingBox())!.width
    expect(widthAfter).toBeGreaterThan(widthBefore)
  })
})
