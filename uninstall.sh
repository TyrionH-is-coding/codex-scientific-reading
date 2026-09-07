#!/bin/sh
set -eu
reading_root=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd -P)
exec /bin/sh "$reading_root/workbench.sh" uninstall
