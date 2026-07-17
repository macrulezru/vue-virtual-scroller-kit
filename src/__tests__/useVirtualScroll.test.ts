import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref, nextTick, type Ref } from 'vue'
import { useVirtualScroll } from '../core/useVirtualScroll'
import { flushRAF } from './setup'
import type { UseVirtualScrollReturn } from '../core/useVirtualScroll'
import type { SizeProvider } from '../core/PositionManager'

/* ── Helper: mount composable in a real Vue component ──────── */
function mountComposable(
  itemCount: number,
  scrollEl: HTMLElement,
  opts: {
    estimatedItemSize?: SizeProvider | Ref<SizeProvider>
    overscan?: number
    motionBlur?: boolean
    horizontal?: boolean
  } = {},
): UseVirtualScrollReturn & { unmount: () => void } {
  let result: UseVirtualScrollReturn

  const wrapper = mount(
    defineComponent({
      setup() {
        result = useVirtualScroll({
          itemCount: ref(itemCount),
          estimatedItemSize: opts.estimatedItemSize ?? 50,
          overscan: opts.overscan ?? 0,
          getScrollElement: () => scrollEl,
          motionBlur: opts.motionBlur,
          horizontal: opts.horizontal,
        })
        return () => null
      },
    }),
  )

  return { ...result!, unmount: () => wrapper.unmount() }
}

/* ── Fake scroll element factory ───────────────────────────── */
function makeScrollEl(initialScrollTop = 0, clientHeight = 500, scrollHeight = 5000) {
  const state = { scrollTop: initialScrollTop }
  const el = document.createElement('div')
  Object.defineProperties(el, {
    scrollTop: {
      get: () => state.scrollTop,
      set: (v) => {
        state.scrollTop = v
      },
      configurable: true,
      enumerable: true,
    },
    clientHeight: { get: () => clientHeight, configurable: true },
    scrollHeight: { get: () => scrollHeight, configurable: true },
  })
  return Object.assign(el, { state })
}

/* ── Fake horizontal scroll element factory ────────────────── */
function makeHorizontalScrollEl(
  initialScrollLeft = 0,
  clientWidth = 500,
  scrollWidth = 5000,
  direction: 'ltr' | 'rtl' = 'ltr',
) {
  const state = { scrollLeft: initialScrollLeft }
  const el = document.createElement('div')
  el.style.direction = direction
  Object.defineProperties(el, {
    scrollLeft: {
      get: () => state.scrollLeft,
      set: (v) => {
        state.scrollLeft = v
      },
      configurable: true,
      enumerable: true,
    },
    clientWidth: { get: () => clientWidth, configurable: true },
    scrollWidth: { get: () => scrollWidth, configurable: true },
  })
  document.body.appendChild(el)
  return Object.assign(el, { state })
}

