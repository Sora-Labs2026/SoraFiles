export type AmbientMode = 'standard' | 'reduced' | 'off';
export type AmbientPreference = 'on' | 'off';

export interface AmbientCapabilities {
  preference: AmbientPreference;
  reducedMotion: boolean;
  saveData: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  mobile: boolean;
}

export interface AmbientProfile {
  readonly maxVisible: number;
  readonly spawnMin: number;
  readonly spawnMax: number;
  readonly sizeMin: number;
  readonly sizeMax: number;
  readonly durationMin: number;
  readonly durationMax: number;
  readonly firstDelay: number;
}

export interface BubbleSpec {
  spawnDelay: number;
  size: number;
  duration: number;
  left: number;
  drift: number;
  motif: boolean;
}

const FIRST_DELAY_MS = 1500;
const immutableProfile = (profile: AmbientProfile): AmbientProfile => Object.freeze(profile);

const OFF_PROFILE: AmbientProfile = immutableProfile({
  maxVisible: 0,
  spawnMin: 0,
  spawnMax: 0,
  sizeMin: 0,
  sizeMax: 0,
  durationMin: 0,
  durationMax: 0,
  firstDelay: 0,
});

const profiles: Record<Exclude<AmbientMode, 'off'>, Record<'desktop' | 'mobile', AmbientProfile>> = {
  standard: {
    desktop: immutableProfile({ maxVisible: 5, spawnMin: 4500, spawnMax: 8500, sizeMin: 30, sizeMax: 64, durationMin: 14000, durationMax: 24000, firstDelay: FIRST_DELAY_MS }),
    mobile: immutableProfile({ maxVisible: 2, spawnMin: 7000, spawnMax: 12000, sizeMin: 26, sizeMax: 48, durationMin: 16000, durationMax: 26000, firstDelay: FIRST_DELAY_MS }),
  },
  reduced: {
    desktop: immutableProfile({ maxVisible: 2, spawnMin: 9000, spawnMax: 15000, sizeMin: 28, sizeMax: 52, durationMin: 18000, durationMax: 28000, firstDelay: FIRST_DELAY_MS }),
    mobile: immutableProfile({ maxVisible: 1, spawnMin: 12000, spawnMax: 18000, sizeMin: 26, sizeMax: 42, durationMin: 20000, durationMax: 30000, firstDelay: FIRST_DELAY_MS }),
  },
};

const standardRoutes = new Set([
  '/',
  '/image-converter',
  '/compress-image',
  '/heic-to-jpg',
  '/pdf',
  '/merge-pdf',
  '/split-pdf',
  '/rotate-pdf',
  '/jpg-to-pdf',
  '/pdf-to-jpg',
  '/pdf-to-word',
  '/word-to-pdf',
]);

const reducedRoutes = new Set(['/about', '/open-source']);

export function ambientModeForRoute(pathname: string): AmbientMode {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  if (standardRoutes.has(normalizedPath)) return 'standard';
  if (reducedRoutes.has(normalizedPath)) return 'reduced';
  return 'off';
}

export function resolveAmbientProfile(mode: AmbientMode, capabilities: AmbientCapabilities): AmbientProfile {
  if (
    mode === 'off'
    || capabilities.preference === 'off'
    || capabilities.reducedMotion
    || capabilities.saveData
    || (capabilities.deviceMemory !== undefined && capabilities.deviceMemory <= 2)
    || (capabilities.hardwareConcurrency !== undefined && capabilities.hardwareConcurrency <= 2)
  ) {
    return OFF_PROFILE;
  }

  return profiles[mode][capabilities.mobile ? 'mobile' : 'desktop'];
}

export function bubbleSpecFromUnitValues(profile: AmbientProfile, values: number[]): BubbleSpec {
  const unit = (index: number): number => Math.min(1, Math.max(0, values[index] ?? 0));
  const within = (minimum: number, maximum: number, value: number): number => Math.round(minimum + ((maximum - minimum) * value));
  const motifUnit = unit(5);

  return {
    spawnDelay: within(profile.spawnMin, profile.spawnMax, unit(0)),
    size: within(profile.sizeMin, profile.sizeMax, unit(1)),
    duration: within(profile.durationMin, profile.durationMax, unit(2)),
    left: within(3, 97, unit(3)),
    drift: within(-40, 40, unit(4)),
    motif: motifUnit >= 1 / 3 && motifUnit < 2 / 3,
  };
}

export function fragmentCountFromUnitValue(value: number): number {
  if (!Number.isFinite(value)) return 2;
  return Math.min(4, Math.max(2, 2 + Math.floor(value * 3)));
}
