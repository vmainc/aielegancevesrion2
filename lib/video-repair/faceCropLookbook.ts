/** Axis-aligned crop in source image pixels. */
export type FaceCropRect = { x: number; y: number; w: number; h: number }

/**
 * Heuristic face/head crop for character lookbook plates.
 * Full-body sheets put the head near the top-center; close-up portraits keep most of the frame.
 * Avoids sending the whole body/studio backdrop to Aleph (which restyles the shot).
 */
export function lookbookFaceCropRect (width: number, height: number): FaceCropRect {
  const w0 = Math.max(1, Math.floor(width))
  const h0 = Math.max(1, Math.floor(height))
  const aspect = h0 / w0

  if (aspect <= 1.25) {
    // Already portrait / mid-shot — keep face-forward region.
    const h = Math.max(1, Math.round(h0 * 0.72))
    const w = Math.max(1, Math.round(w0 * 0.78))
    return {
      x: Math.max(0, Math.round((w0 - w) / 2)),
      y: Math.max(0, Math.round(h0 * 0.04)),
      w: Math.min(w, w0),
      h: Math.min(h, h0)
    }
  }

  // Full-body turnaround — upper head/shoulders only.
  const h = Math.max(1, Math.round(h0 * 0.4))
  const w = Math.max(1, Math.round(w0 * 0.55))
  return {
    x: Math.max(0, Math.round((w0 - w) / 2)),
    y: Math.max(0, Math.round(h0 * 0.02)),
    w: Math.min(w, w0),
    h: Math.min(h, h0)
  }
}
