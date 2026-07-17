export interface ComputeBlurAmountOptions {
  /** Maximum blur radius in px. Default 6. */
  maxBlur?: number
  /** px/ms velocity that maps to maxBlur. Default 3 (≈3000px/s). */
  sensitivity?: number
}

/**
 * Maps scroll velocity (px/ms) to a CSS blur radius (px), clamped to [0, maxBlur].
 */
export function computeBlurAmount(
  velocityPxPerMs: number,
  opts: ComputeBlurAmountOptions = {},
): number {
  const { maxBlur = 6, sensitivity = 3 } = opts
  const v = Math.abs(velocityPxPerMs)
  if (v <= 0 || sensitivity <= 0) return 0
  return Math.min(maxBlur, (v / sensitivity) * maxBlur)
}
