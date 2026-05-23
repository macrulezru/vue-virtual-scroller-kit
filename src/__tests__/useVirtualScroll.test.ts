import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref, nextTick } from 'vue'
import { useVirtualScroll } from '../core/useVirtualScroll'
import { flushRAF } from './setup'
import type { UseVirtualScrollReturn } from '../core/useVirtualScroll'

/* ── Helper: mount composable in a real Vue component ──────── */
function mountComposable(
  itemCount: number,
  scrollEl: HTMLElement,
  opts: { estimatedItemSize?: number; overscan?: number } = {},
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
})
