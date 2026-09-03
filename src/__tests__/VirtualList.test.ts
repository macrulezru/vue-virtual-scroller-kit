import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import VirtualList from '../components/VirtualList.vue'

type Item = { id: number; label: string }

function makeItems(n: number): Item[] {
  return Array.from({ length: n }, (_, i) => ({ id: i, label: `Item ${i}` }))
}

describe('VirtualList ARIA roles', () => {
  it('defaults to role="list" on the container and role="listitem" on each row', async () => {
    const wrapper = mount(VirtualList, {
      props: { items: makeItems(5) },
      slots: { default: '<div>{{ params.item.label }}</div>' },
    })
    await nextTick()

    expect(wrapper.find('.vvsk-list').attributes('role')).toBe('list')
    expect(wrapper.findAll('[role="listitem"]').length).toBeGreaterThan(0)
  })

  it('lets a wrapping component override the container/item roles', async () => {
    const wrapper = mount(VirtualList, {
      props: { items: makeItems(5), containerRole: 'tree', itemRole: 'none' },
      slots: { default: '<div>{{ params.item.label }}</div>' },
    })
    await nextTick()

    expect(wrapper.find('.vvsk-list').attributes('role')).toBe('tree')
    expect(wrapper.find('[role="listitem"]').exists()).toBe(false)
  })

  it('drops aria-rowcount/aria-rowindex when the role is overridden to "none"', async () => {
    const wrapper = mount(VirtualList, {
      props: { items: makeItems(3), containerRole: 'none', itemRole: 'none' },
      slots: { default: '<div>{{ params.item.label }}</div>' },
    })
    await nextTick()

    const container = wrapper.find('.vvsk-list')
    expect(container.attributes('role')).toBe('none')
    expect(container.attributes('aria-rowcount')).toBeUndefined()
  })
})
