import { computed, isRef, onUnmounted, ref, type CSSProperties, type Ref } from 'vue'

export interface UseDraggableListOptions<T> {
  items: Ref<T[]>
  /** Called after a successful reorder with the new array */
  onReorder?: (newItems: T[], from: number, to: number) => void
  /** Return true if this item should not be draggable */
  isDragDisabled?: (item: T, index: number) => boolean
  /**
   * Scrollable container for auto-scroll when dragging near the edges.
   * Pass a ref or a direct element.
   */
  scrollContainer?: HTMLElement | Ref<HTMLElement | null>
  /** @internal override for testing – defaults to document.elementsFromPoint */
  _hitTest?: (x: number, y: number) => Element[]
}

export interface UseDraggableListReturn {
  dragIndex: Readonly<Ref<number>>
  overIndex: Readonly<Ref<number>>
  isDragging: Readonly<Ref<boolean>>
  /** Fixed-position style for the ghost element that follows the cursor */
  ghostStyle: Readonly<Ref<CSSProperties>>
  /** Per-item style: opacity:0 for placeholder, translateY for gap animation */
  getItemStyle: (index: number) => CSSProperties
  getItemProps: (index: number) => DraggableItemProps
}

export interface DraggableItemProps {
  draggable: boolean
  'data-drag-index': number
  class: Record<string, boolean>
  onPointerdown: (e: PointerEvent) => void
}

const AUTO_SCROLL_ZONE = 60 // px from edge where scrolling starts
const AUTO_SCROLL_MAX = 14 // max px per frame

