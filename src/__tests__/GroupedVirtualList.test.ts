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
