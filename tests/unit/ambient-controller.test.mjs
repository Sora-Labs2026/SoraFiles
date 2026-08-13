import assert from 'node:assert/strict';
import test from 'node:test';
import { createAmbientBubbles } from '../../src/scripts/ambient-bubbles.ts';

function createControllerHarness({
  random = () => 0.5,
  readStorage = () => null,
  failTimerSetup = false,
  failSetTimerOnCall,
  failClearTimerOnCall,
} = {}) {
  const timers = new Map();
  const windowListeners = new Map();
  const children = [];
  let nextTimerId = 0;
  let setTimerCalls = 0;
  let clearTimerCalls = 0;
  let currentTime = 0;

  const mediaQuery = (matches = false) => {
    const listeners = new Set();
    return {
      matches,
      media: '',
      onchange: null,
      addEventListener(_type, listener) { listeners.add(listener); },
      removeEventListener(_type, listener) { listeners.delete(listener); },
      addListener(listener) { listeners.add(listener); },
      removeListener(listener) { listeners.delete(listener); },
      dispatchEvent() { return true; },
      dispatchChange() {
        for (const listener of [...listeners]) listener();
      },
    };
  };

  const view = {
    navigator: { hardwareConcurrency: 8 },
    localStorage: { getItem: readStorage },
    matchMedia: () => mediaQuery(),
    addEventListener(type, listener) { windowListeners.set(type, listener); },
    removeEventListener(type) { windowListeners.delete(type); },
  };

  const root = {
    dataset: {},
    ownerDocument: {
      defaultView: view,
      createElement() {
        const listeners = new Map();
        const element = {
          className: '',
          dataset: {},
          style: { setProperty() {} },
          textContent: '',
          setAttribute() {},
          addEventListener(type, listener) { listeners.set(type, listener); },
          remove() {
            const index = children.indexOf(element);
            if (index >= 0) children.splice(index, 1);
          },
        };
        return element;
      },
    },
    querySelectorAll() { return children; },
    append(element) { children.push(element); },
    replaceChildren() { children.splice(0); },
  };

  const environment = {
    random,
    now: () => currentTime,
    setTimer(callback, delay) {
      setTimerCalls += 1;
      if (failTimerSetup || setTimerCalls === failSetTimerOnCall) throw new Error('timer unavailable');
      const id = ++nextTimerId;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimer(id) {
      clearTimerCalls += 1;
      if (clearTimerCalls === failClearTimerOnCall) throw new Error('timer clear unavailable');
      timers.delete(id);
    },
    reducedMotion: mediaQuery(),
    mobileViewport: mediaQuery(),
  };

  return {
    controller: createAmbientBubbles(root, 'standard', environment),
    root,
    timers,
    runNextTimer() {
      const entry = [...timers.entries()].sort((left, right) => left[1].delay - right[1].delay)[0];
      if (!entry) throw new Error('Expected a pending timer.');
      const [id, timer] = entry;
      timers.delete(id);
      timer.callback();
    },
    elapse(milliseconds) {
      currentTime += milliseconds;
    },
    dispatchPageHide() {
      windowListeners.get('pagehide')?.({ persisted: false });
    },
    windowListenerCount() {
      return windowListeners.size;
    },
    dispatchMobileChange() {
      environment.mobileViewport.dispatchChange();
    },
  };
}

test('pause clears the pending resume timer without allowing a delayed restart', () => {
  const { controller, root, timers } = createControllerHarness();
  controller.start();
  controller.pause();
  controller.resume();

  assert.equal(timers.size, 1);
  assert.equal([...timers.values()][0].delay, 2_000);

  controller.pause();

  assert.equal(timers.size, 0);
  assert.equal(root.dataset.ambientState, 'paused');
});

test('an asynchronous environment failure closes the layer without escaping the timer callback', () => {
  const { controller, root, timers, runNextTimer } = createControllerHarness({
    random: () => { throw new Error('random unavailable'); },
  });
  controller.start();

  assert.doesNotThrow(runNextTimer);
  assert.equal(root.querySelectorAll().length, 0);
  assert.equal(timers.size, 0);
  assert.equal(root.dataset.ambientState, 'suppressed');
});

test('repeated spawn callbacks keep nodes and timers within the desktop profile limit', () => {
  const { controller, root, timers, runNextTimer } = createControllerHarness();
  controller.start();

  for (let index = 0; index < 9; index += 1) runNextTimer();

  assert.equal(root.querySelectorAll().length, 5);
  assert.equal(timers.size, 6, '5 safety timers plus exactly 1 spawn timer');
});

test('pagehide destroys every bubble and pending timer', () => {
  const { controller, root, timers, runNextTimer, dispatchPageHide } = createControllerHarness();
  controller.start();
  runNextTimer();
  assert.equal(root.querySelectorAll().length, 1);

  dispatchPageHide();

  assert.equal(root.querySelectorAll().length, 0);
  assert.equal(timers.size, 0);
  assert.equal(root.dataset.ambientState, 'destroyed');
});

test('storage read failures retain an in-memory on preference without logging or stopping startup', () => {
  const { controller, root, timers } = createControllerHarness({
    readStorage: () => { throw new Error('storage blocked'); },
  });

  assert.doesNotThrow(() => controller.start());
  assert.equal(root.dataset.ambientState, 'running');
  assert.equal(timers.size, 1);
});

test('startup failure removes lifecycle listeners before suppressing the layer', () => {
  const { controller, root, timers, windowListenerCount } = createControllerHarness({ failTimerSetup: true });

  assert.doesNotThrow(() => controller.start());
  assert.equal(root.dataset.ambientState, 'suppressed');
  assert.equal(timers.size, 0);
  assert.equal(windowListenerCount(), 0);
});

test('a second-call timer failure during resume suppresses the layer without escaping or staying resuming', () => {
  const { controller, root, timers, windowListenerCount } = createControllerHarness({ failSetTimerOnCall: 2 });
  controller.start();
  controller.pause();

  assert.doesNotThrow(() => controller.resume());
  assert.equal(root.dataset.ambientState, 'suppressed');
  assert.equal(timers.size, 0);
  assert.equal(windowListenerCount(), 0);
});

test('a second-call timer failure during adaptive media restart fails closed inside the change listener', () => {
  const harness = createControllerHarness({ failSetTimerOnCall: 2 });
  harness.controller.start();

  assert.doesNotThrow(() => harness.dispatchMobileChange());
  assert.equal(harness.root.dataset.ambientState, 'suppressed');
  assert.equal(harness.timers.size, 0);
  assert.equal(harness.windowListenerCount(), 0);
});

test('a clear failure during pause suppresses the layer and leaves any uncancelled callback inert', () => {
  const harness = createControllerHarness({ failClearTimerOnCall: 1 });
  harness.controller.start();

  assert.doesNotThrow(() => harness.controller.pause());
  assert.equal(harness.root.dataset.ambientState, 'suppressed');
  assert.equal(harness.windowListenerCount(), 0);
  if (harness.timers.size > 0) assert.doesNotThrow(() => harness.runNextTimer());
  assert.equal(harness.root.querySelectorAll().length, 0);
  assert.equal(harness.timers.size, 0);
});

test('a clear failure during destroy still completes cleanup and leaves pending callbacks inert', () => {
  const harness = createControllerHarness({ failClearTimerOnCall: 1 });
  harness.controller.start();

  assert.doesNotThrow(() => harness.controller.destroy());
  assert.equal(harness.root.dataset.ambientState, 'destroyed');
  assert.equal(harness.windowListenerCount(), 0);
  if (harness.timers.size > 0) assert.doesNotThrow(() => harness.runNextTimer());
  assert.equal(harness.root.querySelectorAll().length, 0);
  assert.equal(harness.timers.size, 0);
});

test('a safety-timer clear failure during destroy still removes the rendered bubble', () => {
  const harness = createControllerHarness({ failClearTimerOnCall: 2 });
  harness.controller.start();
  harness.runNextTimer();
  assert.equal(harness.root.querySelectorAll().length, 1);
  assert.doesNotThrow(() => harness.controller.destroy());
  assert.equal(harness.root.dataset.ambientState, 'destroyed');
  assert.equal(harness.root.querySelectorAll().length, 0);
  assert.equal(harness.windowListenerCount(), 0);
});

test('a pause longer than the bubble duration preserves and rearms its remaining safety lifetime', () => {
  const harness = createControllerHarness();
  harness.controller.start();
  harness.runNextTimer();
  assert.equal(harness.root.querySelectorAll().length, 1);
  const [originalBubble] = harness.root.querySelectorAll();

  harness.controller.pause();
  assert.equal(harness.timers.size, 0, 'pause clears wall-clock safety timers while animation time is frozen');
  harness.elapse(60_000);
  assert.equal(harness.root.querySelectorAll().length, 1, 'a long pause cannot remove a frozen bubble');

  harness.controller.resume();
  harness.runNextTimer();
  assert.ok(harness.root.querySelectorAll().includes(originalBubble), 'resume delay keeps the existing bubble');
  assert.equal(harness.timers.size, 3, 'resume rearms the existing lifetime and schedules one fresh bubble plus one spawn timer');
});

test('a timer failure while rearming bubble safety on resume fails closed inside the delayed callback', () => {
  const harness = createControllerHarness({ failSetTimerOnCall: 5 });
  const consoleErrors = [];
  const originalConsoleError = console.error;
  harness.controller.start();
  harness.runNextTimer();
  assert.equal(harness.root.querySelectorAll().length, 1);

  harness.controller.pause();
  harness.controller.resume();

  console.error = (...args) => consoleErrors.push(args);
  try {
    assert.doesNotThrow(() => harness.runNextTimer());
  } finally {
    console.error = originalConsoleError;
  }
  assert.deepEqual(consoleErrors, []);
  assert.equal(harness.root.dataset.ambientState, 'suppressed');
  assert.equal(harness.root.querySelectorAll().length, 0);
  assert.equal(harness.timers.size, 0);
  assert.equal(harness.windowListenerCount(), 0);
});
