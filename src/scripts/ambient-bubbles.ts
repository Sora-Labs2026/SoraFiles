import {
  bubbleSpecFromUnitValues,
  fragmentCountFromUnitValue,
  resolveAmbientProfile,
  type AmbientMode,
  type AmbientProfile,
} from '../lib/ambient';

export interface AmbientEnvironment {
  random(): number;
  now(): number;
  setTimer(callback: () => void, delay: number): number;
  clearTimer(id: number): void;
  reducedMotion: MediaQueryList;
  mobileViewport: MediaQueryList;
}

interface AmbientController {
  start(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}

type AmbientPreference = 'on' | 'off';

const PREFERENCE_KEY = 'sora-ambient-bubbles';
const RESUME_DELAY_MS = 2_000;
const SAFETY_MARGIN_MS = 1_000;
const POP_DURATION_MS = 260;
const WORKFLOW_REASONS = ['processing', 'busy', 'drag', 'modal', 'critical-form'] as const;
const motifLabels = ['PDF', 'JPG', 'PNG', 'WEBP'];
const bubbleColors = ['var(--color-blue)', 'var(--color-cyan)', 'var(--color-violet)', 'var(--color-coral)'];
const initializedLayers = new WeakMap<HTMLElement, AmbientController>();
const initializedLayerWindows = new WeakSet<Window>();
const initializedPreferenceControls = new WeakSet<HTMLElement>();
const initializedPreferenceWindows = new WeakSet<Window>();
const ambientPreferences = new WeakMap<Window, AmbientPreference>();
const ambientSystemSuppressions = new WeakMap<Window, boolean>();

function isAmbientPreference(value: unknown): value is AmbientPreference {
  return value === 'on' || value === 'off';
}

function readAmbientPreference(view: Window | null | undefined): AmbientPreference {
  if (!view) return 'on';
  const inMemoryPreference = ambientPreferences.get(view);
  if (inMemoryPreference) return inMemoryPreference;

  let preference: AmbientPreference = 'on';
  try {
    const storedPreference = view.localStorage.getItem(PREFERENCE_KEY);
    if (isAmbientPreference(storedPreference)) preference = storedPreference;
  } catch {}
  ambientPreferences.set(view, preference);
  return preference;
}

function applyAmbientPreferenceToControls(scope: ParentNode, preference: AmbientPreference): void {
  if (typeof scope.querySelectorAll !== 'function') return;
  for (const control of scope.querySelectorAll<HTMLElement>('[data-ambient-preference]')) {
    control.setAttribute('aria-checked', preference === 'on' ? 'true' : 'false');
    const stateLabel = control.querySelector<HTMLElement>('[data-ambient-state-label]');
    if (stateLabel) {
      stateLabel.textContent = preference === 'off'
        ? control.dataset.ambientLabelOff ?? ''
        : ambientSystemSuppressions.get(control.ownerDocument.defaultView!) === true
          ? control.dataset.ambientLabelSuppressed ?? ''
          : control.dataset.ambientLabelOn ?? '';
    }
  }
}

function synchronizeAmbientPreference(view: Window, preference: AmbientPreference): void {
  ambientPreferences.set(view, preference);
  applyAmbientPreferenceToControls(view.document, preference);
}

export function initializeAmbientPreferenceControls(scope: ParentNode): void {
  for (const control of scope.querySelectorAll<HTMLElement>('[data-ambient-preference]')) {
    const view = control.ownerDocument.defaultView;
    if (!view) continue;

    if (!initializedPreferenceWindows.has(view)) {
      initializedPreferenceWindows.add(view);
      view.addEventListener('sora:ambient-preference', (event) => {
        const preference = (event as CustomEvent<{ preference?: unknown }>).detail?.preference;
        if (isAmbientPreference(preference)) synchronizeAmbientPreference(view, preference);
      });
      if (!view.document.querySelector('[data-ambient-layer]')) {
        const reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)');
        const synchronizeSystemSuppression = () => {
          ambientSystemSuppressions.set(view, reducedMotion.matches);
          applyAmbientPreferenceToControls(view.document, readAmbientPreference(view));
        };
        mediaListener(reducedMotion, synchronizeSystemSuppression, 'add');
        synchronizeSystemSuppression();
      }
    }

    applyAmbientPreferenceToControls(view.document, readAmbientPreference(view));
    if (initializedPreferenceControls.has(control)) continue;
    initializedPreferenceControls.add(control);
    control.addEventListener('click', () => {
      const preference: AmbientPreference = readAmbientPreference(view) === 'on' ? 'off' : 'on';
      synchronizeAmbientPreference(view, preference);
      try {
        view.localStorage.setItem(PREFERENCE_KEY, preference);
      } catch {}
      view.dispatchEvent(new view.CustomEvent('sora:ambient-preference', {
        detail: { preference },
      }));
    });
  }
}

