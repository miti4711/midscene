import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ClipboardRunner, captureScreenshot, loadLibnut } from './input-runner';
import { isNoopAction } from './parser';
import { replaySmoothMoveMouse, sleep } from './smooth-move';
import type {
  LibNut,
  ParsedLog,
  ReplayAction,
  ReplayOptions,
  ReplayResult,
  SpeedMode,
} from './types';

const DEFAULT_DELAY_MS = 25;

const SPEED_DELAY_MAP: Record<string, number> = {
  fast: 15,
  instant: 0,
};

export async function replay(
  parsedLog: ParsedLog,
  options: ReplayOptions = {},
): Promise<ReplayResult> {
  const {
    speed = 'instant',
    startFrom = 0,
    endAt = parsedLog.actions.length - 1,
    skipNoOps = true,
    capture,
    selfHeal,
    screenshotDir = './screenshots',
    onBeforeAction,
    onAfterAction,
    onError,
  } = options;

  if (capture && selfHeal) {
    throw new Error(
      'Cannot use both --capture and --self-heal at the same time.',
    );
  }

  if (capture || selfHeal) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  let screenshotCounter = 0;

  const allActions = parsedLog.actions;
  const totalActions = allActions.length;

  const startIdx = Math.max(0, startFrom);
  const endIdx = Math.min(endAt, totalActions - 1);

  if (startIdx > endIdx) {
    return {
      totalActions,
      executedActions: 0,
      skippedActions: 0,
      errors: [],
      actualDurationMs: 0,
    };
  }

  const slice = allActions.slice(startIdx, endIdx + 1);

  const libnut = await loadLibnut();

  let mouseX = 0;
  let mouseY = 0;
  libnut.moveMouse(10, 10);
  try {
    const pos = libnut.getMousePos();
    mouseX = pos.x;
    mouseY = pos.y;
  } catch {
    /* ignore - will use (0,0) */
  }

  const result: ReplayResult = {
    totalActions,
    executedActions: 0,
    skippedActions: 0,
    errors: [],
    actualDurationMs: 0,
  };

  const startTime = Date.now();

  const delayFactor = resolveDelayMultiplier(speed);

  for (let i = 0; i < slice.length; i++) {
    const action = slice[i];
    const globalIdx = startIdx + i;

    if (skipNoOps && isNoopAction(action)) {
      result.skippedActions++;
      continue;
    }

    onBeforeAction?.(action, globalIdx);

    if (capture || selfHeal) {
      const padded = String(screenshotCounter).padStart(4, '0');
      const suffix = selfHeal ? 'actual' : 'expected';
      const screenshotPath = path.join(
        screenshotDir,
        `${padded}_${action.name}_${suffix}.png`,
      );
      let saved = false;
      try {
        const buf = await captureScreenshot();
        fs.writeFileSync(screenshotPath, buf);
        console.log(`  [screenshot] ${screenshotPath}`);
        saved = true;
      } catch (err) {
        console.error(`  [screenshot error] ${err}`);
      }

      if (selfHeal && saved) {
        const expectedPath = path.join(
          screenshotDir,
          `${padded}_${action.name}_expected.png`,
        );
        if (fs.existsSync(expectedPath)) {
          const diffPath = path.join(
            screenshotDir,
            `${padded}_${action.name}_diff.png`,
          );
          try {
            generateImagMagickDiff(expectedPath, screenshotPath, diffPath);
            console.log(`  [diff] ${diffPath}`);
          } catch (err) {
            console.error(`  [diff error] ${err}`);
          }
        }
      }

      screenshotCounter++;
    }

    try {
      await executeAction(libnut, action, mouseX, mouseY, delayFactor, {
        onPositionChange: (x, y) => {
          mouseX = x;
          mouseY = y;
        },
      });

      result.executedActions++;

      const interDelay = computeInterActionDelay(
        parsedLog,
        startIdx,
        i,
        delayFactor,
      );
      if (interDelay > 0) {
        await sleep(interDelay);
      }
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error));
      result.errors.push(err);
      onError?.(err, action, globalIdx);
    }

    onAfterAction?.(action, globalIdx);
  }

  result.actualDurationMs = Date.now() - startTime;
  return result;
}

function resolveDelayMultiplier(speed: SpeedMode): number {
  if (speed === 'instant') return 0;
  if (speed === 'real') return 1;
  if (typeof speed === 'number') return speed;
  return SPEED_DELAY_MAP[String(speed)] ?? 0;
}

