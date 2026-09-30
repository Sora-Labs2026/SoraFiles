# Installed design skills and follow-up review

September 13, 2026. Scoped rating: Good for the reviewed license controls; this is not a release or accessibility certification. SoraFiles remains a quiet file utility with its existing purple accents, Jakarta typography and recognizable lock/file icons.

## Installed references

The requested collections are installed in the owner's Codex skills directory, outside application source and installers. Emil's existing `apple-design` remains intact; Dick Wu's skill is named `apple-hig-design` to avoid a name collision.

| Collection | Reviewed revision |
| --- | --- |
| emilkowalski/skills | d23d7f88a2e21c9e4b1418c7abe420f5c1052ba7 |
| pbakaus/impeccable | cb56ed6c19a07329a9fa0cd4e657bee040156593 |
| leonxlnx/taste-skill | ccbc15639c97057cbfcf32ecebc38ef716e4bb37 |
| dickwu/apple-design-skill | da2da6dd03aacf06da3fecf205347601d38bb141 |

Applied the relevant Emil interaction guidance, Impeccable audit/polish guidance, the taste collection's existing-project review, and Apple HIG references for macOS, accessibility, layout, typography, color, buttons, entering data, keyboards and focus. No wholesale rebranding or additional animation was justified.

## Corrections

| Before | After | Why |
| --- | --- | --- |
| Active trials hid the purchased-license form. Unverifiable trial state showed paid-only recovery actions. | Active and unverifiable trials offer paid activation. Already-bound paid devices retain only verification and device-list actions. | High: a purchased customer must have a reachable next step. Flow finding is reviewer judgment; `entering-data.md > Best practices` supports clearly labeled secure entry. |
| Consecutive license panels touched. | 24 CSS px separates status and activation. | Medium: `layout.md > Best practices`: “Group related items to help people find the information they want.” |
| Some utility controls were below the chosen target size and the desktop shell lacked a skip link. | Updated controls have 44px targets; a focusable main region and skip link support keyboard navigation. | Medium: `buttons.md > Best practices` and `accessibility.md`; CSS pixels are browser measurements, not a native points certification. |

The native host exposes only a boolean activation-availability hint. It does not grant processing access. Online proof, provider validation and signed-entitlement verification remain required; paid device binding cannot be replaced or deactivated through this interface.

## Evidence and limits

- All 101 desktop Node tests passed, including a regression that offers activation for an unverifiable trial without granting access, writing a replacement entitlement, leaking keys or offering replacement of a paid binding.
- Nineteen Rust tests passed; one opt-in real credential-store test was skipped in this run. The private-pipe trial/restart/offline test passed.
- Production native UI build passed. In the synthetic browser host, keyboard navigation, Show/Hide and trial-to-paid transition passed. The paid screen removed the key form and displayed the permanent binding policy.
- Light-theme trial recovery showed a 24px panel gap, 44px Show/Activate buttons and no horizontal overflow at the current 1147px viewport. This is UI evidence with synthetic data, not an actual paid activation.
- The prior Impeccable detector's single header color warning combined light and dark classes. Inspection found the violet light-theme text and transparent dark-theme surface belong to separate themes; retained them as an explained false positive.
- Website production checks passed in the preceding review. Native processing integration, remaining engines, real platform workflows, service deployment and release validation remain incomplete. No installer or launch was published by this review.
