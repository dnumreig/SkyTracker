export type Stub = "none" | "top" | "bottom";

/** Clamp a dependency endpoint's vertical center into a column's visible band.
 *  Above the band -> clamp to bandTop (stub "top"); below -> bandBottom (stub "bottom"). */
export function clampEndpointToBand(
  cy: number,
  bandTop: number,
  bandBottom: number,
): { y: number; stub: Stub } {
  if (cy < bandTop) return { y: bandTop, stub: "top" };
  if (cy > bandBottom) return { y: bandBottom, stub: "bottom" };
  return { y: cy, stub: "none" };
}

/** Horizontal offset for the Nth stub sharing a column edge, so they don't overlap:
 *  0, +step, -step, +2*step, -2*step, ... */
export function stubOffset(indexWithinGroup: number, step = 8): number {
  if (indexWithinGroup === 0) return 0;
  const magnitude = Math.ceil(indexWithinGroup / 2) * step;
  return indexWithinGroup % 2 === 1 ? magnitude : -magnitude;
}

/** True only when BOTH endpoints are off-screen on the SAME side (both above, or both below).
 *  Such a line lies entirely outside the visible band and should be skipped. When the two ends
 *  are on OPPOSITE sides the line spans the viewport and must still be drawn. */
export function bothOffScreenSameSide(a: Stub, b: Stub): boolean {
  return a !== "none" && b !== "none" && a === b;
}
