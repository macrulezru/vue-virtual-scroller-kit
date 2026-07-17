import { bench, describe } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { useVirtualScroll } from '../core/useVirtualScroll'

function makeScrollEl(clientHeight = 500, scrollHeight = 5000) {
  const state = { scrollTop: 0 }
  const el = document.createElement('div')
  Object.defineProperties(el, {
    scrollTop: {
      get: () => state.scrollTop,
      set: (v) => {
        state.scrollTop = v
      },
      configurable: true,
    },
    clientHeight: { get: () => clientHeight, configurable: true },
    scrollHeight: { get: () => scrollHeight, configurable: true },
  })
  return el
}

const SIZES = [1_000, 10_000, 100_000]

for (const n of SIZES) {
  describe(`useVirtualScroll (n=${n})`, () => {
    const scrollEl = makeScrollEl()

    bench('mount (initial manager build)', () => {
      const wrapper = mount(
        defineComponent({
          setup() {
            useVirtualScroll({
              itemCount: n,
              estimatedItemSize: 50,
              getScrollElement: () => scrollEl,
            })
            return () => null
          },
        }),
      )
      wrapper.unmount()
    })

    bench('itemCount change (manager rebuild)', () => {
      const itemCount = ref(n)
      const wrapper = mount(
        defineComponent({
          setup() {
            useVirtualScroll({
              itemCount,
              estimatedItemSize: 50,
              getScrollElement: () => scrollEl,
            })
            return () => null
          },
        }),
      )
      itemCount.value = n + 1_000
      wrapper.unmount()
    })
  })
}
