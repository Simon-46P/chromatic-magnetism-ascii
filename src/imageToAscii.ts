export interface AsciiCell {
  char: string
  /** normalised luminance 0–1 */
  lum: number
  /** original image color, 0–255 */
  r: number
  g: number
  b: number
}

/**
 * Samples an image into a cols×rows grid and maps each cell's luminance
 * to a character from the provided ramp.
 *
 * Ramp convention: index 0 = densest/brightest char (e.g. '@'),
 * last index = sparsest (e.g. ' '). Bright image pixels → dense chars,
 * dark pixels → sparse/space — correct for rendering on a dark canvas.
 *
 * Gamma < 1 boosts midtone contrast (0.6–0.8 works well for photos).
 */
export function imageToAscii(
  img: HTMLImageElement,
  cols: number,
  rows: number,
  charRamp: string,
  gamma = 0.7,
): AsciiCell[] {
  const oc = new OffscreenCanvas(cols, rows)
  const ctx = oc.getContext('2d')!
  ctx.drawImage(img, 0, 0, cols, rows)
  const { data } = ctx.getImageData(0, 0, cols, rows)

  const cells: AsciiCell[] = []
  const rampLen = charRamp.length

  for (let i = 0; i < cols * rows; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]

    // Perceived luminance (linear)
    const linear = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    // Gamma correction boosts midtone detail
    const lum = Math.pow(linear, gamma)

    // Bright pixels → index 0 (dense char); dark pixels → last index (space)
    const charIdx = rampLen - 1 - Math.floor(lum * (rampLen - 1))
    cells.push({ char: charRamp[charIdx], lum, r, g, b })
  }

  return cells
}

/**
 * Derives rows from the desired column count and the image's aspect ratio,
 * corrected for the character cell's aspect ratio (~0.55 wide : 1 tall).
 * The result is clamped so the grid never exceeds the canvas dimensions.
 */
export function computeGrid(
  cols: number,
  imageAspect: number,  // imgWidth / imgHeight
  fontSize: number,
  maxCanvasWidth: number,
  maxCanvasHeight: number,
): { cols: number; rows: number; cellW: number; cellH: number } {
  const cellH = fontSize
  const cellW = fontSize * 0.55
  const charAspect = cellW / cellH  // ~0.55

  // Rows that preserve the image's visual proportions given char dimensions:
  // (cols * cellW) / (rows * cellH) = imageAspect  →  rows = cols * charAspect / imageAspect
  let rows = Math.round(cols * charAspect / imageAspect)

  // Clamp so the grid fits inside the canvas
  const maxCols = Math.floor(maxCanvasWidth  / cellW)
  const maxRows = Math.floor(maxCanvasHeight / cellH)
  const clampedCols = Math.min(cols, maxCols)
  const clampedRows = Math.min(rows, maxRows)

  return { cols: clampedCols, rows: clampedRows, cellW, cellH }
}