export function useDraggableList<T>(options: UseDraggableListOptions<T>): UseDraggableListReturn {
  const { items, onReorder, isDragDisabled } = options
  const hitTest = options._hitTest ?? ((x, y) => document.elementsFromPoint(x, y))

  const dragIndex = ref(-1)
  const overIndex = ref(-1)
  const isDragging = ref(false)

  // Geometry captured at drag start
  const mouseY = ref(0)
  const grabOffsetY = ref(0)
  const draggedHeight = ref(0)
  const draggedLeft = ref(0)
  const draggedWidth = ref(0)

  // Auto-scroll state
  let autoScrollRAF: number | null = null
  let autoScrollSpeed = 0

  function getScrollEl(): HTMLElement | null {
    const sc = options.scrollContainer
    if (!sc) return null
    return isRef(sc) ? sc.value : sc
  }

  function tickAutoScroll(): void {
    const el = getScrollEl()
    if (!isDragging.value || autoScrollSpeed === 0 || !el) {
      autoScrollRAF = null
      return
    }
    el.scrollTop += autoScrollSpeed
    autoScrollRAF = requestAnimationFrame(tickAutoScroll)
  }

  function updateAutoScroll(clientY: number): void {
    const el = getScrollEl()
    if (!el) return

    const rect = el.getBoundingClientRect()
    const distTop = clientY - rect.top
    const distBottom = rect.bottom - clientY

    if (distTop < AUTO_SCROLL_ZONE && distTop >= 0) {
      autoScrollSpeed = -((AUTO_SCROLL_ZONE - distTop) / AUTO_SCROLL_ZONE) * AUTO_SCROLL_MAX
    } else if (distBottom < AUTO_SCROLL_ZONE && distBottom >= 0) {
      autoScrollSpeed = ((AUTO_SCROLL_ZONE - distBottom) / AUTO_SCROLL_ZONE) * AUTO_SCROLL_MAX
    } else {
      autoScrollSpeed = 0
    }

    if (autoScrollSpeed !== 0 && autoScrollRAF === null) {
      autoScrollRAF = requestAnimationFrame(tickAutoScroll)
    }
  }

  function stopAutoScroll(): void {
    if (autoScrollRAF !== null) {
      cancelAnimationFrame(autoScrollRAF)
      autoScrollRAF = null
    }
    autoScrollSpeed = 0
  }

  function onGlobalPointerMove(e: PointerEvent): void {
    mouseY.value = e.clientY
    updateAutoScroll(e.clientY)
    const elements = hitTest(e.clientX, e.clientY)
    for (const el of elements) {
      const idxStr = (el as HTMLElement).dataset?.['dragIndex']
      if (idxStr != null) {
        const targetIdx = parseInt(idxStr, 10)
        if (targetIdx !== dragIndex.value) overIndex.value = targetIdx
        break
      }
    }
  }

  function onGlobalPointerUp(): void {
    window.removeEventListener('pointermove', onGlobalPointerMove)
    window.removeEventListener('pointerup', onGlobalPointerUp)
    window.removeEventListener('pointercancel', onGlobalPointerUp)
    stopAutoScroll()

    const from = dragIndex.value
    const to = overIndex.value

    dragIndex.value = -1
    overIndex.value = -1
    isDragging.value = false

    if (from !== to && from >= 0 && to >= 0) {
      const arr = [...items.value]
      const [moved] = arr.splice(from, 1)
      arr.splice(to, 0, moved)
      onReorder?.(arr, from, to)
    }
  }

  function startDrag(index: number, e: PointerEvent): void {
    const item = items.value[index]
    if (isDragDisabled?.(item, index)) return
    e.preventDefault()

    // Capture element geometry for ghost positioning
    const el = e.currentTarget as HTMLElement | null
    if (el) {
      const rect = el.getBoundingClientRect()
      grabOffsetY.value = e.clientY - rect.top
      draggedHeight.value = rect.height
      draggedLeft.value = rect.left
      draggedWidth.value = rect.width
    }

    mouseY.value = e.clientY
    dragIndex.value = index
    overIndex.value = index
    isDragging.value = true
    window.addEventListener('pointermove', onGlobalPointerMove, { passive: true })
    window.addEventListener('pointerup', onGlobalPointerUp)
    window.addEventListener('pointercancel', onGlobalPointerUp)
  }

  function cancelDrag(): void {
    if (!isDragging.value) return
    window.removeEventListener('pointermove', onGlobalPointerMove)
    window.removeEventListener('pointerup', onGlobalPointerUp)
    window.removeEventListener('pointercancel', onGlobalPointerUp)
    stopAutoScroll()
    dragIndex.value = -1
    overIndex.value = -1
    isDragging.value = false
  }

  const ghostStyle = computed((): CSSProperties => {
    if (!isDragging.value) return {}
    return {
      position: 'fixed',
      left: `${draggedLeft.value}px`,
      top: `${mouseY.value - grabOffsetY.value}px`,
      width: `${draggedWidth.value}px`,
      pointerEvents: 'none',
      zIndex: '9999',
      boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
      transform: 'scale(1.02)',
      opacity: '0.96',
    }
  })

  function getItemStyle(index: number): CSSProperties {
    const transition = 'transform 200ms ease'
    if (!isDragging.value) return { transition }
    const from = dragIndex.value
    const to = overIndex.value
    const h = draggedHeight.value

    if (index === from) {
      return { opacity: '0', pointerEvents: 'none', transition }
    }

    if (from < to && index > from && index <= to) {
      return { transform: `translateY(-${h}px)`, transition }
    }
    if (from > to && index >= to && index < from) {
      return { transform: `translateY(${h}px)`, transition }
    }

    return { transform: 'translateY(0)', transition }
  }

  function getItemProps(index: number): DraggableItemProps {
    const item = items.value[index]
    const disabled = isDragDisabled?.(item, index) ?? false
    return {
      draggable: !disabled,
      'data-drag-index': index,
      class: {
        'vvsk-drag--dragging': isDragging.value && dragIndex.value === index,
        'vvsk-drag--over':
          isDragging.value && overIndex.value === index && dragIndex.value !== index,
        'vvsk-drag--disabled': disabled,
      },
      onPointerdown: (e: PointerEvent) => startDrag(index, e),
    }
  }

  onUnmounted(cancelDrag)

  return {
    dragIndex: dragIndex as Readonly<Ref<number>>,
    overIndex: overIndex as Readonly<Ref<number>>,
    isDragging: isDragging as Readonly<Ref<boolean>>,
    ghostStyle: ghostStyle as Readonly<Ref<CSSProperties>>,
    getItemStyle,
    getItemProps,
  }
}
