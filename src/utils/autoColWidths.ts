export interface AutoColWidthsOptions {
  /** CSS font string used to measure text. Should match your cell font. Default: '12px sans-serif' */
  font?: string
  /** Extra px added to measured text width (accounts for cell padding). Default: 24 */
  padding?: number
  /** Minimum column width in px. Default: 60 */
  minWidth?: number
  /** Maximum column width in px. Default: 320 */
  maxWidth?: number
}

/**
 * Estimates column widths from a data sample using Canvas measureText.
 *
 * Iterates over all columns and all provided rows, measures the widest
 * string value per column (including the header title), and returns a
 * Map<colKey, px> suitable for use as ColumnDef.width.
 *
 * @example
 * const widths = autoColWidths(columns, rows, { font: '12px Inter, sans-serif' })
 * const colDefs = columns.map(c => ({ key: c.key, title: c.title, width: widths.get(c.key) }))
 */
export function autoColWidths<T extends Record<string, unknown>>(
  cols: { key: string; title: string }[],
  rows: T[],
  options: AutoColWidthsOptions = {},
): Map<string, number> {
  const { font = '12px sans-serif', padding = 24, minWidth = 60, maxWidth = 320 } = options

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  // Fallback if canvas is not available (SSR)
  if (!ctx) return new Map(cols.map((c) => [c.key, 120]))

  ctx.font = font

  const measure = (text: string): number => ctx.measureText(text).width

  const stringify = (val: unknown): string => {
    if (val === null || val === undefined) return 'null'
    if (typeof val === 'object') return JSON.stringify(val)
    return String(val)
  }

  return new Map(
    cols.map((col) => {
      let maxW = measure(col.title)
      for (const row of rows) {
        const w = measure(stringify(row[col.key]))
        if (w > maxW) maxW = w
      }
      return [col.key, Math.min(maxWidth, Math.max(minWidth, Math.ceil(maxW) + padding))]
    }),
  )
}
