import { isRef, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import { PositionManager, type SizeProvider } from './PositionManager'
import type { ScrollAlign, VisibleRange } from '../types'

export interface UseVirtualScrollOptions {
  itemCount: number | Ref<number>
  estimatedItemSize?: SizeProvider | Ref<SizeProvider>
  overscan?: number
  getScrollElement: () => HTMLElement | null
  /**
   * Page-mode: use window as scroll container.
   * getScrollElement() should return the list's root element for offset calculation.
   */
  pageMode?: boolean
}

export interface UseVirtualScrollReturn {
  visibleRange: Readonly<Ref<VisibleRange>>
  totalHeight: Readonly<Ref<number>>
  offsetTop: (index: number) => number
  scrollTo: (index: number, align?: ScrollAlign) => void
  scrollToOffset: (offset: number) => void
  measureItem: (index: number, height: number) => void
  handleScroll: () => void
}

export function useVirtualScroll(options: UseVirtualScrollOptions): UseVirtualScrollReturn {
  const { overscan = 3, getScrollElement, pageMode = false } = options

  const getEstimatedSize = (): SizeProvider =>
    isRef(options.estimatedItemSize)
      ? options.estimatedItemSize.value
      : (options.estimatedItemSize ?? 50)
  const getCount = (): number =>
    isRef(options.itemCount) ? options.itemCount.value : (options.itemCount as number)

  let manager = new PositionManager(getCount(), getEstimatedSize())

  const visibleRange = ref<VisibleRange>({ start: 0, end: 0 })
  const totalHeight = ref(manager.totalSize)

  let pendingMeasurements: Array<{ index: number; height: number }> = []
  let measureTimer: ReturnType<typeof setTimeout> | null = null
  let rafId: number | null = null

  // In page-mode, scrollTop = window.scrollY minus the container's top offset.
  function getScrollMetrics(): { scrollTop: number; clientHeight: number } {
    if (pageMode) {
      const container = getScrollElement()
      const containerTop = container ? container.getBoundingClientRect().top + window.scrollY : 0
      return {
        scrollTop: Math.max(0, window.scrollY - containerTop),
        clientHeight: window.innerHeight,
      }
    }
    const el = getScrollElement()
    if (!el) return { scrollTop: 0, clientHeight: 0 }
    return { scrollTop: el.scrollTop, clientHeight: el.clientHeight }
  }

  function recalcVisibleRange(): void {
    const count = getCount()
    const { scrollTop, clientHeight } = getScrollMetrics()

    const rawStart = manager.findIndex(scrollTop)
    const rawEnd = manager.findIndex(scrollTop + clientHeight)
    const start = Math.max(0, rawStart - overscan)
    const end = Math.min(count - 1, rawEnd + overscan)

    const cur = visibleRange.value
    if (cur.start !== start || cur.end !== end) visibleRange.value = { start, end }
    totalHeight.value = manager.totalSize
  }

  function scheduleRecalc(): void {
    if (rafId !== null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      recalcVisibleRange()
    })
  }

  function onScroll(): void {
    scheduleRecalc()
  }

  function flushMeasurements(): void {
    measureTimer = null
    for (const { index, height } of pendingMeasurements) manager.set(index, height)
    pendingMeasurements = []
    scheduleRecalc()
  }

  function measureItem(index: number, height: number): void {
    pendingMeasurements.push({ index, height })
    if (measureTimer === null) measureTimer = setTimeout(flushMeasurements, 10)
  }

  function offsetTop(index: number): number {
    return manager.getOffset(index)
  }

  function scrollToOffset(offset: number): void {
    if (pageMode) {
      const container = getScrollElement()
      const containerTop = container ? container.getBoundingClientRect().top + window.scrollY : 0
      window.scrollTo({ top: containerTop + offset, behavior: 'auto' })
    } else {
      const el = getScrollElement()
      if (el) el.scrollTop = offset
    }
  }

  function scrollTo(index: number, align: ScrollAlign = 'start'): void {
    const { scrollTop, clientHeight } = getScrollMetrics()
    const itemTop = manager.getOffset(index)
    const itemHeight = manager.getHeight(index)

    let targetOffset: number
    switch (align) {
      case 'center':
        targetOffset = itemTop - clientHeight / 2 + itemHeight / 2
        break
      case 'end':
        targetOffset = itemTop - clientHeight + itemHeight
        break
      case 'auto':
        if (itemTop < scrollTop) {
          targetOffset = itemTop
        } else if (itemTop + itemHeight > scrollTop + clientHeight) {
          targetOffset = itemTop - clientHeight + itemHeight
        } else {
          return
        }
        break
      default:
        targetOffset = itemTop
    }
    scrollToOffset(Math.max(0, targetOffset))
  }

  if (isRef(options.itemCount)) {
    watch(options.itemCount, (count) => {
      manager = new PositionManager(count, getEstimatedSize())
      totalHeight.value = manager.totalSize
      scheduleRecalc()
    })
  }

  if (isRef(options.estimatedItemSize)) {
    watch(options.estimatedItemSize, () => {
      manager = new PositionManager(getCount(), getEstimatedSize())
      totalHeight.value = manager.totalSize
      scheduleRecalc()
    })
  }

  let viewportRO: ResizeObserver | null = null

  onMounted(() => {
    if (pageMode) {
      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('resize', scheduleRecalc)
    } else {
      const el = getScrollElement()
      if (el) {
        el.addEventListener('scroll', onScroll, { passive: true })
        if (typeof ResizeObserver !== 'undefined') {
          viewportRO = new ResizeObserver(scheduleRecalc)
          viewportRO.observe(el)
        }
      }
    }
    recalcVisibleRange()
  })

  onUnmounted(() => {
    if (pageMode) {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', scheduleRecalc)
    } else {
      const el = getScrollElement()
      if (el) el.removeEventListener('scroll', onScroll)
    }
    viewportRO?.disconnect()
    viewportRO = null
    if (rafId !== null) cancelAnimationFrame(rafId)
    if (measureTimer !== null) clearTimeout(measureTimer)
  })

  return {
    visibleRange: visibleRange as Readonly<Ref<VisibleRange>>,
    totalHeight: totalHeight as Readonly<Ref<number>>,
    offsetTop,
    scrollTo,
    scrollToOffset,
    measureItem,
    handleScroll: onScroll,
  }
}
