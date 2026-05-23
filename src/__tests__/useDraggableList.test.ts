import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref, nextTick } from 'vue'
import { useDraggableList } from '../composables/useDraggableList'

type Item = { id: number; label: string }

function makeItems(n: number): Item[] {
  return Array.from({ length: n }, (_, i) => ({ id: i, label: `Item ${i}` }))
}

function fakeElementAtIndex(idx: number): HTMLElement {
  const el = document.createElement('div')
  el.dataset['dragIndex'] = String(idx)
  return el
}

function mountDraggable(
  initial: Item[],
  onReorder?: (items: Item[], from: number, to: number) => void,
  hitTest?: (x: number, y: number) => Element[],
) {
  const items = ref(initial)
  let drag: ReturnType<typeof useDraggableList<Item>>

  const wrapper = mount(
    defineComponent({
      setup() {
        drag = useDraggableList<Item>({ items, onReorder, _hitTest: hitTest })
        return () => null
      },
    }),
  )

  return { drag: drag!, items, unmount: () => wrapper.unmount() }
}

function makePointerEvent(type: string, x = 0): PointerEvent {
  const el = document.createElement('div')
  el.setPointerCapture = vi.fn()
  el.releasePointerCapture = vi.fn()
  const ev = new PointerEvent(type, { clientX: x, bubbles: true, pointerId: 1 })
  Object.defineProperty(ev, 'currentTarget', { value: el })
  Object.defineProperty(ev, 'target', { value: el })
  return ev
}

describe('useDraggableList', () => {
  it('starts not dragging', () => {
    const { drag, unmount } = mountDraggable(makeItems(3))
    expect(drag.isDragging.value).toBe(false)
    expect(drag.dragIndex.value).toBe(-1)
    unmount()
  })

  it('sets isDragging on pointerdown', async () => {
    const { drag, unmount } = mountDraggable(makeItems(3))
    drag.getItemProps(1).onPointerdown(makePointerEvent('pointerdown'))
    await nextTick()
    expect(drag.isDragging.value).toBe(true)
    expect(drag.dragIndex.value).toBe(1)
    unmount()
  })

  it('updates overIndex on window pointermove via hitTest', async () => {
    const hitTest = vi.fn(() => [] as Element[])
    const { drag, unmount } = mountDraggable(makeItems(3), undefined, hitTest)

    drag.getItemProps(0).onPointerdown(makePointerEvent('pointerdown'))
    hitTest.mockReturnValueOnce([fakeElementAtIndex(2)])
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, bubbles: true }))
    await nextTick()

    expect(drag.overIndex.value).toBe(2)
    unmount()
  })

  it('calls onReorder with reordered array on window pointerup', async () => {
    const onReorder = vi.fn()
    const hitTest = vi.fn(() => [] as Element[])
    const { drag, unmount } = mountDraggable(makeItems(3), onReorder, hitTest)

    drag.getItemProps(0).onPointerdown(makePointerEvent('pointerdown'))
    hitTest.mockReturnValueOnce([fakeElementAtIndex(2)])
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    await nextTick()

    expect(onReorder).toHaveBeenCalledTimes(1)
    const [newItems, from, to] = onReorder.mock.calls[0]
    expect(from).toBe(0)
    expect(to).toBe(2)
    expect(newItems.map((i: Item) => i.id)).toEqual([1, 2, 0])
    unmount()
  })

  it('does not call onReorder when dropped on same index', async () => {
    const onReorder = vi.fn()
    const { drag, unmount } = mountDraggable(makeItems(3), onReorder)

    drag.getItemProps(1).onPointerdown(makePointerEvent('pointerdown'))
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    await nextTick()

    expect(onReorder).not.toHaveBeenCalled()
    unmount()
  })

  it('resets state after drop', async () => {
    const { drag, unmount } = mountDraggable(makeItems(3))
    drag.getItemProps(0).onPointerdown(makePointerEvent('pointerdown'))
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    await nextTick()
    expect(drag.isDragging.value).toBe(false)
    expect(drag.dragIndex.value).toBe(-1)
    expect(drag.overIndex.value).toBe(-1)
    unmount()
  })

  it('getItemProps returns correct class flags while dragging', async () => {
    const hitTest = vi.fn(() => [] as Element[])
    const { drag, unmount } = mountDraggable(makeItems(3), undefined, hitTest)

    drag.getItemProps(0).onPointerdown(makePointerEvent('pointerdown'))
    hitTest.mockReturnValueOnce([fakeElementAtIndex(2)])
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, bubbles: true }))
    await nextTick()

    const sourceProps = drag.getItemProps(0)
    const overProps = drag.getItemProps(2)
    const neutralProps = drag.getItemProps(1)

    expect(sourceProps.class['vvsk-drag--dragging']).toBe(true)
    expect(overProps.class['vvsk-drag--over']).toBe(true)
    expect(neutralProps.class['vvsk-drag--dragging']).toBe(false)
    expect(neutralProps.class['vvsk-drag--over']).toBe(false)
    unmount()
  })

  it('respects isDragDisabled', async () => {
    const onReorder = vi.fn()
    const items = makeItems(3)
    let drag: ReturnType<typeof useDraggableList<Item>>
    const wrapper = mount(
      defineComponent({
        setup() {
          drag = useDraggableList<Item>({
            items: ref(items),
            onReorder,
            isDragDisabled: (_, i) => i === 0,
          })
          return () => null
        },
      }),
    )
    const disabledProps = drag!.getItemProps(0)
    expect(disabledProps.draggable).toBe(false)
    expect(disabledProps.class['vvsk-drag--disabled']).toBe(true)

    disabledProps.onPointerdown(makePointerEvent('pointerdown'))
    await nextTick()
    expect(drag!.isDragging.value).toBe(false)
    wrapper.unmount()
  })
})
