# Linux file managers

Nautilus uses its optional `nautilus-python` extension interface. The lightweight
extension asks the native app for capability-filtered actions with a 1.5-second
deadline. The app revalidates every selected action, file and entitlement at launch.
If the broker is unavailable or returns invalid output, no submenu is displayed.
It does not import processing engines or maintain a separate extension action list.

Dolphin gets a per-user **Edit with SoraFiles** service action for local files. It
opens the same app chooser because KDE service menu files do not support this
dynamic broker menu. Both KDE 5 and KDE 6 service locations are installed.

Users may need to install their distribution's Nautilus Python extension package
and restart the file manager. The helper does not install packages or change global
settings. The app's startup setting writes a per-user XDG autostart entry at
`$XDG_CONFIG_HOME/autostart/com.soralabs.sorafiles.desktop.desktop` (falling back
to `~/.config/autostart`). It starts the current executable with `--background`,
uses an ownership marker, and refuses to overwrite another application's entry;
it never installs a system service or requests root. The writer and ownership
rules have source unit tests. Actual Nautilus/Dolphin interaction, desktop-session
startup, Secret Service access and clean uninstall remain unverified on Linux.
