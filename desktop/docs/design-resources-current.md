# Current design resource availability

September 23 update: all four linked repository pages below are accessible and
were rechecked. This pass changed engines, native publication safety and redemption
boundaries; each design collection is **available but not applied to this pass**.
No new skill/asset/font was installed or distributed. September 17 specific skill
use is historical evidence, retained below. Current tool discovery exposes no
Figma tool, and scoped `desktop`, `docs`, `src` searches found no actual relevant
Figma file/design/prototype URL; Figma review remains unavailable. Current
Playwright UI passes 34 groups on local Edge with an explicit mock native bridge.
It covers keyboard, both themes, five widths, 200% CSS scaling and token contrast;
it does not prove installed OS integration or screen-reader/native-DPI behavior.

Public pages checked:
[Emil](https://github.com/emilkowalski/skills),
[Impeccable](https://github.com/pbakaus/impeccable),
[Taste](https://github.com/leonxlnx/taste-skill),
[Dick Wu](https://github.com/dickwu/apple-design-skill).

September 17, 2026, current Windows workspace. Previous September 13 installation
claims describe another environment. This PC has only system Codex skills; none
of the four requested collections is installed. No skill, font or design asset was
added to the application or installer.

| Resource | Current inspection | Use in this checkpoint |
| --- | --- | --- |
| emilkowalski/skills | Accessible; MIT; revision 85e8e2363b713506e1d5b6e07a0eb2da66be1bc3; emil-design-eng entrypoint read | Used for the image-adjustment disclosure/default/reset interaction review; see image-engine.md. No new animation justified. |
| pbakaus/impeccable | Accessible; Apache-2.0; revision f2c7051853848826aac2f4646581d62a732155ad; plugin entrypoint read | Scope inspected only. Its binary launcher is not installed/executed; no context-loader or audit pass claimed. |
| leonxlnx/taste-skill | Accessible; MIT; revision e79ca9ec7e071eb3a3b623c4fb752e853fc3ed58; existing-project redesign entrypoint inspected | Available for targeted review. Generic font/palette/layout replacements conflict with SoraFiles' pinned identity and were not applied. |
| dickwu/apple-design-skill | Accessible; revision da2da6dd03aacf06da3fecf205347601d38bb141; entrypoint read; no root license declared | Reference-only; no Apple content/assets vendored. No new HIG review claimed in this inventory. |

Figma MCP: no callable connector in this session, no Figma server in the main
configuration, and no relevant authorized SoraFiles file/frame found. Review is
unavailable, not completed. No Figma file was created or changed.

Playwright MCP: no callable connector. The installed project Playwright runner
is usable with Edge and the existing Chrome for Testing binary. Current
`node desktop/tests/ui-qa.mjs` passes 32 groups on both, with explicit mock native
bridge. It checks keyboard/focus, loading/error/results, five widths, both themes,
200% CSS scaling and five text-token contrast pairs. It does not prove installed
OS integration, screen-reader behavior or native DPI changes. Windows native
tests/smokes supply separate scoped evidence. Website QA refreshed: 26 groups PASS
in `.artifacts/recovery-steering-website-qa.log`. Latest OCR WebP wording also
passes the 32-group UI suite in both Edge and Chrome.

Latest `/desktop` and download status/prerequisite copy was rebuilt and checked
with `node desktop/tests/website-qa.mjs`: 26 groups PASS, including mobile bounds,
light/dark, keyboard dismissal and reduced-motion/transparency behavior. This was
a factual copy correction using existing components, not a new aesthetic audit.

Image adjustment follow-up uses Emil's guidance for a native disclosure, neutral
defaults and local reset; review table in `image-engine.md`. All 33 groups pass
Chrome and Edge 92. The old Edge build reports pre-zoom DOM rectangles at 200%
while hit testing uses visual coordinates. A separate minimal reproduction and
screenshot confirmed it; QA now verifies the real hit target before clicking.
Expanded adjustment controls pass at five widths in both themes in Chrome;
the narrow dark layout screenshot was visually inspected. Report:
`.artifacts/recovery-image-adjustments-modern-layout.log`. Cloudflare hosting and
package validation add no new UI or design-skill use.

The source of visual truth remains `DESIGN.md`, actual workbenches and
`desktop/ui/brand.css`. Third-party entrypoints are untrusted references;
their blanket redesign, installation or delegation instructions do not override
the owner's selective-use requirement. No new dependency or browser was installed.