function mediaListener(query: MediaQueryList, listener: () => void, action: 'add' | 'remove'): void {
  const legacyQuery = query as unknown as {
    addListener(callback: () => void): void;
    removeListener(callback: () => void): void;
  };
  if (action === 'add') {
    if (typeof query.addEventListener === 'function') query.addEventListener('change', listener);
    else legacyQuery.addListener(listener);
    return;
  }

  if (typeof query.removeEventListener === 'function') query.removeEventListener('change', listener);
  else legacyQuery.removeListener(listener);
}

export function createAmbientBubbles(
  root: HTMLElement,
  mode: AmbientMode,
  environment: Partial<AmbientEnvironment> = {},
): AmbientController {
  const view = root.ownerDocument.defaultView;
  const navigatorWithCapabilities = view?.navigator as (Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  }) | undefined;

  let runtime: AmbientEnvironment | undefined;
  let spawnTimer: number | undefined;
  let resumeTimer: number | undefined;
  let profile: AmbientProfile | undefined;
  let started = false;
  let paused = false;
  let destroyed = false;
  let workflowRecalculationQueued = false;
  let spawnSequence = 0;
  let workflowObserver: MutationObserver | undefined;
  const safetyTimers = new Map<HTMLElement, { id?: number; remaining: number; deadline: number }>();
  const pauseReasons = new Set<string>();
  const activeDragWorkbenches = new Set<HTMLElement>();

  const clearSpawnTimer = (): void => {
    if (spawnTimer === undefined || !runtime) return;
    runtime.clearTimer(spawnTimer);
    spawnTimer = undefined;
  };

  const clearResumeTimer = (): void => {
    if (resumeTimer === undefined || !runtime) return;
    runtime.clearTimer(resumeTimer);
    resumeTimer = undefined;
  };

  const removeBubble = (bubble: HTMLElement): void => {
    const timer = safetyTimers.get(bubble);
    if (timer?.id !== undefined && runtime) {
      try {
        runtime.clearTimer(timer.id);
      } catch {}
    }
    safetyTimers.delete(bubble);
    bubble.remove();
  };

  const removeAllBubbles = (): void => {
    for (const bubble of [...safetyTimers.keys()]) removeBubble(bubble);
    root.replaceChildren();
  };

  const armSafetyTimer = (bubble: HTMLElement, remaining: number): void => {
    if (!runtime || destroyed) return;
    const timer = {
      remaining,
      deadline: runtime.now() + remaining,
      id: undefined as number | undefined,
    };
    timer.id = runtime.setTimer(() => {
      safetyTimers.delete(bubble);
      if (destroyed || paused) return;
      removeBubble(bubble);
    }, remaining);
    safetyTimers.set(bubble, timer);
  };

  const suspendSafetyTimers = (): void => {
    if (!runtime) return;
    for (const timer of safetyTimers.values()) {
      if (timer.id === undefined) continue;
      timer.remaining = Math.max(0, timer.deadline - runtime.now());
      runtime.clearTimer(timer.id);
      timer.id = undefined;
    }
  };

  const rearmSafetyTimers = (): void => {
    for (const [bubble, timer] of safetyTimers) {
      if (timer.id !== undefined) continue;
      armSafetyTimer(bubble, timer.remaining);
    }
  };

  const isVisible = (element: HTMLElement): boolean => {
    if (element.closest('[hidden], [aria-hidden="true"]')) return false;
    return element.getClientRects().length > 0;
  };

  const currentProfile = (): AmbientProfile | undefined => {
    if (!runtime) return undefined;
    return resolveAmbientProfile(mode, {
      preference: readAmbientPreference(view),
      reducedMotion: runtime.reducedMotion.matches,
      saveData: navigatorWithCapabilities?.connection?.saveData === true,
      deviceMemory: navigatorWithCapabilities?.deviceMemory,
      hardwareConcurrency: navigatorWithCapabilities?.hardwareConcurrency,
      mobile: runtime.mobileViewport.matches,
    });
  };

  const scheduleSpawn = (delay: number): void => {
    if (!runtime || destroyed || paused || !profile || profile.maxVisible === 0 || spawnTimer !== undefined) return;
    spawnTimer = runtime.setTimer(() => {
      spawnTimer = undefined;
      safeSpawn();
    }, delay);
  };

  const popBubble = (bubble: HTMLElement): void => {
    if (!runtime || destroyed || paused || bubble.dataset.ambientPopping !== undefined) return;

    const renderedStyle = bubble.ownerDocument.defaultView?.getComputedStyle(bubble);
    if (!renderedStyle) return;
    bubble.style.setProperty('--ambient-pop-transform', renderedStyle.transform);
    bubble.style.setProperty('--ambient-pop-opacity', renderedStyle.opacity);

    const safetyTimer = safetyTimers.get(bubble);
    if (safetyTimer?.id !== undefined) {
      runtime.clearTimer(safetyTimer.id);
      safetyTimers.delete(bubble);
    }

    bubble.dataset.ambientPopping = '';
    const fragmentCount = fragmentCountFromUnitValue(runtime.random());
    for (let index = 0; index < fragmentCount; index += 1) {
      const fragment = root.ownerDocument.createElement('span');
      fragment.dataset.ambientFragment = '';
      fragment.setAttribute('aria-hidden', 'true');
      fragment.style.setProperty('--ambient-fragment-angle', `${Math.round((360 / fragmentCount) * index)}deg`);
      fragment.style.setProperty('--ambient-fragment-distance', `${10 + Math.round(runtime.random() * 10)}px`);
      bubble.append(fragment);
    }

    armSafetyTimer(bubble, POP_DURATION_MS + SAFETY_MARGIN_MS);
  };

  const handlePointerUp = (event: PointerEvent): void => {
    if (destroyed || event.isPrimary === false) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const blockedTarget = target.closest('a, button, input, select, textarea, summary, label, form, dialog, iframe, [contenteditable="true"], [role="button"], [role="link"], [role^="menuitem"], [data-workbench], ins.adsbygoogle, [data-ad]');
    if (blockedTarget) return;
    const directBubble = target.closest<HTMLElement>('[data-ambient-bubble]');
    const bubble = directBubble && root.contains(directBubble)
      ? directBubble
      : [...root.querySelectorAll<HTMLElement>('[data-ambient-bubble]')].reverse().find((candidate) => {
          const rect = candidate.getBoundingClientRect();
          return event.clientX >= rect.left && event.clientX <= rect.right
            && event.clientY >= rect.top && event.clientY <= rect.bottom
            && Number.parseFloat(candidate.ownerDocument.defaultView?.getComputedStyle(candidate).opacity ?? '0') > 0;
        });
    if (bubble && root.contains(bubble)) {
      try {
        popBubble(bubble);
      } catch {
        controller.destroy();
        root.dataset.ambientState = 'suppressed';
      }
    }
  };

  const spawn = (): void => {
    if (!runtime || destroyed || paused || !profile || profile.maxVisible === 0) return;

    const visibleCount = root.querySelectorAll('[data-ambient-bubble]').length;
    const values = Array.from({ length: 7 }, () => runtime!.random());
    const spec = bubbleSpecFromUnitValues(profile, values);

    if (visibleCount < profile.maxVisible) {
      spawnSequence += 1;
      const bubble = root.ownerDocument.createElement('span');
      bubble.className = 'ambient-bubble';
      bubble.dataset.ambientBubble = '';
      bubble.setAttribute('aria-hidden', 'true');
      bubble.style.setProperty('--ambient-size', `${spec.size}px`);
      bubble.style.setProperty('--ambient-duration', `${spec.duration}ms`);
      bubble.style.setProperty('--ambient-left', `${spec.left}%`);
      bubble.style.setProperty('--ambient-drift', `${spec.drift}px`);
      bubble.style.setProperty('--ambient-color', bubbleColors[Math.min(bubbleColors.length - 1, Math.floor(values[6] * bubbleColors.length))]);

      if (spec.motif && spawnSequence % 3 === 0) {
        bubble.dataset.ambientMotif = '';
        bubble.textContent = motifLabels[(spawnSequence / 3 - 1) % motifLabels.length];
      }

      bubble.addEventListener('animationend', () => removeBubble(bubble), { once: true });
      root.append(bubble);
      armSafetyTimer(bubble, spec.duration + SAFETY_MARGIN_MS);
    }

    scheduleSpawn(spec.spawnDelay);
  };

  const safeSpawn = (): void => {
    try {
      spawn();
    } catch {
      controller.destroy();
      root.dataset.ambientState = 'suppressed';
    }
  };

  const setPauseReason = (reason: string, active: boolean): void => {
    if (destroyed) return;
    if (active) pauseReasons.add(reason);
    else pauseReasons.delete(reason);
    if (pauseReasons.size) controller.pause();
    else controller.resume();
  };

  const recalculateWorkflowReasons = (): void => {
    workflowRecalculationQueued = false;
    if (!started || destroyed) return;

    const document = root.ownerDocument;
    if (typeof document.querySelectorAll !== 'function') return;
    const workbenches = [...document.querySelectorAll<HTMLElement>('[data-workbench]')];
    const nextReasons = new Set<string>();
    if ([...document.querySelectorAll<HTMLElement>('[data-workbench-processing]')].some(isVisible)) {
      nextReasons.add('processing');
    }
    if (workbenches.some((workbench) => workbench.matches('[aria-busy="true"]') || workbench.querySelector('[aria-busy="true"]'))) {
      nextReasons.add('busy');
    }
    if (workbenches.some((workbench) => [...workbench.querySelectorAll<HTMLElement>('button:disabled')].some(isVisible))) {
      nextReasons.add('busy');
    }
    if (workbenches.some((workbench) => workbench.matches('[data-workbench-drag-active]:not([data-workbench-drag-active="false"])') || workbench.querySelector('[data-workbench-drag-active]:not([data-workbench-drag-active="false"])'))) {
      nextReasons.add('drag');
    }
    if (activeDragWorkbenches.size > 0) nextReasons.add('drag');
    if ([...document.querySelectorAll<HTMLElement>('dialog[open], [role="dialog"][aria-modal="true"]')].some(isVisible)) {
      nextReasons.add('modal');
    }
    const criticalForm = document.activeElement?.closest?.('[data-critical-form]');
    if (criticalForm && document.contains(criticalForm)) nextReasons.add('critical-form');

    for (const reason of WORKFLOW_REASONS) {
      if (nextReasons.has(reason)) setPauseReason(reason, true);
    }
    for (const reason of WORKFLOW_REASONS) {
      if (!nextReasons.has(reason)) setPauseReason(reason, false);
    }
  };

  const queueWorkflowRecalculation = (): void => {
    if (workflowRecalculationQueued || destroyed) return;
    workflowRecalculationQueued = true;
    queueMicrotask(recalculateWorkflowReasons);
  };

  const refreshForMediaChange = (): void => {
    try {
      if (!started || destroyed) return;
      clearSpawnTimer();
      clearResumeTimer();
      removeAllBubbles();
      profile = currentProfile();
      if (!profile || profile.maxVisible === 0) {
        if (view) {
          ambientSystemSuppressions.set(view, readAmbientPreference(view) === 'on');
          applyAmbientPreferenceToControls(root.ownerDocument, readAmbientPreference(view));
        }
        root.dataset.ambientState = 'suppressed';
        return;
      }
      if (view) {
        ambientSystemSuppressions.set(view, false);
        applyAmbientPreferenceToControls(root.ownerDocument, readAmbientPreference(view));
      }
      if (pauseReasons.size) {
        paused = true;
        root.dataset.ambientState = 'paused';
      } else {
        paused = false;
        root.dataset.ambientState = 'running';
        scheduleSpawn(profile.firstDelay);
      }
    } catch {
      controller.destroy();
      root.dataset.ambientState = 'suppressed';
    }
  };

  const handlePageHide = (event: PageTransitionEvent): void => {
    controller.destroy();
    if (event.persisted) initializedLayers.delete(root);
  };
  const handleVisibilityChange = (): void => setPauseReason('visibility', root.ownerDocument.hidden);
  const handleDragActive = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const workbench = target.closest<HTMLElement>('[data-workbench]');
    if (!workbench) return;
    activeDragWorkbenches.add(workbench);
    setPauseReason('drag', true);
  };
  const handleDragInactive = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const workbench = target.closest<HTMLElement>('[data-workbench]');
    if (!workbench) return;
    if (event.type === 'dragleave' && event instanceof DragEvent && event.relatedTarget instanceof Node && workbench.contains(event.relatedTarget)) return;
    activeDragWorkbenches.delete(workbench);
    setPauseReason('drag', activeDragWorkbenches.size > 0);
  };
  const handleDragEnd = (): void => {
    activeDragWorkbenches.clear();
    setPauseReason('drag', false);
  };
  const handleCriticalWorkflow = (event: Event): void => {
    const active = (event as CustomEvent<{ active?: unknown }>).detail?.active;
    if (typeof active === 'boolean') setPauseReason('explicit-workflow', active);
  };
  const handleAmbientPreference = (event: Event): void => {
    const preference = (event as CustomEvent<{ preference?: unknown }>).detail?.preference;
    if (!view || !isAmbientPreference(preference)) return;
    ambientPreferences.set(view, preference);
    refreshForMediaChange();
  };

  const controller: AmbientController = {
    start(): void {
      if (started || destroyed) return;
      started = true;

      try {
        if (!view) throw new Error('Ambient visuals require a browser window.');
        runtime = {
          random: environment.random ?? Math.random,
          now: environment.now ?? (() => view.performance.now()),
          setTimer: environment.setTimer ?? ((callback, delay) => view.setTimeout(callback, delay)),
          clearTimer: environment.clearTimer ?? ((id) => view.clearTimeout(id)),
          reducedMotion: environment.reducedMotion ?? view.matchMedia('(prefers-reduced-motion: reduce)'),
          mobileViewport: environment.mobileViewport ?? view.matchMedia('(max-width: 767px)'),
        };
        profile = currentProfile();
        mediaListener(runtime.reducedMotion, refreshForMediaChange, 'add');
        mediaListener(runtime.mobileViewport, refreshForMediaChange, 'add');
        view.addEventListener('sora:ambient-preference', handleAmbientPreference);
        view.addEventListener('sora:critical-workflow', handleCriticalWorkflow);
        view.addEventListener('pagehide', handlePageHide, { once: true });
        root.ownerDocument.addEventListener?.('visibilitychange', handleVisibilityChange);
        root.ownerDocument.addEventListener?.('focusin', queueWorkflowRecalculation);
        root.ownerDocument.addEventListener?.('focusout', queueWorkflowRecalculation);
        root.ownerDocument.addEventListener?.('dragenter', handleDragActive);
        root.ownerDocument.addEventListener?.('dragover', handleDragActive);
        root.ownerDocument.addEventListener?.('dragleave', handleDragInactive);
        root.ownerDocument.addEventListener?.('drop', handleDragInactive);
        root.ownerDocument.addEventListener?.('dragend', handleDragEnd);
        root.ownerDocument.addEventListener?.('pointerup', handlePointerUp);
        if (typeof view.MutationObserver === 'function') {
          workflowObserver = new view.MutationObserver(queueWorkflowRecalculation);
        }
        if (workflowObserver && root.ownerDocument.body) {
          workflowObserver.observe(root.ownerDocument.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['hidden', 'class', 'style', 'disabled', 'aria-hidden', 'aria-busy', 'open', 'role', 'aria-modal', 'data-workbench-processing', 'data-workbench-drag-active', 'data-critical-form'],
          });
        }
        setPauseReason('visibility', root.ownerDocument.hidden);
        recalculateWorkflowReasons();

        if (!profile || profile.maxVisible === 0) {
          ambientSystemSuppressions.set(view, readAmbientPreference(view) === 'on');
          applyAmbientPreferenceToControls(root.ownerDocument, readAmbientPreference(view));
          root.dataset.ambientState = 'suppressed';
          return;
        }

        ambientSystemSuppressions.set(view, false);
        applyAmbientPreferenceToControls(root.ownerDocument, readAmbientPreference(view));
        if (pauseReasons.size) {
          paused = true;
          root.dataset.ambientState = 'paused';
        } else {
          root.dataset.ambientState = 'running';
          scheduleSpawn(profile.firstDelay);
        }
      } catch {
        controller.destroy();
        root.dataset.ambientState = 'suppressed';
      }
    },

    pause(): void {
      if (!started || destroyed) return;
      const wasPaused = paused;
      paused = true;
      try {
        clearSpawnTimer();
        clearResumeTimer();
        if (!wasPaused) suspendSafetyTimers();
        root.dataset.ambientState = 'paused';
      } catch {
        controller.destroy();
        root.dataset.ambientState = 'suppressed';
      }
    },

    resume(): void {
      if (!runtime || !started || destroyed || !paused || resumeTimer !== undefined) return;
      profile = currentProfile();
      if (!profile || profile.maxVisible === 0) {
        root.dataset.ambientState = 'suppressed';
        return;
      }

      root.dataset.ambientState = 'resuming';
      try {
        resumeTimer = runtime.setTimer(() => {
          resumeTimer = undefined;
          if (destroyed) return;
          try {
            rearmSafetyTimers();
            paused = false;
            root.dataset.ambientState = 'running';
            safeSpawn();
          } catch {
            controller.destroy();
            root.dataset.ambientState = 'suppressed';
          }
        }, RESUME_DELAY_MS);
      } catch {
        controller.destroy();
        root.dataset.ambientState = 'suppressed';
      }
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      paused = true;
      const safely = (callback: () => void): void => {
        try {
          callback();
        } catch {}
      };
      safely(clearSpawnTimer);
      safely(clearResumeTimer);
      safely(removeAllBubbles);
      safely(() => workflowObserver?.disconnect());
      workflowObserver = undefined;
      pauseReasons.clear();
      activeDragWorkbenches.clear();
      if (runtime) {
        safely(() => mediaListener(runtime!.reducedMotion, refreshForMediaChange, 'remove'));
        safely(() => mediaListener(runtime!.mobileViewport, refreshForMediaChange, 'remove'));
      }
      safely(() => view?.removeEventListener('sora:ambient-preference', handleAmbientPreference));
      safely(() => view?.removeEventListener('sora:critical-workflow', handleCriticalWorkflow));
      safely(() => view?.removeEventListener('pagehide', handlePageHide));
      safely(() => root.ownerDocument.removeEventListener?.('visibilitychange', handleVisibilityChange));
      safely(() => root.ownerDocument.removeEventListener?.('focusin', queueWorkflowRecalculation));
      safely(() => root.ownerDocument.removeEventListener?.('focusout', queueWorkflowRecalculation));
      safely(() => root.ownerDocument.removeEventListener?.('dragenter', handleDragActive));
      safely(() => root.ownerDocument.removeEventListener?.('dragover', handleDragActive));
      safely(() => root.ownerDocument.removeEventListener?.('dragleave', handleDragInactive));
      safely(() => root.ownerDocument.removeEventListener?.('drop', handleDragInactive));
      safely(() => root.ownerDocument.removeEventListener?.('dragend', handleDragEnd));
      safely(() => root.ownerDocument.removeEventListener?.('pointerup', handlePointerUp));
      root.dataset.ambientState = 'destroyed';
    },
  };

  return controller;
}

export function initializeAmbientLayers(scope: ParentNode): void {
  for (const root of scope.querySelectorAll<HTMLElement>('[data-ambient-layer]')) {
    const view = root.ownerDocument.defaultView;
    if (view && !initializedLayerWindows.has(view)) {
      initializedLayerWindows.add(view);
      view.addEventListener('pageshow', (event) => {
        if (event.persisted) initializeAmbientLayers(view.document);
      });
    }
    if (initializedLayers.has(root)) continue;
    const mode = root.dataset.ambientMode;
    if (mode !== 'standard' && mode !== 'reduced') continue;
    const controller = createAmbientBubbles(root, mode);
    initializedLayers.set(root, controller);
    controller.start();
  }
}
