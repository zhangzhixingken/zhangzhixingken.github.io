#!/usr/bin/env bash
set -euo pipefail

SOURCE_ROOT="${1:-/Users/ken/Desktop/webpage picture/arts}"
SITE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v cwebp >/dev/null 2>&1; then
  echo "cwebp is required. Install it with: brew install webp"
  exit 1
fi

update_project() {
  local slug="$1"
  local source_name="$2"
  local title="$3"
  local source_dir="$SOURCE_ROOT/$source_name"
  local output_dir="$SITE_ROOT/assets/images/$slug"
  local data_file="$SITE_ROOT/assets/js/$slug-data.js"
  local list_file

  if [[ ! -d "$source_dir" ]]; then
    echo "Missing source folder: $source_dir"
    exit 1
  fi

  mkdir -p "$output_dir"
  list_file="$(mktemp)"
  trap 'rm -f "$list_file"' RETURN

  find "$output_dir" -maxdepth 1 -type f -name 'photo-*.webp' -delete

  local cover_source=""
  for extension in jpg JPG jpeg JPEG png PNG; do
    if [[ -f "$source_dir/main.$extension" ]]; then
      cover_source="$source_dir/main.$extension"
      break
    fi
  done

  if [[ -z "$cover_source" ]]; then
    echo "Missing main image in: $source_dir"
    exit 1
  fi

  cwebp -quiet -q 84 -resize 2800 0 "$cover_source" -o "$output_dir/cover.webp"
  cwebp -quiet -q 80 -resize 900 0 "$cover_source" -o "$output_dir/thumb.webp"

  find "$source_dir" -maxdepth 1 -type f | while IFS= read -r file; do
    local base
    base="$(basename "$file")"
    if [[ "$base" =~ ^([0-9]+)\.(jpg|JPG|jpeg|JPEG|png|PNG)$ ]]; then
      printf '%08d\t%s\n' "${BASH_REMATCH[1]}" "$file"
    fi
  done | sort -n > "$list_file"

  local count=0
  while IFS=$'\t' read -r order source_file; do
    [[ -n "$source_file" ]] || continue
    count=$((count + 1))
    printf -v output_name 'photo-%02d.webp' "$count"
    cwebp -quiet -q 84 -resize 2800 0 "$source_file" -o "$output_dir/$output_name"
  done < "$list_file"

  {
    echo "window.PHOTOGRAPHY_PROJECT = {"
    echo "  title: \"$title\","
    echo "  cover: \"../assets/images/$slug/cover.webp\","
    if [[ "$slug" == "undetected" ]]; then
      echo '  meta: ["2019-2022", "Documentary Photography", "Shenzhen, China"],'
      echo '  statement: "A three-year documentary project made inside Shenzhen subway construction sites, looking toward the workers and spaces hidden beneath the visible city.",'
    else
      echo '  meta: ["2022", "Staged Photography"],'
      echo '  statement: "A staged photographic series shaped by domestic interiors, cinematic light, estrangement, and the uneasy distance between familiar figures.",'
    fi
    echo "  images: ["
    local index
    for ((index = 1; index <= count; index++)); do
      printf -v output_name 'photo-%02d.webp' "$index"
      if [[ "$index" -lt "$count" ]]; then
        echo "    \"../assets/images/$slug/$output_name\","
      else
        echo "    \"../assets/images/$slug/$output_name\""
      fi
    done
    echo "  ]"
    echo "};"
  } > "$data_file"

  echo "Updated $title: $count photographs"
}

update_project "undetected" "undetected" "Undetected"
update_project "untitled" "untitled" "Untitled"

echo "Photography assets are ready."
