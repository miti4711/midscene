import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import type { LibNut } from './types';

const require = createRequire(import.meta.url);

let libnutInstance: LibNut | null = null;
let libnutLoadError: Error | null = null;

export async function getLibnut(): Promise<LibNut> {
  if (libnutInstance) return libnutInstance;
  if (libnutLoadError) throw libnutLoadError;

  try {
    const libnutModule = require('@computer-use/libnut/dist/import_libnut');
    libnutInstance = libnutModule.libnut as LibNut;
    if (!libnutInstance) {
      throw new Error('libnut module loaded but libnut object is undefined');
    }
    return libnutInstance;
  } catch (error: any) {
    libnutLoadError = error;
    throw new Error(`Failed to load @computer-use/libnut: ${error.message}`);
  }
}

export async function captureScreenshot(): Promise<Buffer> {
  const screenshot = (await import('screenshot-desktop')).default;
  return screenshot({ format: 'png' });
}

export class ClipboardRunner {
  private constructor() {}
  static async paste(text: string): Promise<void> {
    const platform = globalThis.process.platform;

    if (platform === 'darwin') {
      const script = `pbcopy <<< ${quoteForBash(text)}`;
      execFileSync('bash', ['-c', script]);
    } else if (platform === 'win32') {
      execFileSync('cmd', ['/c', `echo ${text} | clip`]);
    } else {
      try {
        const clipboardy = await import('clipboardy');
        await clipboardy.default.write(text);
      } catch {
        throw new Error(
          'Clipboard paste requires macOS, Windows, or clipboardy (Linux/X11). Install xclip or xsel.',
        );
      }
    }
  }
}

function quoteForBash(text: string): string {
  const safe = text.replace(/'/g, "'\"'\"'");
  return `'${safe}'`;
}

export async function loadLibnut(): Promise<LibNut> {
  return getLibnut();
}
