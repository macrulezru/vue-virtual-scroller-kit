import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { useVisibilityTracker } from '../composables/useVisibilityTracker'
import type {
  UseVisibilityTrackerOptions,
  UseVisibilityTrackerReturn,
} from '../composables/useVisibilityTracker'
import { flushRAF, IntersectionObserverMock } from './setup'

function mountTracker(
  options: UseVisibilityTrackerOptions = {},
): UseVisibilityTrackerReturn & { unmount: () => void } {
  let result: UseVisibilityTrackerReturn

  const wrapper = mount(
    defineComponent({
      setup() {
        result = useVisibilityTracker(options)
        return () => null
      },
    }),
  )

  return { ...result!, unmount: () => wrapper.unmount() }
}

function fakeEl(): HTMLElement {
  return document.createElement('div')
}

describe('useVisibilityTracker', () => {
  it('has no visible keys initially', () => {
    const { visibleKeys, isVisible, unmount } = mountTracker()
    expect(visibleKeys.value.size).toBe(0)
    expect(isVisible('a')).toBe(false)
    unmount()
  })

  it('builds an IntersectionObserver against the viewport (root: null) when no root option is given', () => {
    const el = fakeEl()
    const { observe, unmount } = mountTracker()
    observe(el, 'a')

    expect(IntersectionObserverMock.instances.length).toBe(1)
    expect(IntersectionObserverMock.instances[0]!.root).toBeNull()
    unmount()
  })

  it('marks a key visible when the observer reports isIntersecting: true', () => {
    const onVisible = vi.fn()
    const el = fakeEl()
    const { observe, isVisible, visibleKeys, unmount } = mountTracker({ onVisible })
    observe(el, 'row-1')

    const observer = IntersectionObserverMock.instances[0]!
    observer.trigger([{ target: el, isIntersecting: true }])

    expect(isVisible('row-1')).toBe(true)
    expect(visibleKeys.value.has('row-1')).toBe(true)
    expect(onVisible).toHaveBeenCalledWith('row-1')
    unmount()
  })

  it('marks a key hidden when the observer reports isIntersecting: false', () => {
    const onHidden = vi.fn()
    const el = fakeEl()
    const { observe, isVisible, unmount } = mountTracker({ onHidden })
    observe(el, 'row-1')

    const observer = IntersectionObserverMock.instances[0]!
    observer.trigger([{ target: el, isIntersecting: true }])
    observer.trigger([{ target: el, isIntersecting: false }])

    expect(isVisible('row-1')).toBe(false)
    expect(onHidden).toHaveBeenCalledWith('row-1')
    unmount()
  })

  it('does not re-fire onVisible/onHidden for a state that has not changed', () => {
    const onVisible = vi.fn()
    const el = fakeEl()
    const { observe, unmount } = mountTracker({ onVisible })
    observe(el, 'row-1')

    const observer = IntersectionObserverMock.instances[0]!
    observer.trigger([{ target: el, isIntersecting: true }])
    observer.trigger([{ target: el, isIntersecting: true }])

    expect(onVisible).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('tracks multiple keys independently', () => {
    const elA = fakeEl()
    const elB = fakeEl()
    const { observe, isVisible, unmount } = mountTracker()
    observe(elA, 'a')
    observe(elB, 'b')

    const observer = IntersectionObserverMock.instances[0]!
    observer.trigger([
      { target: elA, isIntersecting: true },
      { target: elB, isIntersecting: false },
    ])

    expect(isVisible('a')).toBe(true)
    expect(isVisible('b')).toBe(false)
    unmount()
  })

  it('unobserve() stops tracking and fires onHidden if the key was visible', () => {
    const onHidden = vi.fn()
    const el = fakeEl()
    const { observe, unobserve, isVisible, unmount } = mountTracker({ onHidden })
    observe(el, 'row-1')
    IntersectionObserverMock.instances[0]!.trigger([{ target: el, isIntersecting: true }])

    unobserve('row-1')

    expect(isVisible('row-1')).toBe(false)
    expect(onHidden).toHaveBeenCalledWith('row-1')
    expect(IntersectionObserverMock.instances[0]!.unobserve).toHaveBeenCalledWith(el)
    unmount()
  })

  it('unobserve() on a never-visible key does not fire onHidden', () => {
    const onHidden = vi.fn()
    const el = fakeEl()
    const { observe, unobserve, unmount } = mountTracker({ onHidden })
    observe(el, 'row-1')

    unobserve('row-1')

    expect(onHidden).not.toHaveBeenCalled()
    unmount()
  })

  it('observe(null, key) is equivalent to unobserve(key)', () => {
    const el = fakeEl()
    const { observe, isVisible, unmount } = mountTracker()
    observe(el, 'row-1')
    IntersectionObserverMock.instances[0]!.trigger([{ target: el, isIntersecting: true }])
    expect(isVisible('row-1')).toBe(true)

    observe(null, 'row-1')

    expect(isVisible('row-1')).toBe(false)
    unmount()
  })

  it('re-observing a key with a new element (DOM recycling) unobserves the old one', () => {
    const elOld = fakeEl()
    const elNew = fakeEl()
    const { observe, unmount } = mountTracker()
    observe(elOld, 'row-1')

    const observer = IntersectionObserverMock.instances[0]!
    observe(elNew, 'row-1')

    expect(observer.unobserve).toHaveBeenCalledWith(elOld)
    expect(observer.observe).toHaveBeenCalledWith(elNew)
    unmount()
  })

  it('polls for a root that resolves after mount, then observes pending elements', async () => {
    let rootEl: HTMLElement | null = null
    const el = fakeEl()
    const { observe, unmount } = mountTracker({ root: () => rootEl })

    observe(el, 'row-1') // root not ready yet — queued, no observer built
    expect(IntersectionObserverMock.instances.length).toBe(0)

    rootEl = fakeEl()
    flushRAF()
    await nextTick()

    expect(IntersectionObserverMock.instances.length).toBe(1)
    expect(IntersectionObserverMock.instances[0]!.root).toBe(rootEl)
    expect(IntersectionObserverMock.instances[0]!.observe).toHaveBeenCalledWith(el)
    unmount()
  })

  it('rebuilds the observer when the resolved root changes (e.g. a remounted list)', () => {
    let rootEl: HTMLElement | null = fakeEl()
    const elA = fakeEl()
    const elB = fakeEl()
    const { observe, unmount } = mountTracker({ root: () => rootEl })

    observe(elA, 'a')
    const firstObserver = IntersectionObserverMock.instances[0]!
    expect(firstObserver.root).toBe(rootEl)

    rootEl = fakeEl() // simulate the scroll container being swapped out
    observe(elB, 'b')

    expect(IntersectionObserverMock.instances.length).toBe(2)
    expect(firstObserver.disconnect).toHaveBeenCalled()
    expect(IntersectionObserverMock.instances[1]!.root).toBe(rootEl)
    unmount()
  })

  it('disconnects the observer on unmount', () => {
    const el = fakeEl()
    const { observe, unmount } = mountTracker()
    observe(el, 'row-1')
    const observer = IntersectionObserverMock.instances[0]!

    unmount()

    expect(observer.disconnect).toHaveBeenCalled()
  })

  it('passes rootMargin and threshold options through to the observer', () => {
    const el = fakeEl()
    const { observe, unmount } = mountTracker({ rootMargin: '10px', threshold: 0.5 })
    observe(el, 'row-1')

    const observer = IntersectionObserverMock.instances[0]!
    expect(observer.rootMargin).toBe('10px')
    expect(observer.thresholds).toEqual([0.5])
    unmount()
  })
})
