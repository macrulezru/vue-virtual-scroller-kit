import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import VirtualSelect from '../components/VirtualSelect.vue'

type Option = { value: string; label: string }

const options: Option[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
]

async function openDropdown(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('.vvsk-select__trigger').trigger('click')
  await nextTick()
}

describe('VirtualSelect', () => {
  describe('client-side filtering (default)', () => {
    it('filters options by the typed query', async () => {
      const wrapper = mount(VirtualSelect, { props: { options } })
      await openDropdown(wrapper)

      await wrapper.find('.vvsk-select__search').setValue('al')
      await nextTick()

      const rendered = wrapper.findAll('.vvsk-select__option')
      expect(rendered.length).toBe(1)
      expect(rendered[0].text()).toContain('Alpha')
    })
  })

  describe('remote mode', () => {
    it('does not filter client-side — renders options as passed', async () => {
      const wrapper = mount(VirtualSelect, { props: { options, remote: true } })
      await openDropdown(wrapper)

      await wrapper.find('.vvsk-select__search').setValue('al')
      await nextTick()

      // remote:true → filteredOptions === props.options regardless of the typed query
      expect(wrapper.findAll('.vvsk-select__option').length).toBe(options.length)
    })
  })

  describe('debounceMs', () => {
    it('emits search synchronously by default (debounceMs: 0)', async () => {
      const wrapper = mount(VirtualSelect, { props: { options } })
      await openDropdown(wrapper)

      await wrapper.find('.vvsk-select__search').setValue('a')
      expect(wrapper.emitted('search')).toBeTruthy()
      expect(wrapper.emitted('search')![0]).toEqual(['a'])
    })

    it('delays the search emit by debounceMs and coalesces rapid keystrokes', async () => {
      vi.useFakeTimers()
      const wrapper = mount(VirtualSelect, { props: { options, debounceMs: 300 } })
      await openDropdown(wrapper)

      const input = wrapper.find('.vvsk-select__search')
      await input.setValue('a')
      await input.setValue('al')
      expect(wrapper.emitted('search')).toBeFalsy()

      vi.advanceTimersByTime(300)
      expect(wrapper.emitted('search')).toBeTruthy()
      expect(wrapper.emitted('search')!.length).toBe(1)
      expect(wrapper.emitted('search')![0]).toEqual(['al'])

      vi.useRealTimers()
      wrapper.unmount()
    })

    it('updates the displayed input value immediately even while debounced', async () => {
      vi.useFakeTimers()
      const wrapper = mount(VirtualSelect, { props: { options, debounceMs: 300 } })
      await openDropdown(wrapper)

      const input = wrapper.find('.vvsk-select__search')
      await input.setValue('gamma')
      expect((input.element as HTMLInputElement).value).toBe('gamma')

      vi.useRealTimers()
      wrapper.unmount()
    })
  })

  describe('isLoading', () => {
    it('shows the #loading slot instead of options while loading', async () => {
      const wrapper = mount(VirtualSelect, { props: { options, isLoading: true } })
      await openDropdown(wrapper)

      expect(wrapper.find('.vvsk-select__loading').exists()).toBe(true)
      expect(wrapper.find('.vvsk-select__empty').exists()).toBe(false)
      expect(wrapper.findAll('.vvsk-select__option').length).toBe(0)
    })

    it('takes precedence over the empty state so remote search does not flash "No options"', async () => {
      const wrapper = mount(VirtualSelect, {
        props: { options: [], remote: true, isLoading: true },
      })
      await openDropdown(wrapper)

      expect(wrapper.find('.vvsk-select__loading').exists()).toBe(true)
      expect(wrapper.find('.vvsk-select__empty').exists()).toBe(false)
    })

    it('falls back to the empty slot once loading finishes with no results', async () => {
      const wrapper = mount(VirtualSelect, {
        props: { options: [], remote: true, isLoading: false },
      })
      await openDropdown(wrapper)

      expect(wrapper.find('.vvsk-select__loading').exists()).toBe(false)
      expect(wrapper.find('.vvsk-select__empty').exists()).toBe(true)
    })
  })
})
