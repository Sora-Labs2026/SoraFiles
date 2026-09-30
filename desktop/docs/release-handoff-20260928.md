# SoraFiles 0.1.1 release handoff — 28 September 2026

Final native source: `fe0f78fbda71b63fce64b3569b079f090b552d3c`.
Final package run: https://github.com/Sora-Labs2026/SoraFiles/actions/runs/36366271877.
Platform lifecycle run `36366271835` passed on all targets.

The final source adds the owner's Clear selection correction: dismiss single/batch results when all input files are cleared, release retained native job/output handles, and preserve saved files. The focused browser regression passed for Clear selection and removing the final file, for both single and batch results. It does not change engines or licensing.

Previous candidate `36347111294` passed all four package jobs. Its Windows installer was installed on this machine (exit 3010: Explorer restart is required). All 1,994 installed resource hashes and the Explorer DLL matched CI. Actual cold/warm image-to-PDF jobs completed without a window and preserved originals. This preceding candidate does not contain the final Clear selection fix; it is not the final release.

Website source now generates 53 equivalent paths in all 19 languages (1,007 URLs). All Desktop translations reuse the exact existing page components. A structural check matched the main element/class tree on all 133 Desktop pages; Japanese, Arabic and German pricing/checkout links, animation, direction and overflow checks passed. Guide and page links preserve language. Dictionaries are bundled from public source copy and use no runtime translation service; native-speaker editorial review remains pending.

Localized purchase/redeem pages retain no-referrer/no-store handling, query scrubbing, no analytics and exclusion from the service-worker cache. Eight focused checkout/cache tests passed. Sitemap/language validators now distinguish generated noindex Desktop paths from indexed content.

Local preview: http://localhost:4395. Detached server serves `dist`; it is not an operating-system startup service.

Publication/deployment is pending completion of final packages, immutable checksum verification, and final website rebuild. GitHub v0.1.1 exists as a draft. The production revoke-service version `4c80e539-47b2-475f-8a07-3b95e4081cd2` is staged and must be deployed with the matching release. Do not describe draft packages or staged Worker versions as live.
