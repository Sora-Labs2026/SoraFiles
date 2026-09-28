# Split PDF Hero Animation Fix

**Status:** fixed and regression-tested in Firefox 154.0.1

## Reproduction

On the homepage, switch the hero demonstration to **Split PDF**, wait through the animation, switch to another scene, and return. The input sheet and separated result pages could appear in the wrong phase or overlap. Firefox also exposed a discrete `visibility` interpolation edge case at the initial frame.

## Root cause

All scene children owned continuously running CSS timelines, including while their parent scene was hidden. Returning to a scene therefore resumed a stale phase instead of starting its demonstration from the beginning. The Split scene also animated `visibility`, a discrete property whose interpolation did not provide a reliable transition boundary in Firefox.

## Fix

- Only the visible scene receives `data-scene-active`; child animations are scoped to that state.
- Scene activation removes the active state, hides every scene, reveals the selected scene, forces one layout flush, and then reapplies the active state. This restarts the selected timeline deterministically.
- Split input/result transitions use opacity instead of animated `visibility`.
- Inactive scenes still use the native `hidden` attribute, so they cannot intercept input or remain visually present.
- `prefers-reduced-motion: reduce` disables scene animation and automatic rotation, presenting a stable Split result.

## Verification

The focused Firefox regression checks the input phase, separated-page phase, repeated activation, inactive-scene hiding, and reduced-motion behavior in a separate browser profile. The production build also completed the broader desktop and 390×844 responsive audits without horizontal overflow.

## Files

- `src/components/HeroVisualization.astro`
- `tests/e2e/v4-regressions.mjs`
- `tests/unit/v4-compat-geo.test.mjs`
