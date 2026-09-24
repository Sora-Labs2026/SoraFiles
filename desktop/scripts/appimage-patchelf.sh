#!/bin/sh
set -eu
# The processing pack has already passed isolated runtime/codec verification.
# Preserve its upstream ELF bytes and existing package-relative library paths.
# linuxdeploy may still inspect them; only its automatic RPATH rewrite is skipped.
# The Rust app and AppImage system libraries retain normal linuxdeploy handling.
if [ "$#" -eq 3 ] && [ "$1" = '--set-rpath' ]; then
  case "$3" in
    */license-host/node|*/license-host/node_modules/@img/sharp-linux-x64/lib/sharp-linux-x64-0.35.4.node|*/license-host/node_modules/@img/sharp-libvips-linux-x64/lib/libvips-cpp.so.8.18.6|*/license-host/node_modules/@napi-rs/canvas-linux-x64-gnu/skia.linux-x64-gnu.node)
      exit 0
      ;;
  esac
fi
exec /usr/bin/patchelf "$@"
