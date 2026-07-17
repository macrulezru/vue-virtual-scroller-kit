import { test, expect } from '@playwright/test'
import { collectErrors, gotoTab } from './helpers'

test('dragging a column header reorders the table columns', async ({ page }) => {
  const errors = collectErrors(page)
  await gotoTab(page, 'VirtualTable')

  await page.getByText('Reorderable columns (drag header)').click()

  const headerText = () => page.locator('.vvsk-table__header-cell').allInnerTexts()
  const before = await headerText()
  expect(before[1]).toContain('Name')
  expect(before[2]).toContain('Email')

  const nameHeader = page.locator('.vvsk-table__header-cell', { hasText: 'Name' })
  const emailHeader = page.locator('.vvsk-table__header-cell', { hasText: 'Email' })
  const nameBox = await nameHeader.boundingBox()
  const emailBox = await emailHeader.boundingBox()
  expect(nameBox).not.toBeNull()
  expect(emailBox).not.toBeNull()

  await page.mouse.move(nameBox!.x + nameBox!.width / 2, nameBox!.y + nameBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(emailBox!.x + emailBox!.width / 2, emailBox!.y + emailBox!.height / 2, {
    steps: 10,
  })
  await page.mouse.up()

  const after = await headerText()
  expect(after[1]).toContain('Email')
  expect(after[2]).toContain('Name')

  expect(errors).toEqual([])
})

test('column reorder drag does not trigger sort', async ({ page }) => {
  await gotoTab(page, 'VirtualTable')
  await page.getByText('Reorderable columns (drag header)').click()

  const nameHeader = page.locator('.vvsk-table__header-cell', { hasText: 'Name' })
  const emailHeader = page.locator('.vvsk-table__header-cell', { hasText: 'Email' })
  const nameBox = (await nameHeader.boundingBox())!
  const emailBox = (await emailHeader.boundingBox())!

  await page.mouse.move(nameBox.x + nameBox.width / 2, nameBox.y + nameBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(emailBox.x + emailBox.width / 2, emailBox.y + emailBox.height / 2, {
    steps: 10,
  })
  await page.mouse.up()

  await expect(page.locator('.vvsk-table__sort-icon')).toHaveCount(0)
})
