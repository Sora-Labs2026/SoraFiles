SoraFiles Desktop 0.1.1 brings a calmer workspace, clearer Revoke Device verification, adjustable image compression, and new prices.

- Calmer workspace: selected files take the main area, with one options panel and a single primary action. Navigation, headings and the compact file-manager options card are quieter.
- Revoke Device never sends email by itself. Enter the email you used for your purchase and press Send code; SoraFiles checks it against your purchase before any code is sent. Resend waits for a short cooldown, and changing the email starts verification again. Errors say exactly what went wrong (wrong email, expired code, delivery problem).
- New prices: Personal $1.99/month, $19.99/year or $99.99 lifetime (1 device); Team $9.99/month, $99.99/year or $399.99 lifetime (up to 5 devices). Revoke fees: Personal $0.99, $0.99 or $19.99; Team $3.99, $3.99 or $79.99 per occupied seat. Unused Team seats activate for free.
- Revoke Device can be cancelled before payment. Cancel revocation checks with the payment provider first: nothing is charged unless payment is completed, and a payment that already went through finishes the revocation.
- Compress image opens a small settings card: choose quality and an optional maximum width. Compression is stronger below quality 90 (standard JPEG colour subsampling; PNGs keep the smaller of a reduced palette and lossless). Conversions and other default actions still run in the background.
- Warmer look: the website's soft amber glow behind page headings and on settings cards, clearer typography with open word spacing, and a calm Loading indicator instead of "Waiting for Desktop".
- Fixed a rare "failed to acquire webview reference" error after launching SoraFiles twice in quick succession.
- Clear selection also dismisses previous results and their Open buttons. Saved files are kept.
- Improved Windows Explorer installation, file selection, and conditional restart handling; updated macOS and Linux file-manager integration.
- Automatic seven-day trial starts on first app launch on Windows, macOS and Linux.
- Follows the operating system language, with 19 language choices in Settings and English fallback for unsupported languages.

Windows and Linux packages are unsigned. macOS packages are ad-hoc signed and are not notarized; first launch may require System Settings → Privacy & Security → Open Anyway. Windows may request a restart if Explorer has an older component loaded. Automatic updates remain disabled; install the matching package manually.

Packages were built and checked on Windows, both macOS architectures, and Ubuntu 22.04 (build run 36491933793). Verify downloads with SHA256SUMS.txt. Platform file-manager availability varies; see https://sorafiles.com/desktop/help. Translations are bundled offline; native-speaker editorial review is still pending.
