#!/bin/sh
set -eu
unset NODE_OPTIONS NODE_PATH PYTHONPATH PYTHONHOME
if [ "${1:-}" = '--help' ]; then
  printf '%s\n' 'Usage: sh install.sh --plugin-archive ./inputs/scientific-reading.tgz [--root DIR] [--install-skill] [--skills-directory DIR] [--library-backup ZIP]'
  exit 0
fi
source_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd -P)
case "$(uname -s)" in Darwin) platform=darwin;; Linux) platform=linux;; *) printf '%s\n' 'Use install.ps1 on Windows; unsupported Unix platform.' >&2; exit 1;; esac
case "$(uname -m)" in arm64|aarch64) arch=arm64;; x86_64|amd64) arch=x64;; *) printf '%s\n' 'Only x64 and arm64 are supported.' >&2; exit 1;; esac
runtime_key=$platform-$arch
node_url=$(awk -F '\t' -v key="$runtime_key" '$1 == key {print $2}' "$source_dir/runtime/posix-node.tsv")
node_sha=$(awk -F '\t' -v key="$runtime_key" '$1 == key {print $3}' "$source_dir/runtime/posix-node.tsv")
[ -n "$node_url" ] && [ "${#node_sha}" -eq 64 ] || { printf '%s\n' 'Runtime pins missing.' >&2; exit 1; }
for tool in curl tar awk; do command -v "$tool" >/dev/null || { printf 'Required tool missing: %s\n' "$tool" >&2; exit 1; }; done
bootstrap_dir=$(mktemp -d "${TMPDIR:-/tmp}/deep-literature-install.XXXXXXXX")
cleanup() { case "$bootstrap_dir" in "${TMPDIR:-/tmp}"/deep-literature-install.*) rm -rf -- "$bootstrap_dir";; esac; }
trap cleanup EXIT HUP INT TERM
printf '%s\n' "Preparing pinned Node.js for $runtime_key …" >&2
curl --fail --location --retry 3 --proto '=https' --proto-redir '=https' --tlsv1.2 --connect-timeout 30 --max-time 600 --output "$bootstrap_dir/node.tar.gz" "$node_url"
if command -v sha256sum >/dev/null; then
  actual_sha=$(sha256sum "$bootstrap_dir/node.tar.gz" | awk '{print $1}')
else
  actual_sha=$(shasum -a 256 "$bootstrap_dir/node.tar.gz" | awk '{print $1}')
fi
[ "$actual_sha" = "$node_sha" ] || { printf '%s\n' 'Node download checksum mismatch.' >&2; exit 1; }
mkdir "$bootstrap_dir/node"
tar -xzf "$bootstrap_dir/node.tar.gz" --strip-components=1 -C "$bootstrap_dir/node"
"$bootstrap_dir/node/bin/node" "$source_dir/src/bootstrap-posix.mjs" --bootstrap-node "$bootstrap_dir/node" "$@"
