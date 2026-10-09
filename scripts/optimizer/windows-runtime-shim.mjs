// TSX asks Node for the current POSIX user ID when one exists and otherwise
// calls os.userInfo(). Some locked-down Windows sessions can make that OS call
// fail even though the filesystem and Node runtime are healthy. Supplying the
// conventional non-privileged numeric identity keeps the loader deterministic
// and does not change OS identity, permissions, or environment state.
if (process.platform === 'win32' && typeof process.geteuid !== 'function') {
  Object.defineProperty(process, 'geteuid', { configurable: true, value: () => 1000 });
}

// Browser engine modules import Vite `?url` assets; give those a path string under node:test.
import { register } from 'node:module';
register('./vite-url-loader.mjs', import.meta.url);
