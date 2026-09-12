import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import GroupedVirtualList from '../components/GroupedVirtualList.vue'
import VirtualList from '../components/VirtualList.vue'

type Item = { id: number; label: string }

const groups = [
  {
    key: 'a',
    label: 'Group A',
    items: [
      { id: 1, label: 'A1' },
      { id: 2, label: 'A2' },
      { id: 3, label: 'A3' },
    ] as Item[],
  },
  {
    key: 'b',
    label: 'Group B',
    items: [
      { id: 4, label: 'B1' },
      { id: 5, label: 'B2' },
    ] as Item[],
  },
]

describe('GroupedVirtualList sticky headers', () => {
  it('does not render a sticky overlay when stickyGroupHeaders is off (default)', async () => {
    const wrapper = mount(GroupedVirtualList, { props: { groups } })
    await nextTick()

    expect(wrapper.find('.vvsk-grouped-sticky-header').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows the first group in the sticky overlay before any scroll', async () => {
    const wrapper = mount(GroupedVirtualList, {
      props: { groups, stickyGroupHeaders: true },
    })
    await nextTick()

    expect(wrapper.find('.vvsk-grouped-sticky-header').text()).toContain('Group A')
    wrapper.unmount()
  })

  it('updates the sticky overlay to the group at the current visible-range start', async () => {
    const wrapper = mount(GroupedVirtualList, {
      props: { groups, stickyGroupHeaders: true },
    })
    await nextTick()

    // flatRows: 0=header(a) 1=a1 2=a2 3=a3 4=header(b) 5=b1 6=b2
    // Simulate the inner VirtualList reporting that row 5 (inside group b) is now first visible.
    const list = wrapper.findComponent(VirtualList) as unknown as {
      vm: { $emit: (event: string, ...args: unknown[]) => void }
    }
    list.vm.$emit('visible-range-change', { start: 5, end: 6 })
    await nextTick()

    expect(wrapper.find('.vvsk-grouped-sticky-header').text()).toContain('Group B')
    wrapper.unmount()
  })

  it('re-emits visible-range-change to the parent', async () => {
    const wrapper = mount(GroupedVirtualList, {
      props: { groups, stickyGroupHeaders: true },
    })
    await nextTick()

    const list = wrapper.findComponent(VirtualList) as unknown as {
      vm: { $emit: (event: string, ...args: unknown[]) => void }
    }
    list.vm.$emit('visible-range-change', { start: 2, end: 3 })
    await nextTick()

    const emitted = wrapper.emitted('visible-range-change')
    expect(emitted).toBeTruthy()
    expect(emitted![emitted!.length - 1][0]).toEqual({ start: 2, end: 3 })
    wrapper.unmount()
  })
})

describe('GroupedVirtualList estimatedGroupHeaderSize', () => {
  it('estimates header rows separately from item rows (regression: was previously ignored)', async () => {
    const wrapper = mount(GroupedVirtualList, {
      props: { groups, estimatedItemSize: 50, estimatedGroupHeaderSize: 40 },
    })
    await nextTick()

    const list = wrapper.findComponent(VirtualList) as unknown as {
      props: (key: string) => unknown
    }
    const estimateFn = list.props('estimatedItemSize') as (
      row: { type: 'header' | 'item' },
      index: number,
    ) => number

    expect(typeof estimateFn).toBe('function')
    expect(estimateFn({ type: 'header' }, 0)).toBe(40)
    expect(estimateFn({ type: 'item' }, 1)).toBe(50)
    wrapper.unmount()
  })
})

describe('GroupedVirtualList keyField', () => {
  // Regression: the inner VirtualList was bound `key-field="_key"` (a literal string) —
  // flattened rows never had a real `_key`, so VirtualList's own keying always fell back
  // to array index regardless of the documented `keyField` prop, which could cause wrong
  // DOM-node reuse across collapse/expand-driven index shifts.
  it("threads a custom keyField into each flattened row's real _key", async () => {
    const wrapper = mount(GroupedVirtualList, {
      props: { groups, keyField: 'label' },
    })
    await nextTick()

    const list = wrapper.findComponent(VirtualList) as unknown as {
      props: (key: string) => unknown
    }
    const flatRows = list.props('items') as Array<{ type: string; item?: Item; _key?: string }>

    const firstItemRow = flatRows.find((r) => r.type === 'item')!
    expect(firstItemRow._key).toBe('item-a-A1') // keyField:'label' → item.label ("A1"), not the default item.id
    wrapper.unmount()
  })

  it('gives header rows a stable, group-scoped _key distinct from item rows', async () => {
    const wrapper = mount(GroupedVirtualList, { props: { groups } })
    await nextTick()

    const list = wrapper.findComponent(VirtualList) as unknown as {
      props: (key: string) => unknown
    }
    const flatRows = list.props('items') as Array<{
      type: string
      groupKey?: string
      _key?: string
    }>

    const headerRow = flatRows.find((r) => r.type === 'header')!
    expect(headerRow._key).toBe(`header-${headerRow.groupKey}`)
    wrapper.unmount()
  })

  it('falls back to a row-index key when the keyField value is missing', async () => {
    const noIdGroups = [{ key: 'x', label: 'X', items: [{ label: 'no-id' } as unknown as Item] }]
    const wrapper = mount(GroupedVirtualList, { props: { groups: noIdGroups, keyField: 'id' } })
    await nextTick()

    const list = wrapper.findComponent(VirtualList) as unknown as {
      props: (key: string) => unknown
    }
    const flatRows = list.props('items') as Array<{ type: string; index: number; _key?: string }>
    const itemRow = flatRows.find((r) => r.type === 'item')!
    expect(itemRow._key).toBe(`item-${itemRow.index}`)
    wrapper.unmount()
  })
})
