import type { Glyph } from './grid'
import type { Config } from './controls'

/** Lerp between a and b by t (0–1) */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Renders the glyph grid with 3-pass chromatic aberration.
 *
 * When colorize = 0: each pass is a flat channel color (pure chromatic look).
 * When colorize = 1: each pass is tinted by the glyph's image color channel,
 * so characters take on the color from the original image while the chromatic
 * fringe effect is preserved.
 * Values in between blend smoothly.
 *
 * Per-glyph fillStyle is only set when the color actually changes from the
 * previous glyph to avoid redundant style recalculations.
 */
export function render(
  ctx: CanvasRenderingContext2D,
  glyphs: Glyph[],
  cfg: Config,
  fontSize: number,
  mouseSpeedPx: number,
): void {
  const { chromaticOffset, chromaticDynamic, brightness, colorize } = cfg

  const dynamicShift = chromaticOffset + mouseSpeedPx * chromaticDynamic * 0.05
  const shift = Math.min(dynamicShift, 20)

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.font = `${fontSize}px 'Courier New', Courier, monospace`
  ctx.textBaseline = 'alphabetic'
  ctx.globalAlpha = brightness

  // Fast path: no chromatic split and no per-glyph colorize — single white pass
  if (shift < 0.5 && colorize < 0.01) {
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = '#ffffff'
    for (const g of glyphs) {
      if (g.char === ' ') continue
      ctx.fillText(g.char, g.x, g.y)
    }
    ctx.globalAlpha = 1
    return
  }

  // 3-pass chromatic path
  ctx.globalCompositeOperation = 'screen'

  // 0 = red pass, 1 = green pass, 2 = blue pass
  const xShifts = [-shift, 0, shift]
  // Base channel values when colorize = 0 (full-brightness flat channel)
  const baseR = [255, 32, 32]
  const baseG = [32, 255, 32]
  const baseB = [32, 64, 255]

  for (let pass = 0; pass < 3; pass++) {
    const xShift = xShifts[pass]
    let lastStyle = ''

    for (const g of glyphs) {
      if (g.char === ' ') continue

      // Blend from flat channel color toward image channel color
      const r  = Math.round(lerp(baseR[pass], pass === 0 ? g.r : 0, colorize))
      const gr = Math.round(lerp(baseG[pass], pass === 1 ? g.g : 0, colorize))
      const b  = Math.round(lerp(baseB[pass], pass === 2 ? g.b : 0, colorize))

      const style = `rgb(${r},${gr},${b})`
      if (style !== lastStyle) {
        ctx.fillStyle = style
        lastStyle = style
      }

      ctx.fillText(g.char, g.x + xShift, g.y)
    }
  }

  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
}
