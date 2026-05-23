import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref, nextTick } from 'vue'
import { useVirtualKeyboardNav } from '../composables/useVirtualKeyboardNav'

function mountNav(count: number, loop = false) {
  const scrollTo = vi.fn()
  const onChange = vi.fn()
  const onActivate = vi.fn()
  let nav: ReturnType<typeof useVirtualKeyboardNav>

  const wrapper = mount(
    defineComponent({
      setup() {
        nav = useVirtualKeyboardNav({
          itemCount: ref(count),
          scrollTo,
          onChange,
          onActivate,
          loop,
        })
        return () => null
      },
    }),
  )

  return { nav: nav!, scrollTo, onChange, onActivate, unmount: () => wrapper.unmount() }
}

function key(code: string) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: code, bubbles: true }))
}

describe('useVirtualKeyboardNav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts with focusedIndex = -1', () => {
    const { nav, unmount } = mountNav(10)
    expect(nav.focusedIndex.value).toBe(-1)
    unmount()
  })

  it('ArrowDown from -1 moves to 0', async () => {
    const { nav, unmount } = mountNav(10)
    key('ArrowDown')
    await nextTick()
    expect(nav.focusedIndex.value).toBe(0)
    unmount()
  })

  it('ArrowDown increments focus', async () => {
    const { nav, unmount } = mountNav(10)
    key('ArrowDown')
    key('ArrowDown')
    key('ArrowDown')
    await nextTick()
    expect(nav.focusedIndex.value).toBe(2)
    unmount()
  })

  it('ArrowUp from -1 moves to last item', async () => {
    const { nav, unmount } = mountNav(5)
    key('ArrowUp')
    await nextTick()
    expect(nav.focusedIndex.value).toBe(4)
    unmount()
  })

  it('Home goes to first item', async () => {
    const { nav, unmount } = mountNav(10)
    nav.setFocus(5)
    key('Home')
    await nextTick()
    expect(nav.focusedIndex.value).toBe(0)
    unmount()
  })

  it('End goes to last item', async () => {
    const { nav, unmount } = mountNav(10)
    key('End')
    await nextTick()
    expect(nav.focusedIndex.value).toBe(9)
    unmount()
  })

  it('clamps at boundaries without loop', async () => {
    const { nav, unmount } = mountNav(3)
    nav.setFocus(0)
    key('ArrowUp')
    await nextTick()
    expect(nav.focusedIndex.value).toBe(0)

    nav.setFocus(2)
    key('ArrowDown')
    await nextTick()
    expect(nav.focusedIndex.value).toBe(2)
    unmount()
  })

  it('loops at boundaries with loop=true', async () => {
    const { nav, unmount } = mountNav(3, true)
    nav.setFocus(2)
    key('ArrowDown')
    await nextTick()
    expect(nav.focusedIndex.value).toBe(0)
    unmount()
  })

  it('Enter calls onActivate', async () => {
    const { nav, onActivate, unmount } = mountNav(5)
    nav.setFocus(2)
    key('Enter')
    await nextTick()
    expect(onActivate).toHaveBeenCalledWith(2)
    unmount()
  })

  it('setFocus calls scrollTo with auto align', () => {
    const { nav, scrollTo, unmount } = mountNav(10)
    nav.setFocus(7)
    expect(scrollTo).toHaveBeenCalledWith(7, 'auto')
    unmount()
  })

  it('isFocused returns correct boolean', () => {
    const { nav, unmount } = mountNav(5)
    nav.setFocus(3)
    expect(nav.isFocused(3)).toBe(true)
    expect(nav.isFocused(1)).toBe(false)
    unmount()
  })

  it('onChange is called on focus change', () => {
    const { nav, onChange, unmount } = mountNav(5)
    nav.setFocus(2)
    expect(onChange).toHaveBeenCalledWith(2)
    unmount()
  })

  it('PageDown advances by 10', async () => {
    const { nav, unmount } = mountNav(50)
    nav.setFocus(5)
    key('PageDown')
    await nextTick()
    expect(nav.focusedIndex.value).toBe(15)
    unmount()
  })

  it('PageUp decrements by 10', async () => {
    const { nav, unmount } = mountNav(50)
    nav.setFocus(15)
    key('PageUp')
    await nextTick()
    expect(nav.focusedIndex.value).toBe(5)
    unmount()
  })
})
