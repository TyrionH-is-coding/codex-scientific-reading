#!/bin/sh
set -eu
unset NODE_OPTIONS NODE_PATH PYTHONPATH PYTHONHOME
reading_root=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd -P)
IFS= read -r reading_node < "$reading_root/.workbench-node"
[ -x "$reading_node" ] || { printf '%s\n' 'Pinned Node runtime missing; run the installer again.' >&2; exit 1; }
if [ "$#" -eq 0 ]; then set -- status; fi
exec "$reading_node" "$reading_root/launcher.mjs" "$@"
