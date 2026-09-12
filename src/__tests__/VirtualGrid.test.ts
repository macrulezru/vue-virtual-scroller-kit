import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import VirtualGrid from '../components/VirtualGrid.vue'
import { flushRAF } from './setup'

type Item = { id: number; label: string }

function makeItems(n: number): Item[] {
  return Array.from({ length: n }, (_, i) => ({ id: i, label: `Item ${i}` }))
}

// A ResizeObserver mock that lets tests trigger a specific observed element's callback,
// unlike the generic one in setup.ts which has no per-element addressing.
class AddressableResizeObserver {
  private callback: ResizeObserverCallback
  static elementToInstance = new Map<Element, AddressableResizeObserver>()

  constructor(cb: ResizeObserverCallback) {
    this.callback = cb
  }
  observe(el: Element): void {
    AddressableResizeObserver.elementToInstance.set(el, this)
  }
  unobserve(el: Element): void {
    AddressableResizeObserver.elementToInstance.delete(el)
  }
  disconnect(): void {}
  trigger(el: Element, height: number): void {
    this.callback(
      [{ target: el, contentRect: { height } } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    )
  }
}

function triggerResize(el: Element, height: number): void {
  AddressableResizeObserver.elementToInstance.get(el)?.trigger(el, height)
}

let originalRO: typeof ResizeObserver

beforeEach(() => {
  originalRO = globalThis.ResizeObserver
  AddressableResizeObserver.elementToInstance = new Map()
  globalThis.ResizeObserver = AddressableResizeObserver as unknown as typeof ResizeObserver
})

afterEach(() => {
  globalThis.ResizeObserver = originalRO
})

describe('VirtualGrid dynamicRowHeight', () => {
  it('renders row wrappers with data-virtual-row-index when enabled', async () => {
    const wrapper = mount(VirtualGrid, {
      props: { items: makeItems(20), columns: 2, rowHeight: 100, gap: 0, dynamicRowHeight: true },
      attachTo: document.body,
    })
    await nextTick()

    expect(wrapper.find('[data-virtual-row-index="0"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('does not render row wrappers when disabled (default)', async () => {
    const wrapper = mount(VirtualGrid, {
      props: { items: makeItems(20), columns: 2, rowHeight: 100, gap: 0 },
      attachTo: document.body,
    })
    await nextTick()

    expect(wrapper.find('[data-virtual-row-index]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('grows totalHeight when a row is measured taller than the estimate', async () => {
    const wrapper = mount(VirtualGrid, {
      props: { items: makeItems(20), columns: 2, rowHeight: 100, gap: 0, dynamicRowHeight: true },
      attachTo: document.body,
    })
    await nextTick()

    const heightBefore = (wrapper.find('.vvsk-grid__content').element as HTMLElement).style.height

    const row0 = wrapper.find('[data-virtual-row-index="0"]').element
    triggerResize(row0, 250) // was estimated at 100
    await new Promise((r) => setTimeout(r, 15)) // measureItem batches over a 10ms timer
    flushRAF() // scheduleRecalc's requestAnimationFrame is mocked in setup.ts
    await nextTick()

    const heightAfter = (wrapper.find('.vvsk-grid__content').element as HTMLElement).style.height
    expect(parseInt(heightAfter, 10)).toBeGreaterThan(parseInt(heightBefore, 10))
    wrapper.unmount()
  })
})

describe('VirtualGrid ARIA', () => {
  it('wraps each row of gridcells in a role="row" element (plain branch)', async () => {
    const wrapper = mount(VirtualGrid, {
      props: { items: makeItems(20), columns: 2, rowHeight: 100, gap: 0 },
      attachTo: document.body,
    })
    await nextTick()

    const rows = wrapper.findAll('[role="row"]')
    expect(rows.length).toBeGreaterThan(0)
    // every gridcell must have a role="row" ancestor, per the ARIA grid pattern
    for (const cell of wrapper.findAll('[role="gridcell"]')) {
      expect(cell.element.closest('[role="row"]')).not.toBeNull()
    }
    wrapper.unmount()
  })

  it('wraps each row of gridcells in a role="row" element (dynamicRowHeight branch)', async () => {
    const wrapper = mount(VirtualGrid, {
      props: { items: makeItems(20), columns: 2, rowHeight: 100, gap: 0, dynamicRowHeight: true },
      attachTo: document.body,
    })
    await nextTick()

    for (const cell of wrapper.findAll('[role="gridcell"]')) {
      expect(cell.element.closest('[role="row"]')).not.toBeNull()
    }
    wrapper.unmount()
  })

  // Regression: VirtualGrid never got the containerRole/itemRole override props that
  // VirtualList/VirtualTree/VirtualSelect already have — role="grid"/"row"/"gridcell"
  // was hardcoded with no escape hatch for embedding a grid inside another semantic widget.
  it('defaults to role="grid"/"row"/"gridcell"', async () => {
    const wrapper = mount(VirtualGrid, {
      props: { items: makeItems(20), columns: 2, rowHeight: 100, gap: 0 },
      attachTo: document.body,
    })
    await nextTick()

    expect(wrapper.find('.vvsk-grid').attributes('role')).toBe('grid')
    expect(wrapper.find('[role="row"]').exists()).toBe(true)
    expect(wrapper.find('[role="gridcell"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('lets a wrapping component override containerRole/rowRole/itemRole (plain branch)', async () => {
    const wrapper = mount(VirtualGrid, {
      props: {
        items: makeItems(20),
        columns: 2,
        rowHeight: 100,
        gap: 0,
        containerRole: 'none',
        rowRole: 'none',
        itemRole: 'none',
      },
      attachTo: document.body,
    })
    await nextTick()

    expect(wrapper.find('.vvsk-grid').attributes('role')).toBe('none')
    expect(wrapper.find('[role="row"]').exists()).toBe(false)
    expect(wrapper.find('[role="gridcell"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('lets a wrapping component override containerRole/rowRole/itemRole (dynamicRowHeight branch)', async () => {
    const wrapper = mount(VirtualGrid, {
      props: {
        items: makeItems(20),
        columns: 2,
        rowHeight: 100,
        gap: 0,
        dynamicRowHeight: true,
        containerRole: 'none',
        rowRole: 'none',
        itemRole: 'none',
      },
      attachTo: document.body,
    })
    await nextTick()

    expect(wrapper.find('.vvsk-grid').attributes('role')).toBe('none')
    expect(wrapper.find('[role="row"]').exists()).toBe(false)
    expect(wrapper.find('[role="gridcell"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('drops aria-rowcount/aria-colcount/aria-rowindex/aria-colindex when roles are overridden away from the grid family', async () => {
    const wrapper = mount(VirtualGrid, {
      props: {
        items: makeItems(20),
        columns: 2,
        rowHeight: 100,
        gap: 0,
        containerRole: 'none',
        rowRole: 'none',
        itemRole: 'none',
      },
      attachTo: document.body,
    })
    await nextTick()

    const container = wrapper.find('.vvsk-grid')
    expect(container.attributes('aria-rowcount')).toBeUndefined()
    expect(container.attributes('aria-colcount')).toBeUndefined()
    wrapper.unmount()
  })

  it('keeps emitting aria-rowcount/aria-colcount/aria-rowindex/aria-colindex on the default roles', async () => {
    const wrapper = mount(VirtualGrid, {
      props: { items: makeItems(20), columns: 2, rowHeight: 100, gap: 0 },
      attachTo: document.body,
    })
    await nextTick()

    const container = wrapper.find('.vvsk-grid')
    expect(container.attributes('aria-rowcount')).toBe('10')
    expect(container.attributes('aria-colcount')).toBe('2')
    expect(wrapper.find('[role="row"]').attributes('aria-rowindex')).toBe('1')
    expect(wrapper.find('[role="gridcell"]').attributes('aria-rowindex')).toBe('1')
    expect(wrapper.find('[role="gridcell"]').attributes('aria-colindex')).toBe('1')
    wrapper.unmount()
  })
})
