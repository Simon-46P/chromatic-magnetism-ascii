import type { AsciiCell } from './imageToAscii'

export interface Glyph {
  char: string
  lum: number
  /** original image color, 0–255 */
  r: number
  g: number
  b: number
  /** origin position (grid anchor) */
  ox: number
  oy: number
  /** current displaced position */
  x: number
  y: number
  /** velocity */
  vx: number
  vy: number
}

export class CharacterGrid {
  glyphs: Glyph[] = []
  cols: number = 0
  rows: number = 0
  cellW: number = 0
  cellH: number = 0

  build(
    cells: AsciiCell[],
    cols: number,
    rows: number,
    cellW: number,
    cellH: number,
    offsetX: number,
    offsetY: number,
  ): void {
    this.cols  = cols
    this.rows  = rows
    this.cellW = cellW
    this.cellH = cellH
    this.glyphs = []

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx  = row * cols + col
        const cell = cells[idx] ?? { char: ' ', lum: 0, r: 0, g: 0, b: 0 }
        const ox   = offsetX + col * cellW + cellW * 0.5
        const oy   = offsetY + row * cellH + cellH * 0.8 // baseline offset
        this.glyphs.push({
          char: cell.char,
          lum:  cell.lum,
          r: cell.r, g: cell.g, b: cell.b,
          ox, oy,
          x: ox, y: oy,
          vx: 0, vy: 0,
        })
      }
    }
  }

  /** Snap all glyphs back to origin instantly (useful on re-generate) */
  resetPositions(): void {
    for (const g of this.glyphs) {
      g.x = g.ox
      g.y = g.oy
      g.vx = 0
      g.vy = 0
    }
  }
}
