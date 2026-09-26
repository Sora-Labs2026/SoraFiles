# Linux file managers

Nautilus uses its optional `nautilus-python` extension interface. The lightweight
extension asks the native app for capability-filtered actions with a 1.5-second
deadline. The app revalidates every selected action, file and entitlement at launch.
If the broker is unavailable or returns invalid output, no submenu is displayed.
It does not import processing engines or maintain a separate extension action list.

Dolphin gets a per-user **Edit with SoraFiles** service action for local files. It
opens the same app chooser because KDE service menu files do not support this
dynamic broker menu. Both KDE 5 and KDE 6 service locations are installed.
Per-user service menus are executable (`0755`), as required by Dolphin. First
launch also repairs the permission of an unchanged, owned menu written by an
older release. Extensions and service menus use `$XDG_DATA_HOME` when it is an
absolute path, otherwise `~/.local/share`.

DEB installation or downloading an AppImage alone does not create per-user menu
entries. Launch the app once to register them for that user. Keep an AppImage at
its intended location; launching it after a move repairs its owned menu entries
when the previous executable no longer exists. Existing second installations and
user-edited menu files are preserved.

Users may need to install their distribution's Nautilus Python extension package
and restart the file manager. The helper does not install packages or change global
settings. The app's startup setting writes a per-user XDG autostart entry at
`$XDG_CONFIG_HOME/autostart/com.soralabs.sorafiles.desktop.desktop` (falling back
to `~/.config/autostart`). It starts the current executable with `--background`,
uses an ownership marker, and refuses to overwrite another application's entry;
it never installs a system service or requests root. The writer and ownership
rules have source unit tests. Actual Nautilus/Dolphin interaction, desktop-session
startup, Secret Service access and clean uninstall remain unverified on Linux.

Supported file managers are Nautilus with `nautilus-python` and Dolphin. This
does not register actions for Nemo, Thunar or other file managers. Registration
cannot install the distribution's optional extension package or enable a service
the user disabled in Dolphin's settings.

References: [KDE service menus](https://develop.kde.org/docs/apps/dolphin/service-menus/)
and [GNOME extension locations](https://nautilus-python-d06d4b.pages.gitlab.gnome.org/nautilus-python-overview.html).
