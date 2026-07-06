import type { LibNut } from './types';

/**
 * Break a mouse movement into intermediate steps (same algorithm as
 * `@midscene/computer`'s `smoothMoveMouse`).
 */
export function getIntermediates(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  steps: number,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 1; i < steps; i++) {
    const ratio = i / steps;
    points.push({
      x: Math.round(startX + (targetX - startX) * ratio),
      y: Math.round(startY + (targetY - startY) * ratio),
    });
  }
  points.push({ x: targetX, y: targetY });
  return points;
}

/**
 * Replay `smoothMoveMouse(targetX, targetY, steps, stepDelayMs)`.
 * Needs the *current* mouse position (from the previous action) as the start.
 */
export async function replaySmoothMoveMouse(
  libnut: LibNut,
  currentX: number,
  currentY: number,
  targetX: number,
  targetY: number,
  steps: number,
  delayMs: number,
): Promise<void> {
  const intermediates = getIntermediates(
    currentX,
    currentY,
    targetX,
    targetY,
    steps,
  );

  for (let i = 0; i < intermediates.length; i++) {
    libnut.moveMouse(intermediates[i].x, intermediates[i].y);
    if (i < intermediates.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
