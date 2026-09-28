# SoraFiles Main Hero Split PDF Animation Fix

## CORRECT TARGET

- hero component: `HeroVisualization`
- file: `src/components/HeroVisualization.astro`
- homepage import path: `src/pages/index.astro` → `src/components/LocalizedHome.astro` → `src/components/HeroVisualization.astro`
- rotating sequence: Merge PDF → Compress PDF → Split PDF → Rotate PDF
- active state: `data-active-scene` on the main hero and `data-scene-active` on its current scene
- rotation logic: the four-item `order` array and 4,000 ms interval in `HeroVisualization.astro`
- Popular Tools component explicitly untouched: YES (`src/components/ToolMotion.astro` was not modified)

## ROOT CAUSE

The main hero and the separate Popular Tools motion component both declared a global keyframe named `sf-split-page`. The Popular Tools definition won in the compiled CSS and used `--motion-x`, while the main hero supplied `--page-x`. During the hero Split phase, the three result pages became opaque but their computed transform was invalid, so they stayed stacked at the same center instead of separating. The earlier opacity-only check did not detect that failure.

## FIX

- exact files changed:
  - `src/components/HeroVisualization.astro`
  - `tests/unit/v4-compat-geo.test.mjs`
  - `tests/e2e/v4-regressions.mjs`
  - `tests/e2e/hero-split-animation.mjs`
- logic changed: restored the required sequence, exposed the active hero scene for deterministic testing, activated only the current scene's animations, and made scene re-entry restart from a clean state without forced reflow or arbitrary timeouts.
- CSS/SVG changed: renamed the hero-only Split keyframe to `sf-hero-split-page`, scoped hero animations to the active scene, and supplied a clearly separated static Split result for reduced motion. SVG markup and the Popular Tools animation were not changed.

## VALIDATION

- dev: PASS — real Chrome run against the Astro development server
- production build: PASS — production-equivalent build and real Chrome preview run
- desktop light: PASS
- desktop dark: PASS
- mobile light (390 px): PASS
- mobile dark (390 px): PASS
- reduced motion: PASS on desktop and mobile; a separated static result remains visible and the hero does not auto-advance
- second cycle restart: PASS — two complete automatic cycles matched Merge → Compress → Split → Rotate, with both Split visits reaching the separated state
- direct Split state: PASS — stable hero controls activate Split without waiting for the interval
- lifecycle: PASS — restart after Rotate, desktop/mobile resizing, back/forward navigation, and hidden/visible interval behavior
- console: PASS — no serious browser console errors

## OTHER HERO STATES

- Merge: PASS
- Compress: PASS
- Rotate: PASS

## FINAL STATUS

FIXED AND VERIFIED
