# Finder integration

The per-user installer generates `~/Library/Services/Edit with SoraFiles.workflow`
using the actual running app executable, so an app outside `/Applications` works.
Finder's Quick Actions / Services entry opens the app's relevant action chooser
with the selected files already loaded. It never interpolates file names into shell
code. Finder Quick Actions do not provide a dynamically populated submenu.

The app's setting should install/remove the service. System Settings → Keyboard →
Keyboard Shortcuts → Services can control its visibility; Finder may require a
relaunch before the service appears. No global setting or Gatekeeper exception is
changed. Unsigned builds may require the user to approve the app in System Settings
→ Privacy & Security. This asset has template tests; actual Finder setup remains
unverified until run on macOS.
