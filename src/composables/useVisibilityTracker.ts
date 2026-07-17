import { onMounted, onUnmounted, ref, type Ref } from 'vue'

export interface UseVisibilityTrackerOptions {
  /**
   * Returns the scroll container to intersect against (e.g. `() => listRef.value?.getScrollElement() ?? null`).
   * Omit to intersect against the browser viewport.
   */
  root?: () => HTMLElement | null
  /** IntersectionObserver `rootMargin` — grow/shrink the root's effective bounds. */
  rootMargin?: string
  /** IntersectionObserver `threshold` — fraction of the element that must be visible. Default `0` (any pixel). */
  threshold?: number | number[]
  /** Called when a tracked key becomes visible. */
  onVisible?: (key: string | number) => void
  /** Called when a tracked key becomes hidden (including when `unobserve` is called while it was visible). */
  onHidden?: (key: string | number) => void
}

export interface UseVisibilityTrackerReturn {
  /** Keys currently intersecting the root, per the configured threshold. */
  visibleKeys: Readonly<Ref<Set<string | number>>>
  isVisible: (key: string | number) => boolean
  /** Start tracking an element under `key` — bind via a template ref callback. */
  observe: (el: Element | null, key: string | number) => void
  /** Stop tracking `key` (e.g. when its row unmounts). */
  unobserve: (key: string | number) => void
}

export function useVisibilityTracker(
  options: UseVisibilityTrackerOptions = {},
): UseVisibilityTrackerReturn {
  const visibleKeys = ref<Set<string | number>>(new Set())
  const keyToEl = new Map<string | number, Element>()
  const elToKey = new WeakMap<Element, string | number>()

  let observer: IntersectionObserver | null = null
  let observedRoot: HTMLElement | null = null

  function handleEntries(entries: IntersectionObserverEntry[]): void {
    if (entries.length === 0) return
    const next = new Set(visibleKeys.value)
    let changed = false
    for (const entry of entries) {
      const key = elToKey.get(entry.target)
      if (key === undefined) continue
      if (entry.isIntersecting) {
        if (!next.has(key)) {
          next.add(key)
          changed = true
          options.onVisible?.(key)
        }
      } else if (next.has(key)) {
        next.delete(key)
        changed = true
        options.onHidden?.(key)
      }
    }
    if (changed) visibleKeys.value = next
  }

  function buildObserver(root: HTMLElement | null): void {
    observer?.disconnect()
    observedRoot = root
    observer = new IntersectionObserver(handleEntries, {
      root,
      rootMargin: options.rootMargin ?? '0px',
      threshold: options.threshold ?? 0,
    })
    for (const el of keyToEl.values()) observer.observe(el)
  }

  // Returns whether an observer is ready to accept .observe() calls. The root (e.g. a
  // sibling component's scroll element) may resolve after this composable's own setup
  // runs, or be swapped out entirely (a remounted VirtualList instance) — rebuild
  // whenever the resolved root differs from what we last built against.
  function ensureObserver(): boolean {
    if (typeof IntersectionObserver === 'undefined') return false
    const root = options.root ? options.root() : null
    if (options.root && !root) return false
    if (!observer || root !== observedRoot) buildObserver(root)
    return true
  }

  function observe(el: Element | null, key: string | number): void {
    if (!el) {
      unobserve(key)
      return
    }
    const prevEl = keyToEl.get(key)
    if (prevEl && prevEl !== el) {
      elToKey.delete(prevEl)
      observer?.unobserve(prevEl)
    }
    keyToEl.set(key, el)
    elToKey.set(el, key)
    if (ensureObserver()) observer!.observe(el)
  }

  function unobserve(key: string | number): void {
    const el = keyToEl.get(key)
    if (el) {
      observer?.unobserve(el)
      elToKey.delete(el)
    }
    keyToEl.delete(key)
    if (visibleKeys.value.has(key)) {
      const next = new Set(visibleKeys.value)
      next.delete(key)
      visibleKeys.value = next
      options.onHidden?.(key)
    }
  }

  function isVisible(key: string | number): boolean {
    return visibleKeys.value.has(key)
  }

  let pollRAF: number | null = null
  function pollRoot(attemptsLeft = 60): void {
    pollRAF = null
    if (ensureObserver()) return
    if (attemptsLeft > 0) pollRAF = requestAnimationFrame(() => pollRoot(attemptsLeft - 1))
  }

  onMounted(() => {
    if (options.root) pollRoot()
  })

  onUnmounted(() => {
    if (pollRAF !== null) cancelAnimationFrame(pollRAF)
    observer?.disconnect()
    observer = null
  })

  return {
    visibleKeys: visibleKeys as Readonly<Ref<Set<string | number>>>,
    isVisible,
    observe,
    unobserve,
  }
}
