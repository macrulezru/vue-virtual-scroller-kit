import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useRowSelection } from '../composables/useRowSelection'

type Item = { id: number; label: string }

function makeItems(n: number): Item[] {
  return Array.from({ length: n }, (_, i) => ({ id: i, label: `Item ${i}` }))
}

function shiftEvent(): MouseEvent {
  return new MouseEvent('click', { shiftKey: true })
}

function ctrlEvent(): MouseEvent {
  return new MouseEvent('click', { ctrlKey: true })
}

describe('useRowSelection', () => {
  it('starts with an empty selection', () => {
    const items = ref(makeItems(5))
    const sel = useRowSelection({ items })
    expect(sel.selectedKeys.value.size).toBe(0)
    expect(sel.selectedItems.value).toEqual([])
  })

  it('toggle selects, toggle again deselects', () => {
    const items = ref(makeItems(5))
    const sel = useRowSelection({ items })

    sel.toggle(items.value[1], 1)
    expect(sel.isSelected(items.value[1], 1)).toBe(true)
    expect(sel.selectedItems.value.map((i) => i.id)).toEqual([1])

    sel.toggle(items.value[1], 1)
    expect(sel.isSelected(items.value[1], 1)).toBe(false)
    expect(sel.selectedItems.value).toEqual([])
  })

  it('supports multiple independent selections by default', () => {
    const items = ref(makeItems(5))
    const sel = useRowSelection({ items })

    sel.toggle(items.value[0], 0)
    sel.toggle(items.value[2], 2)
    expect(sel.selectedItems.value.map((i) => i.id)).toEqual([0, 2])
  })

  it('shift-toggle fills the range from the last toggled index (ascending)', () => {
    const items = ref(makeItems(10))
    const sel = useRowSelection({ items })

    sel.toggle(items.value[2], 2)
    sel.toggle(items.value[5], 5, shiftEvent())

    expect(sel.selectedItems.value.map((i) => i.id)).toEqual([2, 3, 4, 5])
  })

  it('shift-toggle fills the range from the last toggled index (descending)', () => {
    const items = ref(makeItems(10))
    const sel = useRowSelection({ items })

    sel.toggle(items.value[6], 6)
    sel.toggle(items.value[3], 3, shiftEvent())

    expect(sel.selectedItems.value.map((i) => i.id)).toEqual([3, 4, 5, 6])
  })

  it('shift-toggle range adds on top of unrelated existing selections', () => {
    const items = ref(makeItems(10))
    const sel = useRowSelection({ items })

    sel.toggle(items.value[0], 0)
    sel.toggle(items.value[5], 5)
    sel.toggle(items.value[8], 8, shiftEvent())

    // Anchor for the shift-range is the *last* toggled index (5), not 0.
    expect(sel.selectedItems.value.map((i) => i.id)).toEqual([0, 5, 6, 7, 8])
  })

  it('ctrl/cmd-click still just toggles this item (no special-casing needed)', () => {
    const items = ref(makeItems(5))
    const sel = useRowSelection({ items })

    sel.toggle(items.value[1], 1, ctrlEvent())
    sel.toggle(items.value[3], 3, ctrlEvent())
    expect(sel.selectedItems.value.map((i) => i.id)).toEqual([1, 3])
  })

  it('single-select mode replaces the selection instead of accumulating', () => {
    const items = ref(makeItems(5))
    const sel = useRowSelection({ items, multiple: false })

    sel.toggle(items.value[1], 1)
    expect(sel.selectedItems.value.map((i) => i.id)).toEqual([1])

    sel.toggle(items.value[3], 3)
    expect(sel.selectedItems.value.map((i) => i.id)).toEqual([3])
  })

  it('selectAll selects every current item', () => {
    const items = ref(makeItems(4))
    const sel = useRowSelection({ items })

    sel.selectAll()
    expect(sel.selectedKeys.value.size).toBe(4)
    expect(sel.selectedItems.value.map((i) => i.id)).toEqual([0, 1, 2, 3])
  })

  it('clearSelection empties the selection and resets the shift-range anchor', () => {
    const items = ref(makeItems(5))
    const sel = useRowSelection({ items })

    sel.toggle(items.value[2], 2)
    sel.clearSelection()
    expect(sel.selectedKeys.value.size).toBe(0)

    // With the anchor reset, a shift-toggle with no prior toggle behaves like a plain one.
    sel.toggle(items.value[4], 4, shiftEvent())
    expect(sel.selectedItems.value.map((i) => i.id)).toEqual([4])
  })

  it('respects a custom getKey function', () => {
    const items = ref(makeItems(5))
    const sel = useRowSelection({
      items,
      getKey: (item) => `row-${item.id}`,
    })

    sel.toggle(items.value[2], 2)
    expect(sel.selectedKeys.value.has('row-2')).toBe(true)
    expect(sel.isSelected(items.value[2], 2)).toBe(true)
  })

  it('selectedItems stays in sync when the underlying items array changes', () => {
    const items = ref(makeItems(3))
    const sel = useRowSelection({ items })

    sel.toggle(items.value[1], 1) // id 1
    items.value = [items.value[0], items.value[1], { id: 99, label: 'New' }]
    expect(sel.selectedItems.value.map((i) => i.id)).toEqual([1])
  })
})
