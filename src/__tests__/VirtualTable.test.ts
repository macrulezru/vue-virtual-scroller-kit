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
    it('renders pinned top rows inside <thead>', async () => {
      const pinnedTop = [{ id: -1, name: 'Pinned Top', value: 999 }]
      const wrapper = mount(VirtualTable, {
        props: { columns, rows: makeRows(3), pinnedTopRows: pinnedTop },
      })
      await nextTick()

      const row = wrapper.find('thead .vvsk-table__row--pinned-top')
      expect(row.exists()).toBe(true)
      expect(row.text()).toContain('Pinned Top')
    })

    it('renders pinned bottom rows inside <tfoot>', async () => {
      const pinnedBottom = [{ id: -2, name: 'Total', value: 0 }]
      const wrapper = mount(VirtualTable, {
        props: { columns, rows: makeRows(3), pinnedBottomRows: pinnedBottom },
      })
      await nextTick()

      const row = wrapper.find('tfoot .vvsk-table__row--pinned-bottom')
      expect(row.exists()).toBe(true)
      expect(row.text()).toContain('Total')
    })

    it('does not render <tfoot> when pinnedBottomRows is empty', async () => {
      const wrapper = mount(VirtualTable, {
        props: { columns, rows: makeRows(3) },
      })
      await nextTick()

      expect(wrapper.find('tfoot').exists()).toBe(false)
      expect(wrapper.find('.vvsk-table__row--pinned-top').exists()).toBe(false)
    })
  })

  describe('sort icon', () => {
    it('shows no sort icon by default (unsorted columns)', async () => {
      const wrapper = mount(VirtualTable, {
        props: { columns, rows: makeRows(3), sortable: true },
      })
      await nextTick()

      expect(wrapper.findAll('.vvsk-table__sort-icon').length).toBe(0)
    })

    it('shows ↑ after first click', async () => {
      const wrapper = mount(VirtualTable, {
        props: { columns, rows: makeRows(3), sortable: true },
      })
      await nextTick()

      await wrapper.findAll('.vvsk-table__header-cell')[0].trigger('click')
      await nextTick()

      const icons = wrapper.findAll('.vvsk-table__sort-icon')
      expect(icons.length).toBe(1)
      expect(icons[0].text()).toContain('↑')
    })

    it('hides sort icon after cycling back to null', async () => {
      const wrapper = mount(VirtualTable, {
        props: { columns, rows: makeRows(3), sortable: true },
      })
      await nextTick()

      const header = wrapper.findAll('.vvsk-table__header-cell')[0]
      await header.trigger('click') // asc
      await header.trigger('click') // desc
      await header.trigger('click') // null
      await nextTick()

      expect(wrapper.findAll('.vvsk-table__sort-icon').length).toBe(0)
    })
  })

  describe('column reordering', () => {
    // .trigger() can't set clientX/clientY on synthesized events in jsdom (getter-only on
    // MouseEvent.prototype), so dispatch real PointerEvents directly — same pattern as
    // useDraggableList.test.ts and VirtualScrollbar.test.ts use for pointer interactions.
    function pointerEvent(type: string, x: number, y: number): PointerEvent {
      return new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, pointerId: 1 })
    }

    it('emits column-reorder and swaps rendered column order after a threshold-crossing drag', async () => {
      const wrapper = mount(VirtualTable, {
        props: { columns, rows: makeRows(3), reorderableColumns: true },
      })
      await nextTick()

      const headers = wrapper.findAll('.vvsk-table__header-cell')
      expect(headers.map((h) => h.text())).toEqual(['Name', 'Value'])

      // Mock hit-testing so the drag "lands" on the Value header.
      const valueTh = headers[1].element as HTMLElement
      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([valueTh])

      headers[0].element.dispatchEvent(pointerEvent('pointerdown', 0, 0))
      window.dispatchEvent(pointerEvent('pointermove', 20, 0))
      window.dispatchEvent(pointerEvent('pointerup', 20, 0))
      await nextTick()

      const emitted = wrapper.emitted('column-reorder')
      expect(emitted).toBeTruthy()
      expect(emitted![0][0]).toEqual(['value', 'name'])

      const headersAfter = wrapper.findAll('.vvsk-table__header-cell')
      expect(headersAfter.map((h) => h.text())).toEqual(['Value', 'Name'])
    })

    it('suppresses the sort click after a threshold-crossing drag', async () => {
      const wrapper = mount(VirtualTable, {
        props: { columns, rows: makeRows(3), reorderableColumns: true, sortable: true },
      })
      await nextTick()

      const headers = wrapper.findAll('.vvsk-table__header-cell')
      const valueTh = headers[1].element as HTMLElement
      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([valueTh])

      headers[0].element.dispatchEvent(pointerEvent('pointerdown', 0, 0))
      window.dispatchEvent(pointerEvent('pointermove', 20, 0))
      window.dispatchEvent(pointerEvent('pointerup', 20, 0))
      // Real browsers still synthesize a click after pointerup on the original target —
      // the drag suppresses its *sort* side effect via a one-shot flag, not preventDefault.
      await headers[0].trigger('click')
      await nextTick()

      expect(wrapper.emitted('sort-change')).toBeFalsy()
    })

    it('still sorts on a plain click when the pointer never crosses the drag threshold', async () => {
      const wrapper = mount(VirtualTable, {
        props: { columns, rows: makeRows(3), reorderableColumns: true, sortable: true },
      })
      await nextTick()

      const headers = wrapper.findAll('.vvsk-table__header-cell')
      headers[0].element.dispatchEvent(pointerEvent('pointerdown', 0, 0))
      window.dispatchEvent(pointerEvent('pointerup', 0, 0))
      await headers[0].trigger('click')
      await nextTick()

      expect(wrapper.emitted('sort-change')).toBeTruthy()
      expect(wrapper.emitted('column-reorder')).toBeFalsy()
    })

    it('does not reorder when reorderableColumns is off (default)', async () => {
      const wrapper = mount(VirtualTable, {
        props: { columns, rows: makeRows(3) },
      })
      await nextTick()

      const headers = wrapper.findAll('.vvsk-table__header-cell')
      const valueTh = headers[1].element as HTMLElement
      vi.spyOn(document, 'elementsFromPoint').mockReturnValue([valueTh])

      headers[0].element.dispatchEvent(pointerEvent('pointerdown', 0, 0))
      window.dispatchEvent(pointerEvent('pointermove', 20, 0))
      window.dispatchEvent(pointerEvent('pointerup', 20, 0))
      await nextTick()

      expect(wrapper.emitted('column-reorder')).toBeFalsy()
      expect(wrapper.findAll('.vvsk-table__header-cell').map((h) => h.text())).toEqual([
        'Name',
        'Value',
      ])
    })
  })

  describe('column visibility', () => {
    type Exposed = {
      toggleColumnVisible: (key: string) => void
      setColumnVisible: (key: string, visible: boolean) => void
      getHiddenColumns: () => string[]
    }

    it('hides a column from the header/body and reports it via getHiddenColumns', async () => {
      const wrapper = mount(VirtualTable, { props: { columns, rows: makeRows(3) } })
      await nextTick()

      expect(wrapper.findAll('.vvsk-table__header-cell').map((h) => h.text())).toEqual([
        'Name',
        'Value',
      ])
      ;(wrapper.vm as unknown as Exposed).toggleColumnVisible('value')
      await nextTick()

      expect(wrapper.findAll('.vvsk-table__header-cell').map((h) => h.text())).toEqual(['Name'])
      expect((wrapper.vm as unknown as Exposed).getHiddenColumns()).toEqual(['value'])
    })

    it('toggling back makes the column reappear', async () => {
      const wrapper = mount(VirtualTable, { props: { columns, rows: makeRows(3) } })
      await nextTick()
      const vm = wrapper.vm as unknown as Exposed

      vm.toggleColumnVisible('value')
      await nextTick()
      vm.toggleColumnVisible('value')
      await nextTick()

      expect(wrapper.findAll('.vvsk-table__header-cell').map((h) => h.text())).toEqual([
        'Name',
        'Value',
      ])
      expect(vm.getHiddenColumns()).toEqual([])
    })

    it('emits column-visibility-change with the key and new visibility', async () => {
      const wrapper = mount(VirtualTable, { props: { columns, rows: makeRows(3) } })
      await nextTick()
      const vm = wrapper.vm as unknown as Exposed

      vm.setColumnVisible('value', false)
      await nextTick()

      const emitted = wrapper.emitted('column-visibility-change')
      expect(emitted).toBeTruthy()
      expect(emitted![0][0]).toEqual({ key: 'value', visible: false })
    })

    it('does not re-emit when setting a column to its current visibility', async () => {
      const wrapper = mount(VirtualTable, { props: { columns, rows: makeRows(3) } })
      await nextTick()
      const vm = wrapper.vm as unknown as Exposed

      vm.setColumnVisible('value', true) // already visible — no-op
      await nextTick()

      expect(wrapper.emitted('column-visibility-change')).toBeFalsy()
    })

    it('a hidden fixed column drops out of the sticky-offset calculation for the next one', async () => {
      const fixedCols = [
        { key: 'a', title: 'A', width: 50, fixed: 'left' as const },
        { key: 'b', title: 'B', width: 60, fixed: 'left' as const },
        { key: 'c', title: 'C', width: 100 },
      ]
      const wrapper = mount(VirtualTable, { props: { columns: fixedCols, rows: makeRows(2) } })
      await nextTick()
      const vm = wrapper.vm as unknown as Exposed

      const styleBefore = wrapper.findAll('.vvsk-table__header-cell')[1].attributes('style')
      expect(styleBefore).toContain('50px') // column "b" starts after "a" (50px wide)

      vm.toggleColumnVisible('a')
      await nextTick()

      // "b" is now the first fixed column — its sticky offset should reset to 0.
      const styleAfter = wrapper.findAll('.vvsk-table__header-cell')[0].attributes('style')
      expect(styleAfter).toContain('0px')
    })
  })
})
