import { isRef, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import { PositionManager, type SizeProvider } from './PositionManager'
import { computeBlurAmount } from '../utils/motionBlur'
import {
  normalizeScrollLeft,
  rawScrollLeftFor,
  setNormalizedScrollLeft,
} from '../utils/normalizeScrollLeft'
import type { ScrollAlign, ScrollBehaviorOptions, VisibleRange } from '../types'

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
  /**
   * Virtualize along the horizontal axis (`scrollLeft`/`clientWidth`) instead of the
   * vertical one. RTL-safe via {@link normalizeScrollLeft}. Not supported in combination
   * with `pageMode` — window-level horizontal scroll is out of scope.
   */
  horizontal?: boolean
  /**
   * Track scroll velocity and expose it as a blur radius (px) via `blurAmount`,
   * for an opt-in motion-blur effect while scrolling fast. Off by default (zero cost).
   * A `Ref` is watched so the effect can be toggled at runtime.
   */
  motionBlur?: boolean | Ref<boolean>
}

export interface UseVirtualScrollReturn {
  visibleRange: Readonly<Ref<VisibleRange>>
  /** Total content size along the scroll axis (height, or width when `horizontal` is set). */
  totalHeight: Readonly<Ref<number>>
  /** Offset of `index` along the scroll axis (top, or left when `horizontal` is set). */
  offsetTop: (index: number) => number
  scrollTo: (index: number, align?: ScrollAlign, options?: ScrollBehaviorOptions) => void
  scrollToOffset: (offset: number, options?: ScrollBehaviorOptions) => void
  measureItem: (index: number, height: number) => void
  handleScroll: () => void
  /** Current motion-blur radius in px. Always 0 unless `motionBlur` option is enabled. */
  blurAmount: Readonly<Ref<number>>
}

