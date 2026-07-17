import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import VirtualScrollbar from '../components/VirtualScrollbar.vue'
import { flushRAF } from './setup'

function makeTargetEl(scrollTop = 0, clientHeight = 300, scrollHeight = 1000): HTMLElement {
  const state = { scrollTop }
  const el = document.createElement('div')
  Object.defineProperties(el, {
    scrollTop: {
      get: () => state.scrollTop,
      set: (v: number) => {
        state.scrollTop = v
      },
      configurable: true,
    },
    clientHeight: { get: () => clientHeight, configurable: true },
    scrollHeight: { get: () => scrollHeight, configurable: true },
  })
  return Object.assign(el, { state })
}

let rectSpy: { mockRestore: () => void } | null = null

afterEach(() => {
  rectSpy?.mockRestore()
  rectSpy = null
})

async function mountScrollbar(
  target: HTMLElement,
  trackRect = { height: 300, width: 10 },
  props: Record<string, unknown> = {},
) {
  // Mock at the prototype level and install it *before* mount, since the component
  // reads the track's real size synchronously in onMounted.
  rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    left: 0,
    right: trackRect.width,
    bottom: trackRect.height,
    height: trackRect.height,
    width: trackRect.width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect)

  const wrapper = mount(VirtualScrollbar, {
    props: { target: () => target, ...props },
  })

  flushRAF()
  await nextTick()
  await nextTick()
  return wrapper
}

describe('VirtualScrollbar', () => {
  it('sizes the thumb from the scrollHeight/clientHeight ratio', async () => {
    const target = makeTargetEl(0, 300, 1000)
    const wrapper = await mountScrollbar(target)

    const thumb = wrapper.find('.vvsk-scrollbar__thumb')
    // clientHeight/scrollHeight = 300/1000 = 30% of a 300px track = 90px
    expect(thumb.attributes('style')).toContain('height: 90px')
    wrapper.unmount()
  })

  it('positions the thumb from scrollTop', async () => {
    const target = makeTargetEl(350, 300, 1000) // maxScroll=700, scrollTop=350 → ratio 0.5
    const wrapper = await mountScrollbar(target)

    const thumb = wrapper.find('.vvsk-scrollbar__thumb')
    // top = ratio * (trackPx - thumbPx) = 0.5 * (300 - 90) = 105px
    expect(thumb.attributes('style')).toContain('top: 105px')
    wrapper.unmount()
  })

  it('clamps the thumb to minThumbSize for very long lists', async () => {
    // 300/1_000_000 ratio → raw thumb would be a sub-pixel sliver; must clamp to the default 24px.
    const target = makeTargetEl(0, 300, 1_000_000)
    const wrapper = await mountScrollbar(target)

    const thumb = wrapper.find('.vvsk-scrollbar__thumb')
    expect(thumb.attributes('style')).toContain('height: 24px')
    wrapper.unmount()
  })

  it('respects a custom minThumbSize prop', async () => {
    const target = makeTargetEl(0, 300, 1_000_000)
    const wrapper = await mountScrollbar(target, { height: 300, width: 10 }, { minThumbSize: 40 })

    const thumb = wrapper.find('.vvsk-scrollbar__thumb')
    expect(thumb.attributes('style')).toContain('height: 40px')
    wrapper.unmount()
  })

  it('hides the track when content fits without scrolling', async () => {
    const target = makeTargetEl(0, 1000, 1000) // clientHeight === scrollHeight
    const wrapper = await mountScrollbar(target)

    expect(wrapper.classes()).toContain('vvsk-scrollbar--hidden')
    wrapper.unmount()
  })

  it('updates target.scrollTop when the track is clicked', async () => {
    const target = makeTargetEl(0, 300, 1000)
    const wrapper = await mountScrollbar(target)

    wrapper.element.dispatchEvent(
      new PointerEvent('pointerdown', { clientY: 150, bubbles: true, pointerId: 1 }),
    )
    await nextTick()

    expect((target as unknown as { state: { scrollTop: number } }).state.scrollTop).toBeGreaterThan(
      0,
    )
    wrapper.unmount()
  })

  it('drags the thumb to update target.scrollTop proportionally', async () => {
    const target = makeTargetEl(0, 300, 1000)
    const wrapper = await mountScrollbar(target)
    const thumb = wrapper.find('.vvsk-scrollbar__thumb').element as HTMLElement

    thumb.dispatchEvent(
      new PointerEvent('pointerdown', { clientY: 0, bubbles: true, pointerId: 1 }),
    )
    await nextTick()

    // trackPx=300, thumbPx=0.3*300=90, draggablePx=210, maxScroll=700
    // dragging 105px (half of draggablePx) → deltaScroll = (105/210)*700 = 350
    window.dispatchEvent(
      new PointerEvent('pointermove', { clientY: 105, bubbles: true, pointerId: 1 }),
    )
    await nextTick()

    expect(target.scrollTop).toBeCloseTo(350, 0)

    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }))
    wrapper.unmount()
  })
})
