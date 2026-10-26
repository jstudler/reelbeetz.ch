#!/usr/bin/env bash
# WhatsApp and friends only render link previews for small images, so the
# generated thumbnails must stay below 300 KiB.
# See https://stackoverflow.com/questions/19778620/provide-an-image-for-whatsapp-link-sharing
set -euo pipefail

max_kib=300
thumbs_dir=${1:-static/thumbs}

[ -d "$thumbs_dir" ] || { echo "No such directory: $thumbs_dir" >&2; exit 1; }

oversized=$(find "$thumbs_dir" -type f -size +"${max_kib}"k)

if [ -n "$oversized" ]; then
  echo "Thumbnails larger than ${max_kib} KiB:"
  while IFS= read -r file; do
    echo "  $(du -k "$file" | cut -f1) KiB  $file"
  done <<<"$oversized"
  echo
  echo "Re-generate them with ./generate-thumbs.sh or shrink them further."
  exit 1
fi

echo "All thumbnails in $thumbs_dir are below ${max_kib} KiB."
