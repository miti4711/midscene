export type MouseButton = 'left' | 'right' | 'middle';

export interface LibNut {
  getScreenSize(): { width: number; height: number };
  getMousePos(): { x: number; y: number };
  moveMouse(x: number, y: number): void;
  mouseClick(button?: MouseButton, double?: boolean): void;
  mouseToggle(state: 'up' | 'down', button?: MouseButton): void;
  scrollMouse(x: number, y: number): void;
  keyTap(key: string, modifiers?: string[]): void;
  typeString(text: string): void;
}

export interface ReplayAction {
  timestamp: Date;
  name: string;
  args: string[];
}

export interface ParsedLog {
  actions: ReplayAction[];
  durationMs: number;
  startTime: Date;
  endTime: Date;
}

export type SpeedMode = 'real' | 'instant' | number;

export interface ReplayOptions {
  speed?: SpeedMode;
  startFrom?: number;
  endAt?: number;
  skipNoOps?: boolean;
  capture?: boolean;
  screenshotDir?: string;
  onBeforeAction?: (action: ReplayAction, index: number) => void;
  onAfterAction?: (action: ReplayAction, index: number) => void;
  onError?: (error: Error, action: ReplayAction, index: number) => void;
}

export interface ReplayResult {
  totalActions: number;
  executedActions: number;
  skippedActions: number;
  errors: Error[];
  actualDurationMs: number;
}
