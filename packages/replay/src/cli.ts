import fs from 'node:fs';
import { parseLogFile, replay } from './index';

function printUsage() {
  console.log(`
Usage: midscene-replay <logFile> [options]

Options:
  --speed <mode>         Playback speed: real, instant, fast, or number (1-100). Default: instant
  --from <index>         Start replaying from this action index. Default: 0
  --to <index>           Stop replaying at this action index. Default: last action
   --skip-noops           Skip read-only actions (getScreenSize, getMousePos). Default: true
   --no-skip-noops        Do not skip read-only actions
    --capture              Capture a screenshot before each action
    --screenshot-dir <dir> Screenshot output directory. Default: ./screenshots
   --help                 Show this message
`);
}

function parseArgs(argv: string[]) {
  const args = {
    logFile: '',
    speed: 'instant',
    from: 0,
    to: Number.POSITIVE_INFINITY,
    skipNoOps: true,
    capture: false,
    screenshotDir: '',
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (arg === '--speed') {
      i++;
      args.speed = argv[i];
    } else if (arg === '--from') {
      i++;
      args.from = Number.parseInt(argv[i], 10);
    } else if (arg === '--to') {
      i++;
      args.to = Number.parseInt(argv[i], 10);
    } else if (arg === '--no-skip-noops') {
      args.skipNoOps = false;
    } else if (arg === '--capture') {
      args.capture = true;
    } else if (arg === '--screenshot-dir') {
      i++;
      args.screenshotDir = argv[i];
    } else if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    } else if (!args.logFile) {
      args.logFile = arg;
    }

    i++;
  }

  return args;
}

export async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.logFile) {
    console.error('Missing log file path.');
    printUsage();
    process.exit(1);
  }

  if (!fs.existsSync(args.logFile)) {
    console.error(`Log file not found: ${args.logFile}`);
    process.exit(1);
  }

  let speedMode: 'real' | 'instant' | number;
  const speedNum = Number.parseInt(args.speed, 10);
  if (args.speed === 'real') {
    speedMode = 'real';
  } else if (args.speed === 'instant') {
    speedMode = 'instant';
  } else if (!Number.isNaN(speedNum) && speedNum >= 1 && speedNum <= 100) {
    speedMode = speedNum;
  } else {
    console.error(`Invalid speed mode: ${args.speed}`);
    process.exit(1);
  }

  console.log(`Parsing log file: ${args.logFile}`);
  const parsedLog = parseLogFile(args.logFile);

  console.log(`Found ${parsedLog.actions.length} actions.`);
  console.log(`Duration: ${parsedLog.durationMs}ms`);

  const toIndex =
    args.to === Number.POSITIVE_INFINITY
      ? parsedLog.actions.length - 1
      : args.to;

  console.log(
    `Replaying actions ${args.from} to ${toIndex} at speed: ${args.speed}`,
  );

  const result = await replay(parsedLog, {
    speed: speedMode,
    startFrom: args.from,
    endAt: toIndex,
    skipNoOps: args.skipNoOps,
    capture: args.capture,
    screenshotDir: args.screenshotDir || './screenshots',
    onBeforeAction: (action, index) => {
      process.stdout.write(
        `\r[${index + 1}/${parsedLog.actions.length}] ${action.name}(${action.args.join(',')})`,
      );
    },
    onError: (error, action) => {
      console.error(`\nError executing ${action.name}: ${error.message}`);
    },
  });

  console.log('\n\nReplay complete!');
  console.log(`  Total: ${result.totalActions}`);
  console.log(`  Executed: ${result.executedActions}`);
  console.log(`  Skipped: ${result.skippedActions}`);
  console.log(`  Errors: ${result.errors.length}`);
  console.log(`  Duration: ${result.actualDurationMs}ms`);

  if (result.errors.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