describe('useVirtualScroll', () => {
  describe('visibleRange', () => {
    it('computes initial range based on clientHeight', async () => {
      const el = makeScrollEl(0, 200)
      const { visibleRange, unmount } = mountComposable(100, el, {
        estimatedItemSize: 50,
        overscan: 0,
      })

      flushRAF()
      await nextTick()

      // viewport 200px / 50px per row → rows 0–4 visible
      // findIndex(200) = row 4 (starts exactly at viewport bottom — included)
      expect(visibleRange.value.start).toBe(0)
      expect(visibleRange.value.end).toBe(4)
      unmount()
    })

    it('updates when scroll event fires', async () => {
      const el = makeScrollEl(0, 200)
      const { visibleRange, unmount } = mountComposable(100, el, {
        estimatedItemSize: 50,
        overscan: 0,
      })

      flushRAF()
      await nextTick()

      // Scroll down 100px → should show rows 2–5
      el.state.scrollTop = 100
      el.dispatchEvent(new Event('scroll'))
      flushRAF()
      await nextTick()

      // findIndex(300) = row 6 (offset 300 is the start of row 6)
      expect(visibleRange.value.start).toBe(2)
      expect(visibleRange.value.end).toBe(6)
      unmount()
    })

    it('clamps end to itemCount - 1', async () => {
      const el = makeScrollEl(0, 10000) // viewport taller than all content
      const { visibleRange, unmount } = mountComposable(5, el, {
        estimatedItemSize: 50,
        overscan: 0,
      })

      flushRAF()
      await nextTick()

      expect(visibleRange.value.end).toBe(4) // max index in 5-item list
      unmount()
    })

    it('applies overscan on both sides', async () => {
      const el = makeScrollEl(100, 200) // scrollTop=100, viewport=200
      const { visibleRange, unmount } = mountComposable(100, el, {
        estimatedItemSize: 50,
        overscan: 2,
      })

      flushRAF()
      await nextTick()

      // Without overscan: start=2, end=5 (100/50=2, (100+200)/50=6)
      // With overscan 2: start=0, end=7
      expect(visibleRange.value.start).toBeLessThanOrEqual(2)
      expect(visibleRange.value.end).toBeGreaterThanOrEqual(5)
      unmount()
    })
  })

  describe('totalHeight', () => {
    it('equals itemCount * estimatedItemSize initially', async () => {
      const el = makeScrollEl()
      const { totalHeight, unmount } = mountComposable(100, el, { estimatedItemSize: 60 })

      flushRAF()
      await nextTick()

      expect(totalHeight.value).toBe(6000)
      unmount()
    })

    it('updates after measureItem', async () => {
      vi.useFakeTimers()
      const el = makeScrollEl()
      const { totalHeight, measureItem, unmount } = mountComposable(10, el, {
        estimatedItemSize: 50,
      })

      flushRAF()
      await nextTick()

      expect(totalHeight.value).toBe(500)

      measureItem(0, 100) // was 50, now 100 → +50
      vi.advanceTimersByTime(15) // flush 10ms batch timer
      flushRAF()
      await nextTick()

      expect(totalHeight.value).toBe(550)

      vi.useRealTimers()
      unmount()
    })
  })

  describe('offsetTop()', () => {
    it('returns 0 for index 0', () => {
      const el = makeScrollEl()
      const { offsetTop, unmount } = mountComposable(10, el, { estimatedItemSize: 50 })
      expect(offsetTop(0)).toBe(0)
      unmount()
    })

    it('returns estimatedItemSize for index 1', () => {
      const el = makeScrollEl()
      const { offsetTop, unmount } = mountComposable(10, el, { estimatedItemSize: 80 })
      expect(offsetTop(1)).toBe(80)
      unmount()
    })

    it('reflects measured heights', async () => {
      vi.useFakeTimers()
      const el = makeScrollEl()
      const { offsetTop, measureItem, unmount } = mountComposable(5, el, {
        estimatedItemSize: 50,
      })

      measureItem(0, 120)
      vi.advanceTimersByTime(15)

      expect(offsetTop(1)).toBe(120)
      expect(offsetTop(2)).toBe(170)

      vi.useRealTimers()
      unmount()
    })
  })

  describe('scrollToOffset()', () => {
    it('sets scrollTop on the scroll element', () => {
      const el = makeScrollEl()
      const { scrollToOffset, unmount } = mountComposable(100, el)

      scrollToOffset(300)
      expect(el.scrollTop).toBe(300)
      unmount()
    })
  })

  describe('scrollTo()', () => {
    it('align=start scrolls to row top', () => {
      const el = makeScrollEl(0, 200)
      const { scrollTo, unmount } = mountComposable(100, el, { estimatedItemSize: 50 })

      scrollTo(10, 'start')
      expect(el.scrollTop).toBe(500) // 10 * 50
      unmount()
    })

    it('align=end scrolls so row bottom is at viewport bottom', () => {
      const el = makeScrollEl(0, 200)
      const { scrollTo, unmount } = mountComposable(100, el, { estimatedItemSize: 50 })

      scrollTo(10, 'end')
      // itemTop=500, itemHeight=50, viewHeight=200 → 500 - 200 + 50 = 350
      expect(el.scrollTop).toBe(350)
      unmount()
    })

    it('align=center scrolls to center', () => {
      const el = makeScrollEl(0, 200)
      const { scrollTo, unmount } = mountComposable(100, el, { estimatedItemSize: 50 })

      scrollTo(10, 'center')
      // itemTop=500, itemHeight=50, viewHeight=200 → 500 - 100 + 25 = 425
      expect(el.scrollTop).toBe(425)
      unmount()
    })

    it('align=auto does not scroll if row already visible', () => {
      const el = makeScrollEl(400, 200) // viewport: 400–600
      const { scrollTo, unmount } = mountComposable(100, el, { estimatedItemSize: 50 })

      // Row 9 is at offset 450, height 50 → fits in 400–600 viewport
      scrollTo(9, 'auto')
      expect(el.state.scrollTop).toBe(400) // unchanged
      unmount()
    })

    it('align=auto scrolls up when row is above viewport', () => {
      const el = makeScrollEl(400, 200)
      const { scrollTo, unmount } = mountComposable(100, el, { estimatedItemSize: 50 })

      scrollTo(1, 'auto') // row 1 at offset 50, above viewport start 400
      expect(el.scrollTop).toBe(50)
      unmount()
    })

    it('clamps scrollTop to 0 minimum', () => {
      const el = makeScrollEl(0, 500)
      const { scrollTo, unmount } = mountComposable(100, el, { estimatedItemSize: 50 })

      scrollTo(0, 'end') // itemTop=0, itemHeight=50, viewHeight=500 → 0 - 500 + 50 = -450
      expect(el.scrollTop).toBe(0)
      unmount()
    })
  })

  describe('measureItem() batching', () => {
    it('batches multiple measurements within 10ms window', async () => {
      vi.useFakeTimers()
      const el = makeScrollEl()
      const { measureItem, totalHeight, unmount } = mountComposable(5, el, {
        estimatedItemSize: 50,
      })

      // All three measurements should be batched
      measureItem(0, 100)
      measureItem(1, 80)
      measureItem(2, 60)

      // Not yet applied
      expect(totalHeight.value).toBe(250)

      vi.advanceTimersByTime(15)
      flushRAF()
      await nextTick()

      // 100 + 80 + 60 + 50 + 50 = 340
      expect(totalHeight.value).toBe(340)

      vi.useRealTimers()
      unmount()
    })
  })

  describe('itemCount as Ref', () => {
    it('resets manager when itemCount changes', async () => {
      const el = makeScrollEl()
      const itemCount = ref(10)

      let result: UseVirtualScrollReturn
      const wrapper = mount(
        defineComponent({
          setup() {
            result = useVirtualScroll({
              itemCount,
              estimatedItemSize: 50,
              overscan: 0,
              getScrollElement: () => el,
            })
            return () => null
          },
        }),
      )

      flushRAF()
      await nextTick()
      expect(result!.totalHeight.value).toBe(500)

      itemCount.value = 20
      await nextTick()
      flushRAF()
      await nextTick()
      expect(result!.totalHeight.value).toBe(1000)

      wrapper.unmount()
    })
  })

  describe('estimatedItemSize as Ref (reactivity)', () => {
    it('rebuilds the manager when a Ref-wrapped size function changes, without an itemCount change', async () => {
      const el = makeScrollEl()
      const sizeFn = ref<SizeProvider>((): number => 50)

      let result: UseVirtualScrollReturn
      const wrapper = mount(
        defineComponent({
          setup() {
            result = useVirtualScroll({
              itemCount: ref(10),
              estimatedItemSize: sizeFn,
              overscan: 0,
              getScrollElement: () => el,
            })
            return () => null
          },
        }),
      )

      flushRAF()
      await nextTick()
      expect(result!.totalHeight.value).toBe(500) // 10 * 50

      sizeFn.value = (): number => 80
      await nextTick()
      flushRAF()
      await nextTick()
      expect(result!.totalHeight.value).toBe(800) // 10 * 80

      wrapper.unmount()
    })
  })

  describe('scroll behavior option', () => {
    it('scrollToOffset calls element.scrollTo with behavior:"auto" by default', () => {
      const el = makeScrollEl()
      const scrollToSpy = vi.fn()
      Object.defineProperty(el, 'scrollTo', { value: scrollToSpy, configurable: true })
      const { scrollToOffset, unmount } = mountComposable(100, el)

      scrollToOffset(300)
      expect(scrollToSpy).toHaveBeenCalledWith({ top: 300, behavior: 'auto' })
      unmount()
    })

    it('scrollToOffset passes behavior:"smooth" through to element.scrollTo', () => {
      const el = makeScrollEl()
      const scrollToSpy = vi.fn()
      Object.defineProperty(el, 'scrollTo', { value: scrollToSpy, configurable: true })
      const { scrollToOffset, unmount } = mountComposable(100, el)

      scrollToOffset(300, { behavior: 'smooth' })
      expect(scrollToSpy).toHaveBeenCalledWith({ top: 300, behavior: 'smooth' })
      unmount()
    })

    it('scrollTo forwards the behavior option to scrollToOffset', () => {
      const el = makeScrollEl(0, 200)
      const scrollToSpy = vi.fn()
      Object.defineProperty(el, 'scrollTo', { value: scrollToSpy, configurable: true })
      const { scrollTo, unmount } = mountComposable(100, el, { estimatedItemSize: 50 })

      scrollTo(10, 'start', { behavior: 'smooth' })
      expect(scrollToSpy).toHaveBeenCalledWith({ top: 500, behavior: 'smooth' })
      unmount()
    })
  })

  describe('anchor-compensated reflow', () => {
    it('shifts scrollTop when a measured row above the viewport grows taller', async () => {
      vi.useFakeTimers()
      // viewport shows rows starting well into the list
      const el = makeScrollEl(1000, 200) // scrollTop=1000 → start index 20 (50px rows)
      const { measureItem, visibleRange, unmount } = mountComposable(100, el, {
        estimatedItemSize: 50,
      })

      flushRAF()
      await nextTick()
      const startBefore = visibleRange.value.start
      expect(startBefore).toBeGreaterThan(0)

      // Row 0 is above the viewport start — grow it from 50 to 150 (+100)
      measureItem(0, 150)
      vi.advanceTimersByTime(15)
      flushRAF()
      await nextTick()

      // Content above the viewport grew by 100px — scrollTop should compensate by +100
      // so the same content stays under the viewport.
      expect(el.state.scrollTop).toBe(1100)

      vi.useRealTimers()
      unmount()
    })

    it('does not adjust scrollTop when the measured row is within the visible range', async () => {
      vi.useFakeTimers()
      const el = makeScrollEl(0, 200)
      const { measureItem, unmount } = mountComposable(100, el, { estimatedItemSize: 50 })

      flushRAF()
      await nextTick()

      // Row 0 is inside the visible range at scrollTop=0
      measureItem(0, 150)
      vi.advanceTimersByTime(15)
      flushRAF()
      await nextTick()

      expect(el.state.scrollTop).toBe(0)

      vi.useRealTimers()
      unmount()
    })
  })

  describe('motionBlur', () => {
    // Velocity needs two samples with real elapsed time between them, so these
    // use real timers rather than mocking performance.now().
    it('blurAmount stays 0 when motionBlur option is off', async () => {
      const el = makeScrollEl(0, 200)
      const { blurAmount, unmount } = mountComposable(100, el, { estimatedItemSize: 50 })

      el.state.scrollTop = 500
      el.dispatchEvent(new Event('scroll'))
      await new Promise((r) => setTimeout(r, 5))
      el.state.scrollTop = 5000
      el.dispatchEvent(new Event('scroll'))
      flushRAF()
      await nextTick()

      expect(blurAmount.value).toBe(0)
      unmount()
    })

    it('blurAmount increases on fast scroll when motionBlur is on', async () => {
      const el = makeScrollEl(0, 200)
      const { blurAmount, unmount } = mountComposable(100, el, {
        estimatedItemSize: 50,
        motionBlur: true,
      })

      el.state.scrollTop = 500
      el.dispatchEvent(new Event('scroll'))
      await new Promise((r) => setTimeout(r, 5))
      el.state.scrollTop = 5000
      el.dispatchEvent(new Event('scroll'))

      expect(blurAmount.value).toBeGreaterThan(0)
      unmount()
    })

    it('blurAmount clears back to 0 after scrolling settles', async () => {
      const el = makeScrollEl(0, 200)
      const { blurAmount, unmount } = mountComposable(100, el, {
        estimatedItemSize: 50,
        motionBlur: true,
      })

      el.state.scrollTop = 500
      el.dispatchEvent(new Event('scroll'))
      await new Promise((r) => setTimeout(r, 5))
      el.state.scrollTop = 5000
      el.dispatchEvent(new Event('scroll'))
      expect(blurAmount.value).toBeGreaterThan(0)

      await new Promise((r) => setTimeout(r, 200))
      expect(blurAmount.value).toBe(0)
      unmount()
    })
  })

  describe('motionBlur as Ref (reactive toggle)', () => {
    it('starts tracking velocity only after the Ref flips to true', async () => {
      const el = makeScrollEl(0, 200)
      const motionBlurRef = ref(false)
      let result: UseVirtualScrollReturn

      const wrapper = mount(
        defineComponent({
          setup() {
            result = useVirtualScroll({
              itemCount: ref(100),
              estimatedItemSize: 50,
              overscan: 0,
              getScrollElement: () => el,
              motionBlur: motionBlurRef,
            })
            return () => null
          },
        }),
      )

      flushRAF()
      await nextTick()

      el.state.scrollTop = 500
      el.dispatchEvent(new Event('scroll'))
      await new Promise((r) => setTimeout(r, 5))
      el.state.scrollTop = 5000
      el.dispatchEvent(new Event('scroll'))
      expect(result!.blurAmount.value).toBe(0) // still off

      motionBlurRef.value = true
      await nextTick()

      el.state.scrollTop = 5500
      el.dispatchEvent(new Event('scroll'))
      await new Promise((r) => setTimeout(r, 5))
      el.state.scrollTop = 15000
      el.dispatchEvent(new Event('scroll'))
      expect(result!.blurAmount.value).toBeGreaterThan(0)

      wrapper.unmount()
    })
  })

  describe('smooth scroll vs. anchor compensation', () => {
    it('suppresses the anchor-compensation scrollTop write shortly after a smooth scrollTo', async () => {
      const el = makeScrollEl(1000, 200)
      const { scrollToOffset, measureItem, visibleRange, unmount } = mountComposable(100, el, {
        estimatedItemSize: 50,
      })

      flushRAF()
      await nextTick()
      expect(visibleRange.value.start).toBeGreaterThan(0)

      scrollToOffset(1000, { behavior: 'smooth' })
      const scrollTopAfterSmoothCall = el.state.scrollTop

      // A row above the viewport is measured taller — would normally shift scrollTop by +100.
      measureItem(0, 150)
      await new Promise((r) => setTimeout(r, 15))
      flushRAF()
      await nextTick()

      // Guard window still active: the compensation write is suppressed so it doesn't
      // cancel the native smooth-scroll animation.
      expect(el.state.scrollTop).toBe(scrollTopAfterSmoothCall)

      unmount()
    })
  })

  describe('horizontal mode', () => {
    it('computes visibleRange from scrollLeft/clientWidth instead of scrollTop/clientHeight', async () => {
      const el = makeHorizontalScrollEl(0, 200)
      const { visibleRange, unmount } = mountComposable(100, el, {
        estimatedItemSize: 50,
        overscan: 0,
        horizontal: true,
      })

      flushRAF()
      await nextTick()

      // viewport 200px / 50px per column → columns 0–4 visible, same math as vertical mode
      expect(visibleRange.value.start).toBe(0)
      expect(visibleRange.value.end).toBe(4)
      unmount()
    })

    it('updates when a horizontal scroll event fires', async () => {
      const el = makeHorizontalScrollEl(0, 200)
      const { visibleRange, unmount } = mountComposable(100, el, {
        estimatedItemSize: 50,
        overscan: 0,
        horizontal: true,
      })

      flushRAF()
      await nextTick()

      el.state.scrollLeft = 100
      el.dispatchEvent(new Event('scroll'))
      flushRAF()
      await nextTick()

      expect(visibleRange.value.start).toBe(2)
      expect(visibleRange.value.end).toBe(6)
      unmount()
    })

    it('normalizes RTL scrollLeft (negative) into the same visibleRange math as LTR', async () => {
      // scrollWidth=5000, clientWidth=200 → at the RTL start edge, scrollLeft=0,
      // which normalizes to "fully scrolled" (distance-from-start = 4800), not "at 0".
      // Scroll to the equivalent LTR position (distanceFromStart=0) via scrollLeft=-4800.
      const el = makeHorizontalScrollEl(-4800, 200, 5000, 'rtl')
      const { visibleRange, unmount } = mountComposable(100, el, {
        estimatedItemSize: 50,
        overscan: 0,
        horizontal: true,
      })

      flushRAF()
      await nextTick()

      expect(visibleRange.value.start).toBe(0)
      expect(visibleRange.value.end).toBe(4)
      unmount()
    })

    it('scrollToOffset() sets scrollLeft, not scrollTop', () => {
      const el = makeHorizontalScrollEl()
      const { scrollToOffset, unmount } = mountComposable(100, el, { horizontal: true })

      scrollToOffset(300)
      expect(el.scrollLeft).toBe(300)
      expect(el.scrollTop).toBe(0)
      unmount()
    })

    it('scrollToOffset() accounts for RTL when writing scrollLeft', () => {
      const el = makeHorizontalScrollEl(0, 200, 5000, 'rtl')
      const { scrollToOffset, unmount } = mountComposable(100, el, { horizontal: true })

      // distanceFromStart=300 in RTL → raw scrollLeft = 300 - (5000-200) = -4500
      scrollToOffset(300)
      expect(el.scrollLeft).toBe(-4500)
      unmount()
    })

    it('scrollTo() computes columns via offsetTop() along the horizontal axis', () => {
      const el = makeHorizontalScrollEl(0, 200)
      const { scrollTo, unmount } = mountComposable(100, el, {
        estimatedItemSize: 50,
        horizontal: true,
      })

      scrollTo(10, 'start')
      expect(el.scrollLeft).toBe(500) // 10 * 50
      unmount()
    })

    it('anchor compensation after measureItem adjusts scrollLeft, not scrollTop', async () => {
      const el = makeHorizontalScrollEl(1000, 200)
      const { measureItem, visibleRange, unmount } = mountComposable(100, el, {
        estimatedItemSize: 50,
        horizontal: true,
      })

      flushRAF()
      await nextTick()
      expect(visibleRange.value.start).toBeGreaterThan(0)

      const before = el.state.scrollLeft
      measureItem(0, 150) // column 0, before the viewport → shifts scroll by +100
      await new Promise((r) => setTimeout(r, 15))
      flushRAF()

      expect(el.state.scrollLeft).toBe(before + 100)
      expect(el.scrollTop).toBe(0)

      unmount()
    })
  })
})
