import type { Glyph } from './grid'
import type { Config } from './controls'

/**
 * Applies repulsion force from a single point to all glyphs within radius.
 * Spring + damping are NOT applied here — they run once per frame after all
 * path samples have been accumulated.
 */
function applyForceAt(
  glyphs: Glyph[],
  px: number,
  py: number,
  radius: number,
  strength: number,
  attract: boolean,
): void {
  for (const g of glyphs) {
    if (attract) {
      // Attraction: pull current position toward cursor
      const dx   = px - g.x
      const dy   = py - g.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < radius && dist > 0.01) {
        const falloff = 1 - dist / radius
        const force   = falloff * falloff * strength
        g.vx += (dx / dist) * force
        g.vy += (dy / dist) * force
      }
    } else {
      // Repulsion: push origin away from cursor
      const dx   = g.ox - px
      const dy   = g.oy - py
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < radius && dist > 0.01) {
        const falloff = 1 - dist / radius
        const force   = falloff * falloff * strength
        g.vx += (dx / dist) * force
        g.vy += (dy / dist) * force
      }
    }
  }
}

/**
 * Each frame, interpolates the mouse path from (prevX, prevY) → (mouseX, mouseY)
 * and samples the repulsion force at evenly spaced steps along the way.
 * This means a fast swipe registers as a continuous streak rather than
 * isolated circles wherever the browser happened to fire mousemove.
 *
 * Step size is half the radius so samples always overlap.
 */
export function applyDisplacement(
  glyphs: Glyph[],
  mouseX: number,
  mouseY: number,
  prevMouseX: number,
  prevMouseY: number,
  cfg: Config,
): void {
  const { radius, strength, spring, damping } = cfg

  // Only displace when the mouse is on-screen
  if (mouseX < -1000) {
    // Still apply spring + damping so glyphs settle
    for (const g of glyphs) {
      g.vx += (g.ox - g.x) * spring
      g.vy += (g.oy - g.y) * spring
      g.vx *= damping
      g.vy *= damping
      g.x  += g.vx
      g.y  += g.vy
    }
    return
  }

  const tdx      = mouseX - prevMouseX
  const tdy      = mouseY - prevMouseY
  const pathLen  = Math.sqrt(tdx * tdx + tdy * tdy)
  const stepSize = Math.max(radius * 0.5, 1)
  const steps    = Math.max(1, Math.ceil(pathLen / stepSize))

  for (let s = 0; s <= steps; s++) {
    const t  = steps === 0 ? 1 : s / steps
    const px = prevMouseX + tdx * t
    const py = prevMouseY + tdy * t
    applyForceAt(glyphs, px, py, radius, strength / (steps + 1), cfg.attract)
  }

  // Spring + damping applied once per frame
  for (const g of glyphs) {
    g.vx += (g.ox - g.x) * spring
    g.vy += (g.oy - g.y) * spring
    g.vx *= damping
    g.vy *= damping
    g.x  += g.vx
    g.y  += g.vy
  }
}
