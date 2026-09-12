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

  // Regression: aria-rowcount/aria-rowindex are only valid ARIA on grid/table-family
  // roles — the default containerRole:'list'/itemRole:'listitem' used to get them too,
  // an invalid role/attribute pairing on the most common, unconfigured usage path.
  it('does not emit aria-rowcount/aria-rowindex on the default list/listitem roles', async () => {
    const wrapper = mount(VirtualList, {
      props: { items: makeItems(5) },
      slots: { default: '<div>{{ params.item.label }}</div>' },
    })
    await nextTick()

    const container = wrapper.find('.vvsk-list')
    expect(container.attributes('role')).toBe('list')
    expect(container.attributes('aria-rowcount')).toBeUndefined()
    expect(wrapper.find('[role="listitem"]').attributes('aria-rowindex')).toBeUndefined()
  })

  it('does emit aria-rowcount/aria-rowindex when overridden to grid/row roles', async () => {
    const wrapper = mount(VirtualList, {
      props: { items: makeItems(5), containerRole: 'grid', itemRole: 'row' },
      slots: { default: '<div>{{ params.item.label }}</div>' },
    })
    await nextTick()

    const container = wrapper.find('.vvsk-list')
    expect(container.attributes('role')).toBe('grid')
    expect(container.attributes('aria-rowcount')).toBe('5')
    expect(wrapper.find('[role="row"]').attributes('aria-rowindex')).toBe('1')
  })
})

describe('VirtualList scroll-element listeners', () => {
  it('emits @scroll and saves restore-key position when scrolling an external scrollElement', async () => {
    const external = document.createElement('div')
    Object.defineProperty(external, 'scrollTop', { value: 0, writable: true, configurable: true })
    document.body.appendChild(external)

    const wrapper = mount(VirtualList, {
      props: {
        items: makeItems(50),
        scrollElement: external,
        restoreKey: 'vlist-scroll-el-test',
      },
      slots: { default: '<div>{{ params.item.label }}</div>' },
      attachTo: document.body,
    })
    await nextTick()

    sessionStorage.removeItem('vvsk:restore:vlist-scroll-el-test')

    const scrollHandler = wrapper.emitted('scroll')
    expect(scrollHandler).toBeUndefined() // nothing scrolled yet

    Object.defineProperty(external, 'scrollTop', { value: 240, writable: true, configurable: true })
    external.dispatchEvent(new Event('scroll'))
    await nextTick()

    expect(wrapper.emitted('scroll')).toBeTruthy()
    expect(sessionStorage.getItem('vvsk:restore:vlist-scroll-el-test')).toBe('240')

    wrapper.unmount()
    document.body.removeChild(external)
    sessionStorage.removeItem('vvsk:restore:vlist-scroll-el-test')
  })
})
