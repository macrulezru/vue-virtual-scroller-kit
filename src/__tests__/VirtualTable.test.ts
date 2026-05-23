import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import VirtualTable from '../components/VirtualTable.vue'

type Row = { id: number; name: string; value: number }

const columns = [
  { key: 'name', title: 'Name', width: 200 },
  { key: 'value', title: 'Value', width: 100 },
]

function makeRows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({ id: i, name: `Row ${i}`, value: i * 10 }))
}

describe('VirtualTable', () => {
  describe('single sort', () => {
    it('emits sort-change with asc on first click', async () => {
      const wrapper = mount(VirtualTable, {
        props: { columns, rows: makeRows(5), sortable: true },
      })
      await nextTick()

      const headers = wrapper.findAll('.vvsk-table__header-cell')
      await headers[0].trigger('click')

      const emitted = wrapper.emitted('sort-change')
      expect(emitted).toBeTruthy()
      const payload = emitted![0][0] as { key: string; direction: string | null }
      expect(payload.key).toBe('name')
      expect(payload.direction).toBe('asc')
    })

    it('cycles asc → desc → null', async () => {
      const wrapper = mount(VirtualTable, {
        props: { columns, rows: makeRows(5), sortable: true },
      })
      await nextTick()

      const header = wrapper.findAll('.vvsk-table__header-cell')[0]
      await header.trigger('click') // asc
      await header.trigger('click') // desc
      await header.trigger('click') // null

      const emits = wrapper.emitted('sort-change')!
      expect((emits[0][0] as { direction: string | null }).direction).toBe('asc')
      expect((emits[1][0] as { direction: string | null }).direction).toBe('desc')
      expect((emits[2][0] as { direction: string | null }).direction).toBeNull()
    })
  })

  describe('multi sort', () => {
    it('Shift+click adds secondary sort', async () => {
      const wrapper = mount(VirtualTable, {
        props: { columns, rows: makeRows(5), multiSort: true },
      })
      await nextTick()

      const [nameHeader, valueHeader] = wrapper.findAll('.vvsk-table__header-cell')
      await nameHeader.trigger('click')
      await valueHeader.trigger('click', { shiftKey: true })

      const emits = wrapper.emitted('sort-change')!
      const lastPayload = emits[1][0] as Array<{ key: string; direction: string }>
      expect(Array.isArray(lastPayload)).toBe(true)
      expect(lastPayload.length).toBe(2)
      expect(lastPayload[0].key).toBe('name')
      expect(lastPayload[1].key).toBe('value')
    })

    it('Shift+click on existing key advances direction', async () => {
      const wrapper = mount(VirtualTable, {
        props: { columns, rows: makeRows(5), multiSort: true },
      })
      await nextTick()

      const nameHeader = wrapper.findAll('.vvsk-table__header-cell')[0]
      await nameHeader.trigger('click') // asc
      await nameHeader.trigger('click', { shiftKey: true }) // desc via shift

      const emits = wrapper.emitted('sort-change')!
      const payload = emits[1][0] as Array<{ key: string; direction: string }>
      expect(payload[0].direction).toBe('desc')
    })
  })

  describe('column resizing', () => {
    it('emits column-resize after drag', async () => {
      const wrapper = mount(VirtualTable, {
        props: { columns, rows: makeRows(3), resizableColumns: true },
      })
      await nextTick()

      const handle = wrapper.find('.vvsk-table__resize-handle')
      const el = handle.element as HTMLElement
      el.setPointerCapture = vi.fn()
      el.releasePointerCapture = vi.fn()

      // Use native PointerEvent dispatch to avoid the read-only clientX issue in test-utils
      el.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 100, pointerId: 1, bubbles: true }),
      )
      el.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 150, pointerId: 1, bubbles: true }),
      )
      el.dispatchEvent(new PointerEvent('pointerup', { clientX: 150, pointerId: 1, bubbles: true }))
      await nextTick()

      const emitted = wrapper.emitted('column-resize')
      expect(emitted).toBeTruthy()
      expect(emitted![0][0]).toBe('name')
      expect(emitted![0][1]).toBeGreaterThan(200)
    })
  })

  describe('pinned rows', () => {
    it('renders pinned top rows', async () => {
      const pinnedTop = [{ id: -1, name: 'Pinned Top', value: 999 }]
      const wrapper = mount(VirtualTable, {
        props: { columns, rows: makeRows(3), pinnedTopRows: pinnedTop },
      })
      await nextTick()

      expect(wrapper.find('.vvsk-table__pinned--top').exists()).toBe(true)
      expect(wrapper.find('.vvsk-table__pinned--top').text()).toContain('Pinned Top')
    })

    it('renders pinned bottom rows', async () => {
      const pinnedBottom = [{ id: -2, name: 'Total', value: 0 }]
      const wrapper = mount(VirtualTable, {
        props: { columns, rows: makeRows(3), pinnedBottomRows: pinnedBottom },
      })
      await nextTick()

      expect(wrapper.find('.vvsk-table__pinned--bottom').exists()).toBe(true)
      expect(wrapper.find('.vvsk-table__pinned--bottom').text()).toContain('Total')
    })

    it('does not render pinned containers when arrays are empty', async () => {
      const wrapper = mount(VirtualTable, {
        props: { columns, rows: makeRows(3) },
      })
      await nextTick()

      expect(wrapper.find('.vvsk-table__pinned--top').exists()).toBe(false)
      expect(wrapper.find('.vvsk-table__pinned--bottom').exists()).toBe(false)
    })
  })

  describe('sort icon', () => {
    it('shows ↕ by default', async () => {
      const wrapper = mount(VirtualTable, {
        props: { columns, rows: makeRows(3), sortable: true },
      })
      await nextTick()

      const icons = wrapper.findAll('.vvsk-table__sort-icon')
      expect(icons[0].text()).toContain('↕')
    })

    it('shows ↑ after first click', async () => {
      const wrapper = mount(VirtualTable, {
        props: { columns, rows: makeRows(3), sortable: true },
      })
      await nextTick()

      await wrapper.findAll('.vvsk-table__header-cell')[0].trigger('click')
      await nextTick()

      const icons = wrapper.findAll('.vvsk-table__sort-icon')
      expect(icons[0].text()).toContain('↑')
    })
  })
})