function computeInterActionDelay(
  parsedLog: ParsedLog,
  startIdx: number,
  sliceIndex: number,
  delayFactor: number,
): number {
  if (delayFactor === 0) return 0;

  const globalIdx = startIdx + sliceIndex;
  if (globalIdx >= parsedLog.actions.length - 1)
    return DEFAULT_DELAY_MS * (delayFactor || 0.1);

  const nextGlobalIdx = globalIdx + 1;
  const realDelta =
    parsedLog.actions[nextGlobalIdx].timestamp.getTime() -
    parsedLog.actions[globalIdx].timestamp.getTime();

  if (delayFactor === 1) {
    return Math.min(realDelta, 5000);
  }

  return DEFAULT_DELAY_MS * (delayFactor > 0 ? delayFactor : 0.1);
}

async function executeAction(
  libnut: LibNut,
  action: ReplayAction,
  currentX: number,
  currentY: number,
  delayFactor: number,
  ctx: { onPositionChange?: (x: number, y: number) => void },
): Promise<void> {
  const args = action.args;
  const safeNum = (arg: string, fallback = 0) => {
    const n = Number(arg);
    return Number.isFinite(n) ? n : fallback;
  };

  switch (action.name) {
    case 'moveMouse': {
      const x = safeNum(args[0]);
      const y = safeNum(args[1]);
      libnut.moveMouse(x, y);
      ctx.onPositionChange?.(x, y);
      break;
    }

    case 'smoothMoveMouse': {
      const x = safeNum(args[0]);
      const y = safeNum(args[1]);
      const steps = safeNum(args[2], 8);
      const stepDelay = safeNum(args[3], 25);
      const actualDelay =
        delayFactor === 0
          ? 0
          : delayFactor === 1
            ? stepDelay
            : stepDelay * delayFactor;
      await replaySmoothMoveMouse(
        libnut,
        currentX,
        currentY,
        x,
        y,
        steps,
        actualDelay,
      );
      ctx.onPositionChange?.(x, y);
      break;
    }

    case 'mouseClick': {
      const button = args[0] === 'undefined' ? undefined : (args[0] as any);
      // const double = args[1] === 'true';
      const double = args[1]?.includes('undefined')
        ? undefined
        : args[1] === 'true';
      if (double !== undefined && double) {
        libnut.mouseClick(button, double);
      } else if (button) {
        libnut.mouseClick(button);
      } else {
        libnut.mouseClick();
      }
      break;
    }

    case 'mouseToggle': {
      const state = args[0] === 'up' ? 'up' : 'down';
      const button = args[1] as any;
      libnut.mouseToggle(state, button);
      break;
    }

    case 'releaseMouseButton': {
      libnut.mouseToggle('up', args[0] as any);
      break;
    }

    case 'keyTap': {
      const key = args[0];
      const modifiers = args[1] === 'undefined' ? undefined : [args[1]];
      if (modifiers) {
        libnut.keyTap(key, modifiers);
      } else {
        libnut.keyTap(key);
      }
      break;
    }

    case 'sendKey': {
      const key = args[0];
      const modifiers = args[1] === 'undefined' ? undefined : [args[1]];
      if (modifiers) {
        libnut.keyTap(key, modifiers);
      } else {
        libnut.keyTap(key);
      }
      break;
    }

    case 'typeViaClipboard': {
      const text = args.join(',');
      await ClipboardRunner.paste(text);
      break;
    }

    case 'typeString': {
      const text = args.join(',');
      libnut.typeString(text);
      break;
    }

    case 'scrollMouse': {
      const x = safeNum(args[0]);
      const y = safeNum(args[1]);
      libnut.scrollMouse(x, y);
      break;
    }
  }
}

/**
 * Generate a visual diff between expected and actual screenshots using
 * ImageMagick's darken-composite technique.
 */
function generateImagMagickDiff(
  expectedPath: string,
  actualPath: string,
  outputPath: string,
): void {
  execFileSync('convert', [
    '(',
    expectedPath,
    '-flatten',
    '-grayscale',
    'Rec709Luminance',
    ')',
    '(',
    actualPath,
    '-flatten',
    '-grayscale',
    'Rec709Luminance',
    ')',
    '(',
    '-clone',
    '0-1',
    '-compose',
    'darken',
    '-composite',
    ')',
    '-channel',
    'RGB',
    '-combine',
    outputPath,
  ]);
}
