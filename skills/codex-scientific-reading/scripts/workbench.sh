#!/bin/sh
set -eu
skill_dir=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd -P)
IFS= read -r reading_root < "$skill_dir/location.txt"
exec /bin/sh "$reading_root/workbench.sh" "$@"
