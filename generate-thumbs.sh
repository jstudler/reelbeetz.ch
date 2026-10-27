#!/usr/bin/env bash
# Generates the social-media thumbnails in static/thumbs/artwork from the
# originals in static/artwork.
#
# A thumbnail is only re-encoded when it is missing, when its pixel dimensions
# do not match "-resize $resize_width", or when it is above the size limit that
# WhatsApp and friends still render in link previews. Up-to-date thumbnails are
# left untouched, so they stay out of the git diff.
#
# add the git hook
# echo 'bash generate-thumbs.sh' > .git/hooks/pre-commit
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

src_dir=static/artwork
dst_dir=static/thumbs/artwork
resize_width=400
# Keep in sync with .github/scripts/check-thumb-sizes.sh.
max_bytes=$((300 * 1024))
# Fallback qualities, tried in order, for thumbnails that stay above max_bytes.
quality_steps=(85 75 65)

if command -v magick >/dev/null 2>&1; then
  im_identify=(magick identify)
  im_mogrify=(magick mogrify)
  im_convert=(magick)
else
  im_identify=(identify)
  im_mogrify=(mogrify)
  im_convert=(convert)
fi

[ -d "$src_dir" ] || { echo "No such directory: $src_dir" >&2; exit 1; }
mkdir -p "$dst_dir"

file_bytes() {
  # wc is more portable than the stat flags, and $(( )) drops its padding.
  echo "$(( $(wc -c <"$1") ))"
}

# The dimensions ImageMagick produces for "-resize $resize_width": the aspect
# ratio is kept and the height is rounded half up.
expected_size() {
  local width height
  read -r width height < <("${im_identify[@]}" -ping -format '%w %h' "${1}[0]")
  height=$(( (height * resize_width * 2 + width) / (width * 2) ))
  [ "$height" -ge 1 ] || height=1
  echo "${resize_width}x${height}"
}

needs_rebuild() {
  local src=$1 dst=$2
  [ -f "$dst" ] || return 0
  # An unreadable thumbnail reports no dimensions and is rebuilt as well.
  [ "$("${im_identify[@]}" -ping -format '%wx%h' "${dst}[0]" 2>/dev/null)" = "$(expected_size "$src")" ] || return 0
  [ "$(file_bytes "$dst")" -le "$max_bytes" ] || return 0
  return 1
}

generate_thumb() {
  local src=$1 dst=$2 quality
  "${im_mogrify[@]}" -path "$dst_dir" -resize "$resize_width" "$src"
  for quality in "${quality_steps[@]}"; do
    [ "$(file_bytes "$dst")" -gt "$max_bytes" ] || return 0
    # Too heavy for a link preview: re-encode from the original instead of
    # recompressing the thumbnail again.
    "${im_convert[@]}" "$src" -resize "$resize_width" -strip -quality "$quality" "$dst"
  done
  [ "$(file_bytes "$dst")" -le "$max_bytes" ]
}

changed=()
oversized=()
generated=0
removed=0

for src in "$src_dir"/*.jpg; do
  [ -f "$src" ] || continue
  dst="$dst_dir/$(basename "$src")"
  needs_rebuild "$src" "$dst" || continue
  echo "generating $dst"
  generate_thumb "$src" "$dst" || oversized+=("$dst")
  changed+=("$dst")
  generated=$((generated + 1))
done

for dst in "$dst_dir"/*.jpg; do
  [ -f "$dst" ] || continue
  [ -f "$src_dir/$(basename "$dst")" ] && continue
  echo "removing orphaned $dst"
  rm -f "$dst"
  changed+=("$dst")
  removed=$((removed + 1))
done

if [ ${#changed[@]} -gt 0 ]; then
  git add -- "${changed[@]}"
  echo "$generated thumbnail(s) generated, $removed removed."
else
  echo "All thumbnails are up to date."
fi

if [ ${#oversized[@]} -gt 0 ]; then
  last_quality=${quality_steps[$(( ${#quality_steps[@]} - 1 ))]}
  echo "Still above $((max_bytes / 1024)) KiB at quality $last_quality:" >&2
  printf '  %s\n' "${oversized[@]}" >&2
  exit 1
fi