export function useVirtualScroll(options: UseVirtualScrollOptions): UseVirtualScrollReturn {
  const { overscan = 3, getScrollElement, pageMode = false, horizontal = false } = options

  const getEstimatedSize = (): SizeProvider =>
    isRef(options.estimatedItemSize)
      ? options.estimatedItemSize.value
      : (options.estimatedItemSize ?? 50)
  const getCount = (): number =>
    isRef(options.itemCount) ? options.itemCount.value : (options.itemCount as number)
  const getMotionBlur = (): boolean =>
    isRef(options.motionBlur) ? options.motionBlur.value : (options.motionBlur ?? false)

  let manager = new PositionManager(getCount(), getEstimatedSize())

  const visibleRange = ref<VisibleRange>({ start: 0, end: 0 })
  const totalHeight = ref(manager.totalSize)
  const blurAmount = ref(0)

  let pendingMeasurements: Array<{ index: number; height: number }> = []
  let measureTimer: ReturnType<typeof setTimeout> | null = null
  let rafId: number | null = null
  let pendingForce = false

  // Motion-blur velocity tracking (raw, per scroll event — not rAF-throttled).
  let lastVelocityScrollTop: number | null = null
  let lastVelocityTime = 0
  let blurClearTimer: ReturnType<typeof setTimeout> | null = null
  const BLUR_CLEAR_DELAY_MS = 120

  // While a native `behavior: 'smooth'` scroll is likely still animating, a direct
  // scrollTop write (like the anchor compensation below) would cancel it outright.
  // Suppress compensation for a bounded window rather than fighting the animation.
  let smoothScrollGuardUntil = 0
  const SMOOTH_SCROLL_GUARD_MS = 1000

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
    if (horizontal) return { scrollTop: normalizeScrollLeft(el), clientHeight: el.clientWidth }
    return { scrollTop: el.scrollTop, clientHeight: el.clientHeight }
  }

  function recalcVisibleRange(force = false): void {
    const count = getCount()
    const { scrollTop, clientHeight } = getScrollMetrics()

    const rawStart = manager.findIndex(scrollTop)
    const rawEnd = manager.findIndex(scrollTop + clientHeight)
    const start = Math.max(0, rawStart - overscan)
    const end = Math.min(count - 1, rawEnd + overscan)

    const cur = visibleRange.value
    // Force a fresh object even when start/end are unchanged: a height measurement
    // can shift pixel offsets for the same set of visible indices, and consumers'
    // per-row `top` styles are derived reactively from visibleRange.
    if (force || cur.start !== start || cur.end !== end) visibleRange.value = { start, end }
    totalHeight.value = manager.totalSize
  }

  function scheduleRecalc(force = false): void {
    pendingForce = pendingForce || force
    if (rafId !== null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      const f = pendingForce
      pendingForce = false
      recalcVisibleRange(f)
    })
  }

  function updateBlur(): void {
    if (!getMotionBlur()) return
    const { scrollTop } = getScrollMetrics()
    const now = performance.now()
    if (lastVelocityScrollTop !== null) {
      const dt = now - lastVelocityTime
      if (dt > 0) {
        const velocity = (scrollTop - lastVelocityScrollTop) / dt
        blurAmount.value = computeBlurAmount(velocity)
      }
    }
    lastVelocityScrollTop = scrollTop
    lastVelocityTime = now

    if (blurClearTimer !== null) clearTimeout(blurClearTimer)
    blurClearTimer = setTimeout(() => {
      blurClearTimer = null
      lastVelocityScrollTop = null
      blurAmount.value = 0
    }, BLUR_CLEAR_DELAY_MS)
  }

  function onScroll(): void {
    updateBlur()
    scheduleRecalc()
  }

  function flushMeasurements(): void {
    measureTimer = null
    const startIdx = visibleRange.value.start
    let deltaAbove = 0
    for (const { index, height } of pendingMeasurements) {
      if (index < startIdx) deltaAbove += height - manager.getHeight(index)
      manager.set(index, height)
    }
    pendingMeasurements = []

    // Anchor compensation: if rows above the current viewport changed height,
    // shift the scroll position by the same delta so on-screen content doesn't jump.
    // Skipped while a smooth scroll is likely in flight (see smoothScrollGuardUntil).
    if (deltaAbove !== 0 && performance.now() >= smoothScrollGuardUntil) {
      if (pageMode) {
        window.scrollBy({ top: deltaAbove, behavior: 'auto' })
      } else {
        const el = getScrollElement()
        if (el) {
          if (horizontal) setNormalizedScrollLeft(el, normalizeScrollLeft(el) + deltaAbove)
          else el.scrollTop += deltaAbove
        }
      }
    }

    scheduleRecalc(true)
  }

  function measureItem(index: number, height: number): void {
    pendingMeasurements.push({ index, height })
    if (measureTimer === null) measureTimer = setTimeout(flushMeasurements, 10)
  }

  function offsetTop(index: number): number {
    return manager.getOffset(index)
  }

  function scrollToOffset(offset: number, scrollOptions: ScrollBehaviorOptions = {}): void {
    const behavior = scrollOptions.behavior ?? 'auto'
    if (behavior === 'smooth') {
      smoothScrollGuardUntil = performance.now() + SMOOTH_SCROLL_GUARD_MS
    }
    if (pageMode) {
      const container = getScrollElement()
      const containerTop = container ? container.getBoundingClientRect().top + window.scrollY : 0
      window.scrollTo({ top: containerTop + offset, behavior })
    } else {
      const el = getScrollElement()
      if (!el) return
      if (horizontal) el.scrollTo({ left: rawScrollLeftFor(el, offset), behavior })
      else el.scrollTo({ top: offset, behavior })
    }
  }

  function scrollTo(
    index: number,
    align: ScrollAlign = 'start',
    scrollOptions: ScrollBehaviorOptions = {},
  ): void {
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
    scrollToOffset(Math.max(0, targetOffset), scrollOptions)
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

  function onResize(): void {
    scheduleRecalc()
  }

  onMounted(() => {
    if (pageMode) {
      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('resize', onResize)
    } else {
      const el = getScrollElement()
      if (el) {
        el.addEventListener('scroll', onScroll, { passive: true })
        if (typeof ResizeObserver !== 'undefined') {
          viewportRO = new ResizeObserver(() => scheduleRecalc())
          viewportRO.observe(el)
        }
      }
    }
    recalcVisibleRange()
  })

  onUnmounted(() => {
    if (pageMode) {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    } else {
      const el = getScrollElement()
      if (el) el.removeEventListener('scroll', onScroll)
    }
    viewportRO?.disconnect()
    viewportRO = null
    if (rafId !== null) cancelAnimationFrame(rafId)
    if (measureTimer !== null) clearTimeout(measureTimer)
    if (blurClearTimer !== null) clearTimeout(blurClearTimer)
  })

  return {
    visibleRange: visibleRange as Readonly<Ref<VisibleRange>>,
    totalHeight: totalHeight as Readonly<Ref<number>>,
    offsetTop,
    scrollTo,
    scrollToOffset,
    measureItem,
    handleScroll: onScroll,
    blurAmount: blurAmount as Readonly<Ref<number>>,
  }
}
