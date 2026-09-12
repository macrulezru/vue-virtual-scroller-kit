import { describe, it, expect, vi, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import InfiniteLoader from '../components/InfiniteLoader.vue'
import { flushRAF } from './setup'

type Item = { id: number; label: string }

function makeItems(n: number): Item[] {
  return Array.from({ length: n }, (_, i) => ({ id: i, label: `Item ${i}` }))
}

function defineScrollGeometry(
  el: HTMLElement,
  geo: { scrollTop: number; scrollHeight: number; clientHeight: number },
): void {
  Object.defineProperty(el, 'scrollTop', {
    value: geo.scrollTop,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(el, 'scrollHeight', {
    value: geo.scrollHeight,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(el, 'clientHeight', {
    value: geo.clientHeight,
    writable: true,
    configurable: true,
  })
}

async function fireScroll(el: HTMLElement): Promise<void> {
  el.dispatchEvent(new Event('scroll'))
  await vi.advanceTimersByTimeAsync(60) // past the 50ms onScroll debounce
}

// Every mount runs an "initial check in case items don't fill the viewport" pass
// (InfiniteLoader.vue's onMounted) against jsdom's default zero scrollHeight/
// clientHeight — which itself satisfies the "near the bottom" threshold and can
// call onLoadMore once before a test sets up its real geometry. mockClear() right
// after mount isolates each test's assertions from that unrelated initial call.
async function mountAndSettle(
  onLoadMore: Mock<[], Promise<void>>,
  props: { isLoading: boolean; hasMore: boolean; direction?: 'down' | 'up' | 'both' },
) {
  const wrapper = mount(InfiniteLoader, {
    props: { items: makeItems(50), onLoadMore, threshold: 200, ...props },
    slots: { default: '<div>{{ params.item.label }}</div>' },
  })
  await nextTick()
  onLoadMore.mockClear()
  const container = wrapper.find('.vvsk-infinite-loader').element as HTMLElement
  return { wrapper, container }
}

describe('InfiniteLoader threshold math', () => {
  it('calls onLoadMore once scrolled within `threshold` of the bottom (direction="down")', async () => {
    vi.useFakeTimers()
    const onLoadMore = vi.fn().mockResolvedValue(undefined)
    const { container } = await mountAndSettle(onLoadMore, { isLoading: false, hasMore: true })
    // distanceFromBottom = 2000 - 1800 - 100 = 100 <= threshold(200)
    defineScrollGeometry(container, { scrollTop: 1800, scrollHeight: 2000, clientHeight: 100 })

    await fireScroll(container)

    expect(onLoadMore).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('does not call onLoadMore while still far from the bottom', async () => {
    vi.useFakeTimers()
    const onLoadMore = vi.fn().mockResolvedValue(undefined)
    const { container } = await mountAndSettle(onLoadMore, { isLoading: false, hasMore: true })
    // distanceFromBottom = 2000 - 500 - 100 = 1400 > threshold(200)
    defineScrollGeometry(container, { scrollTop: 500, scrollHeight: 2000, clientHeight: 100 })

    await fireScroll(container)

    expect(onLoadMore).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('does not call onLoadMore when hasMore is false, even near the bottom', async () => {
    vi.useFakeTimers()
    const onLoadMore = vi.fn().mockResolvedValue(undefined)
    const { container } = await mountAndSettle(onLoadMore, { isLoading: false, hasMore: false })
    defineScrollGeometry(container, { scrollTop: 1800, scrollHeight: 2000, clientHeight: 100 })

    await fireScroll(container)

    expect(onLoadMore).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('does not call onLoadMore while isLoading is already true', async () => {
    vi.useFakeTimers()
    const onLoadMore = vi.fn().mockResolvedValue(undefined)
    const { container } = await mountAndSettle(onLoadMore, { isLoading: true, hasMore: true })
    defineScrollGeometry(container, { scrollTop: 1800, scrollHeight: 2000, clientHeight: 100 })

    await fireScroll(container)

    expect(onLoadMore).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('InfiniteLoader concurrent-load guard', () => {
  it('does not call onLoadMore a second time while the first call is still pending', async () => {
    vi.useFakeTimers()
    let resolveLoad: () => void = () => {}
    let calls = 0
    const onLoadMore = vi.fn(() => {
      calls++
      // The mount-time automatic check (call #1) resolves immediately, same as every
      // other test's mock — only the deliberate call under test (#2) hangs, so this
      // test isolates the guard behavior instead of also depending on that call.
      if (calls === 1) return Promise.resolve()
      return new Promise<void>((resolve) => {
        resolveLoad = resolve
      })
    })
    const { container } = await mountAndSettle(onLoadMore, { isLoading: false, hasMore: true })
    defineScrollGeometry(container, { scrollTop: 1800, scrollHeight: 2000, clientHeight: 100 })

    await fireScroll(container) // triggers the first, still-pending call
    expect(onLoadMore).toHaveBeenCalledTimes(1)

    await fireScroll(container) // fires again while the first is unresolved
    expect(onLoadMore).toHaveBeenCalledTimes(1)

    resolveLoad()
    await nextTick()
    vi.useRealTimers()
  })
})

describe('InfiniteLoader up-direction and scroll-position preservation', () => {
  it('calls onLoadMore when scrolled within `threshold` of the top (direction="up")', async () => {
    vi.useFakeTimers()
    const onLoadMore = vi.fn().mockResolvedValue(undefined)
    const { container } = await mountAndSettle(onLoadMore, {
      isLoading: false,
      hasMore: true,
      direction: 'up',
    })
    defineScrollGeometry(container, { scrollTop: 50, scrollHeight: 2000, clientHeight: 100 })

    await fireScroll(container)

    expect(onLoadMore).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('restores scroll position after an "up" load grows scrollHeight (prepend)', async () => {
    // Regression coverage for the prepend scroll-position-preservation math:
    // newScrollTop = savedScrollTop + (newScrollHeight - savedScrollHeight).
    vi.useFakeTimers()
    const ref: { container?: HTMLElement } = {}
    const onLoadMore = vi.fn(async () => {
      // Guards the mount-time automatic check, which fires before `ref.container` is
      // assigned below — this test only cares about the load triggered afterward.
      if (!ref.container) return
      // Simulate 15 prepended rows growing scrollHeight by 300px before onLoadMore resolves.
      defineScrollGeometry(ref.container, { scrollTop: 50, scrollHeight: 2300, clientHeight: 100 })
    })
    const { container } = await mountAndSettle(onLoadMore, {
      isLoading: false,
      hasMore: true,
      direction: 'up',
    })
    ref.container = container
    defineScrollGeometry(container, { scrollTop: 50, scrollHeight: 2000, clientHeight: 100 })

    await fireScroll(container)
    await nextTick()
    flushRAF()

    expect(container.scrollTop).toBe(50 + (2300 - 2000))
    vi.useRealTimers()
  })
})

describe('InfiniteLoader "both" direction and re-check on isLoading transition', () => {
  it('checks both top and bottom thresholds when direction="both"', async () => {
    vi.useFakeTimers()
    const onLoadMore = vi.fn().mockResolvedValue(undefined)
    const { container } = await mountAndSettle(onLoadMore, {
      isLoading: false,
      hasMore: true,
      direction: 'both',
    })
    // Near top this time.
    defineScrollGeometry(container, { scrollTop: 10, scrollHeight: 2000, clientHeight: 100 })

    await fireScroll(container)

    expect(onLoadMore).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('re-checks the threshold once isLoading flips back to false', async () => {
    // Regression: without the isLoading watcher, items that arrive but still leave the
    // viewport under-filled (or near the edge) would never trigger a follow-up load.
    vi.useFakeTimers()
    const onLoadMore = vi.fn().mockResolvedValue(undefined)
    const { wrapper, container } = await mountAndSettle(onLoadMore, {
      isLoading: true,
      hasMore: true,
    })
    defineScrollGeometry(container, { scrollTop: 1800, scrollHeight: 2000, clientHeight: 100 })

    await wrapper.setProps({ isLoading: false })
    await nextTick()

    expect(onLoadMore).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
