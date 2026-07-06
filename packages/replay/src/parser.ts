import fs from 'node:fs';
import type { ParsedLog, ReplayAction } from './types';

export const ACTION_LINE_RE = /^\[(\S+)\]\s+============>\s+(\w+)\(([^)]*)\)$/;

const NOOP_ACTIONS = new Set(['getScreenSize', 'getMousePos']);

/** Parse a Midscene computer-device action log file. */
export function parseLogFile(filePath: string): ParsedLog {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const actions: ReplayAction[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(ACTION_LINE_RE);
    if (!match) continue;

    const [, tsStr, name, argsStr] = match;
    const timestamp = new Date(tsStr);

    const args = argsStr ? argsStr.split(',').map((a) => a.trim()) : [];

    actions.push({ timestamp, name, args });
  }

  if (actions.length === 0) {
    return {
      actions,
      durationMs: 0,
      startTime: new Date(),
      endTime: new Date(),
    };
  }

  const startTime = actions[0].timestamp;
  const endTime = actions[actions.length - 1].timestamp;

  return {
    actions,
    durationMs: endTime.getTime() - startTime.getTime(),
    startTime,
    endTime,
  };
}

/** Check if an action is a read-only "no-op" that doesn't affect system state. */
export function isNoopAction(action: ReplayAction): boolean {
  return NOOP_ACTIONS.has(action.name);
}
