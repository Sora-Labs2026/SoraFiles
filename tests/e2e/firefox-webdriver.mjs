import { spawn } from 'node:child_process';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';

const elementKey = 'element-6066-11e4-a52e-4f735466cecf';
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class FirefoxWebDriver {
  constructor(options = {}) {
    this.binary = options.binary ?? process.env.SORA_FIREFOX_BINARY ?? '/Applications/Firefox.app/Contents/MacOS/firefox';
    this.driverBinary = options.driverBinary ?? process.env.SORA_GECKODRIVER_BINARY ?? '/tmp/sorafiles-geckodriver/geckodriver';
    this.downloadDir = options.downloadDir;
    this.port = Number(options.port ?? process.env.SORA_GECKODRIVER_PORT ?? 4446);
    this.headless = options.headless !== false;
    this.prefs = options.prefs ?? {};
    this.process = null;
    this.sessionId = null;
    this.driverOutput = '';
  }

  async request(path, init = {}, allowNoSession = false) {
    const prefix = allowNoSession || !this.sessionId ? '' : `/session/${this.sessionId}`;
    const response = await fetch(`http://127.0.0.1:${this.port}${prefix}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.value?.error) {
      const detail = payload?.value?.message ?? JSON.stringify(payload);
      throw new Error(`WebDriver ${init.method ?? 'GET'} ${path} failed (${response.status}): ${detail}`);
    }
    return payload.value;
  }

  async start() {
    if (!this.downloadDir) throw new Error('FirefoxWebDriver requires an explicit downloadDir.');
    await mkdir(this.downloadDir, { recursive: true });
    this.process = spawn(this.driverBinary, ['--host', '127.0.0.1', '--port', String(this.port)], { stdio: ['ignore', 'pipe', 'pipe'] });
    const collect = (chunk) => { this.driverOutput = `${this.driverOutput}${chunk}`.slice(-30_000); };
    this.process.stdout.on('data', collect);
    this.process.stderr.on('data', collect);

    const serviceDeadline = Date.now() + 20_000;
    while (Date.now() < serviceDeadline) {
      try {
        await this.request('/status', {}, true);
        break;
      } catch {
        await delay(150);
      }
    }

    const mimeTypes = [
      'application/pdf', 'application/zip', 'application/octet-stream', 'text/plain',
      'image/jpeg', 'image/png', 'image/webp',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ].join(',');
    const args = this.headless ? ['-headless', '-remote-allow-system-access'] : ['-remote-allow-system-access'];
    const session = await this.request('/session', {
      method: 'POST',
      body: JSON.stringify({
        capabilities: {
          alwaysMatch: {
            browserName: 'firefox',
            acceptInsecureCerts: true,
            'moz:firefoxOptions': {
              binary: this.binary,
              args,
              log: { level: 'error' },
              prefs: {
                'browser.download.folderList': 2,
                'browser.download.dir': this.downloadDir,
                'browser.download.useDownloadDir': true,
                'browser.download.manager.showWhenStarting': false,
                'browser.download.alwaysOpenPanel': false,
                'browser.download.viewableInternally.enabledTypes': '',
                'browser.helperApps.neverAsk.saveToDisk': mimeTypes,
                'pdfjs.disabled': true,
                'dom.webnotifications.enabled': false,
                ...this.prefs,
              },
            },
          },
        },
      }),
    }, true);
    this.sessionId = session.sessionId;
    await this.request('/timeouts', { method: 'POST', body: JSON.stringify({ implicit: 0, pageLoad: 120_000, script: 180_000 }) });
    return session.capabilities;
  }

  async stop() {
    if (this.sessionId) {
      try { await this.request('', { method: 'DELETE' }); } catch {}
      this.sessionId = null;
    }
    if (this.process && !this.process.killed) this.process.kill('SIGTERM');
    this.process = null;
  }

  async navigate(url) {
    await this.request('/url', { method: 'POST', body: JSON.stringify({ url }) });
  }

  async setViewport(width, height) {
    return this.request('/window/rect', { method: 'POST', body: JSON.stringify({ width, height }) });
  }

  async setPageZoom(zoom) {
    await this.request('/moz/context', { method: 'POST', body: JSON.stringify({ context: 'chrome' }) });
    try {
      await this.execute('const browser=window.gBrowser?.selectedBrowser; if(!browser) throw new Error("No selected browser"); browser.fullZoom=arguments[0]; return browser.fullZoom;', [zoom]);
    } finally {
      await this.request('/moz/context', { method: 'POST', body: JSON.stringify({ context: 'content' }) });
    }
  }

  async find(selector) {
    return this.request('/element', { method: 'POST', body: JSON.stringify({ using: 'css selector', value: selector }) });
  }

  async findAll(selector) {
    return this.request('/elements', { method: 'POST', body: JSON.stringify({ using: 'css selector', value: selector }) });
  }

  async exists(selector) {
    return (await this.findAll(selector)).length > 0;
  }

  async execute(script, args = []) {
    return this.request('/execute/sync', { method: 'POST', body: JSON.stringify({ script, args }) });
  }

  async executeAsync(script, args = []) {
    return this.request('/execute/async', { method: 'POST', body: JSON.stringify({ script, args }) });
  }

  async waitFor(selector, options = {}) {
    const visible = options.visible !== false;
    const hidden = options.hidden === true;
    const timeout = options.timeout ?? 60_000;
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const state = await this.execute(`
        const node = document.querySelector(arguments[0]);
        if (!node) return { exists: false, visible: false };
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return { exists: true, visible: !node.hidden && style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 };
      `, [selector]);
      if (hidden ? !state.visible : (visible ? state.visible : state.exists)) return state;
      await delay(150);
    }
    throw new Error(`Timed out waiting for ${hidden ? 'hidden ' : ''}${selector}.`);
  }

  async waitUntil(script, args = [], timeout = 60_000, description = 'condition') {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await this.execute(script, args)) return;
      await delay(180);
    }
    throw new Error(`Timed out waiting for ${description}.`);
  }

  async click(selector) {
    const element = await this.find(selector);
    await this.execute('arguments[0].scrollIntoView({block:"center",inline:"center"});', [element]);
    return this.request(`/element/${element[elementKey]}/click`, { method: 'POST', body: '{}' });
  }

  async clickJs(selector) {
    const clicked = await this.execute('const node=document.querySelector(arguments[0]); if(!node)return false; node.scrollIntoView({block:"center"}); node.click(); return true;', [selector]);
    if (!clicked) throw new Error(`Cannot click missing selector ${selector}.`);
  }

  async sendKeys(selector, value, clear = false) {
    const element = await this.find(selector);
    if (clear) await this.request(`/element/${element[elementKey]}/clear`, { method: 'POST', body: '{}' });
    return this.request(`/element/${element[elementKey]}/value`, { method: 'POST', body: JSON.stringify({ text: String(value), value: [...String(value)] }) });
  }

  async setFiles(selector, files) {
    const paths = Array.isArray(files) ? files : [files];
    return this.sendKeys(selector, paths.join('\n'), false);
  }

  async setValue(selector, value, eventName = 'input') {
    const changed = await this.execute(`
      const node = document.querySelector(arguments[0]);
      if (!node) return false;
      node.value = String(arguments[1]);
      node.dispatchEvent(new Event(arguments[2], { bubbles: true }));
      if (arguments[2] !== 'change') node.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    `, [selector, value, eventName]);
    if (!changed) throw new Error(`Cannot set missing selector ${selector}.`);
  }

  async check(selector) {
    const changed = await this.execute('const node=document.querySelector(arguments[0]); if(!node)return false; if(!node.checked)node.click(); return node.checked;', [selector]);
    if (!changed) throw new Error(`Cannot check ${selector}.`);
  }

  async text(selector) {
    return this.execute('return document.querySelector(arguments[0])?.textContent ?? "";', [selector]);
  }

  async attribute(selector, name) {
    return this.execute('return document.querySelector(arguments[0])?.getAttribute(arguments[1]);', [selector, name]);
  }

  async value(selector) {
    return this.execute('return document.querySelector(arguments[0])?.value;', [selector]);
  }

  async dragBy(selector, deltaX, deltaY) {
    const element = await this.find(selector);
    const rect = await this.request(`/element/${element[elementKey]}/rect`);
    const startX = Math.round(rect.x + rect.width / 2);
    const startY = Math.round(rect.y + rect.height / 2);
    await this.request('/actions', {
      method: 'POST',
      body: JSON.stringify({ actions: [{ type: 'pointer', id: 'qa-mouse', parameters: { pointerType: 'mouse' }, actions: [
        { type: 'pointerMove', duration: 0, x: startX, y: startY, origin: 'viewport' },
        { type: 'pointerDown', button: 0 },
        { type: 'pointerMove', duration: 450, x: startX + deltaX, y: startY + deltaY, origin: 'viewport' },
        { type: 'pointerUp', button: 0 },
      ] }] }),
    });
    await this.request('/actions', { method: 'DELETE' });
  }

  async screenshot(path) {
    const base64 = await this.request('/screenshot');
    await writeFile(path, Buffer.from(base64, 'base64'));
  }

  async installPrivacyProbe() {
    await this.execute(`
      window.__soraQaNetwork = [];
      const record = (method, url) => window.__soraQaNetwork.push({ method: String(method || 'GET').toUpperCase(), url: String(url) });
      const originalFetch = window.fetch.bind(window);
      window.fetch = function(input, init = {}) { record(init.method || input?.method || 'GET', input?.url || input); return originalFetch(input, init); };
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url, ...rest) { this.__soraQaMethod = method; this.__soraQaUrl = url; return originalOpen.call(this, method, url, ...rest); };
      const originalSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function(...args) { record(this.__soraQaMethod || 'GET', this.__soraQaUrl || ''); return originalSend.apply(this, args); };
      if (navigator.sendBeacon) { const originalBeacon = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = function(url, data) { record('BEACON', url); return originalBeacon(url, data); }; }
    `);
  }

  async privacyRequests() {
    return this.execute('return window.__soraQaNetwork || [];');
  }

  async pageHealth() {
    return this.execute(`return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      h1: document.querySelectorAll('h1').length,
      workspace: Boolean(document.querySelector('[data-adaptive-workspace]')),
      title: document.title,
    };`);
  }

  async inspectImage(buffer, mimeType) {
    return this.executeAsync(`
      const [base64, mime, done] = arguments;
      (async () => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        const blob = new Blob([bytes], { type: mime });
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
        const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true }); context.drawImage(bitmap, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let transparent = 0, opaque = 0, variance = 0;
        const first = [pixels[0], pixels[1], pixels[2]];
        const step = Math.max(4, Math.floor(pixels.length / 100000 / 4) * 4);
        for (let index = 0; index < pixels.length; index += step) {
          if (pixels[index + 3] < 250) transparent += 1; else opaque += 1;
          variance += Math.abs(pixels[index] - first[0]) + Math.abs(pixels[index + 1] - first[1]) + Math.abs(pixels[index + 2] - first[2]);
        }
        bitmap.close(); done({ width: canvas.width, height: canvas.height, transparent, opaque, variance });
      })().catch((error) => done({ error: error.message }));
    `, [buffer.toString('base64'), mimeType]);
  }

  async waitForDownload(action, options = {}) {
    const timeout = options.timeout ?? 120_000;
    const before = new Set(await readdir(this.downloadDir));
    const started = Date.now();
    await action();
    let stable = null;
    let stableSize = -1;
    while (Date.now() - started < timeout) {
      const names = await readdir(this.downloadDir);
      const candidates = names.filter((name) => !before.has(name) && !name.startsWith('._') && !name.endsWith('.part'));
      for (const name of candidates) {
        const path = `${this.downloadDir}/${name}`;
        const info = await stat(path);
        if (info.size <= 0) continue;
        if (stable === path && stableSize === info.size) return path;
        stable = path;
        stableSize = info.size;
      }
      await delay(250);
    }
    throw new Error(`No completed browser download appeared within ${timeout} ms.`);
  }
}

export const sleep = delay;
