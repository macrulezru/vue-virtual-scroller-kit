import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import type { ScrollAlign } from '../types'

export interface UseVirtualKeyboardNavOptions {
  /** Total number of items */
  itemCount: Ref<number> | number
  /** Scroll programmatically to an index */
  scrollTo: (index: number, align?: ScrollAlign) => void
  /** Element to attach keyboard listeners to. Defaults to document. */
  target?: Ref<HTMLElement | null> | HTMLElement | null
  /** Called when Enter is pressed on the focused row */
  onActivate?: (index: number) => void
  /** Called when focused index changes */
  onChange?: (index: number) => void
  /** Whether to loop around at boundaries */
  loop?: boolean
}

export interface UseVirtualKeyboardNavReturn {
  focusedIndex: Readonly<Ref<number>>
  setFocus: (index: number) => void
  isFocused: (index: number) => boolean
}

export function useVirtualKeyboardNav(
  options: UseVirtualKeyboardNavOptions,
): UseVirtualKeyboardNavReturn {
  const { scrollTo, onActivate, onChange, loop = false } = options

  const focusedIndex = ref(-1)

  function getCount(): number {
    return typeof options.itemCount === 'number' ? options.itemCount : options.itemCount.value
  }

  function setFocus(index: number): void {
    const count = getCount()
    if (count === 0) return
    const next = loop ? ((index % count) + count) % count : Math.max(0, Math.min(count - 1, index))
    if (next === focusedIndex.value) return
    focusedIndex.value = next
    scrollTo(next, 'auto')
    onChange?.(next)
  }

  function isFocused(index: number): boolean {
    return focusedIndex.value === index
  }

  function onKeyDown(e: KeyboardEvent): void {
    const count = getCount()
    if (count === 0) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocus(focusedIndex.value < 0 ? 0 : focusedIndex.value + 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocus(focusedIndex.value < 0 ? count - 1 : focusedIndex.value - 1)
        break
      case 'Home':
        e.preventDefault()
        setFocus(0)
        break
      case 'End':
        e.preventDefault()
        setFocus(count - 1)
        break
      case 'PageDown':
        e.preventDefault()
        setFocus(Math.min(count - 1, (focusedIndex.value < 0 ? 0 : focusedIndex.value) + 10))
        break
      case 'PageUp':
        e.preventDefault()
        setFocus(Math.max(0, (focusedIndex.value < 0 ? 0 : focusedIndex.value) - 10))
        break
      case 'Enter':
      case ' ':
        if (focusedIndex.value >= 0) {
          e.preventDefault()
          onActivate?.(focusedIndex.value)
        }
        break
    }
  }

  function getTarget(): HTMLElement | Document {
    if (!options.target) return document
    const t =
      typeof options.target === 'object' && 'value' in options.target
        ? options.target.value
        : options.target
    return t ?? document
  }

  onMounted(() => {
    getTarget().addEventListener('keydown', onKeyDown as EventListener)
  })

  onUnmounted(() => {
    getTarget().removeEventListener('keydown', onKeyDown as EventListener)
  })

  return {
    focusedIndex: focusedIndex as Readonly<Ref<number>>,
    setFocus,
    isFocused,
  }
}
