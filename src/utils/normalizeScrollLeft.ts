/**
 * Returns horizontal scroll distance measured from the *start* edge (left in LTR,
 * right in RTL), regardless of direction.
 *
 * Evergreen browsers report `scrollLeft` as negative in RTL content (0 at the start
 * edge, going negative as you scroll toward the end) per the modern spec. This
 * normalizes that back to a positive "distance scrolled from start" value so index/
 * offset math elsewhere doesn't need direction-specific branching.
 */
export function normalizeScrollLeft(el: HTMLElement): number {
  const direction = getComputedStyle(el).direction
  if (direction !== 'rtl') return el.scrollLeft
  // RTL: scrollLeft is 0 or negative (spec-compliant browsers). Shift it into the
  // same "distance from start" range as the LTR case.
  return el.scrollWidth - el.clientWidth + el.scrollLeft
}

/**
 * Converts a "distance from start" value into the raw `scrollLeft`/`scrollTo({left})`
 * value the browser expects, accounting for RTL's negative-scrollLeft convention.
 * Shared by {@link setNormalizedScrollLeft} and call sites (like `scrollTo`) that need
 * the raw value directly instead of assigning it to `el.scrollLeft`.
 */
export function rawScrollLeftFor(el: HTMLElement, distanceFromStart: number): number {
  const direction = getComputedStyle(el).direction
  return direction === 'rtl'
    ? distanceFromStart - (el.scrollWidth - el.clientWidth)
    : distanceFromStart
}

/** Inverse of {@link normalizeScrollLeft} — sets `scrollLeft` from a "distance from start" value. */
export function setNormalizedScrollLeft(el: HTMLElement, distanceFromStart: number): void {
  el.scrollLeft = rawScrollLeftFor(el, distanceFromStart)
}
