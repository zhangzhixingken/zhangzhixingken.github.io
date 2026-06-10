#!/usr/bin/env bash
set -euo pipefail

SOURCE_ROOT="${1:-/Users/ken/Desktop/webpage picture}"
SITE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

command -v cwebp >/dev/null 2>&1 || { echo "cwebp is required"; exit 1; }
command -v ffmpeg >/dev/null 2>&1 || { echo "ffmpeg is required"; exit 1; }

convert_image() {
  local source="$1"
  local output="$2"
  local width="${3:-2800}"
  local quality="${4:-84}"
  mkdir -p "$(dirname "$output")"
  cwebp -quiet -q "$quality" -resize "$width" 0 "$source" -o "$output"
}

update_numbered_project() {
  local source_dir="$1"
  local output_dir="$2"
  local prefix="$3"

  mkdir -p "$output_dir"
  find "$output_dir" -maxdepth 1 -type f \( -name "$prefix-*.webp" -o -name 'cover.webp' -o -name 'thumb.webp' \) -delete
  convert_image "$source_dir/main.jpg" "$output_dir/cover.webp" 2800 84
  convert_image "$source_dir/main.jpg" "$output_dir/thumb.webp" 900 80

  local list_file
  list_file="$(mktemp)"
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
    printf -v output_name '%s-%02d.webp' "$prefix" "$count"
    convert_image "$source_file" "$output_dir/$output_name" 2800 84
  done < "$list_file"
  rm -f "$list_file"
  echo "$count"
}

echo "Updating art projects..."
update_numbered_project "$SOURCE_ROOT/arts/babel" "$SITE_ROOT/assets/images/babel" "gallery"
update_numbered_project "$SOURCE_ROOT/arts/ephemeral" "$SITE_ROOT/assets/images/ephemeral" "gallery"
update_numbered_project "$SOURCE_ROOT/arts/tsang chieh" "$SITE_ROOT/assets/images/cangjie" "gallery"

echo "Updating portrait..."
convert_image "$SOURCE_ROOT/about/IMG_4740.jpg" "$SITE_ROOT/assets/images/about/portrait.webp" 1800 84

DESIGN_SOURCE="$SOURCE_ROOT/careers/Design/上海建筑文创茶包设计——联合国《上海礼物》纽约联合国总部展览"
DESIGN_OUTPUT="$SITE_ROOT/assets/images/careers/shanghai-gift"
mkdir -p "$DESIGN_OUTPUT"
find "$DESIGN_OUTPUT" -maxdepth 1 -type f -delete
convert_image "$DESIGN_SOURCE/茶葉包裝.png" "$DESIGN_OUTPUT/cover.webp" 2800 84
convert_image "$DESIGN_SOURCE/茶葉包裝.png" "$DESIGN_OUTPUT/thumb.webp" 900 80

design_count=0
while IFS= read -r file; do
  design_count=$((design_count + 1))
  printf -v output_name 'gallery-%02d.webp' "$design_count"
  convert_image "$file" "$DESIGN_OUTPUT/$output_name" 2600 82
done < <(find "$DESIGN_SOURCE" -maxdepth 1 -type f -name '*.jpg' | sort)

ffmpeg -y -loglevel error -i "$DESIGN_SOURCE/一品上海.mp4" \
  -vf "scale='min(1920,iw)':-2" -c:v libx264 -crf 25 -preset medium -movflags +faststart -an \
  "$DESIGN_OUTPUT/shanghai-gift.mp4"

PHOTO_SOURCE="$SOURCE_ROOT/careers/Photography"
for project in event stillness; do
  output_dir="$SITE_ROOT/assets/images/careers/$project"
  mkdir -p "$output_dir"
  find "$output_dir" -maxdepth 1 -type f -delete
  count=0
  pattern="Event*.jpg"
  [[ "$project" == "stillness" ]] && pattern="Stillness*.jpg"
  while IFS= read -r file; do
    count=$((count + 1))
    printf -v output_name 'gallery-%02d.webp' "$count"
    convert_image "$file" "$output_dir/$output_name" 2600 84
    if [[ "$count" -eq 1 ]]; then
      convert_image "$file" "$output_dir/cover.webp" 2800 84
      convert_image "$file" "$output_dir/thumb.webp" 900 80
    fi
  done < <(find "$PHOTO_SOURCE" -maxdepth 1 -type f -name "$pattern" | sort -V)
done

AIGC_SOURCE="$SOURCE_ROOT/careers/Vibe Coding + AIGC/宣传片栏目片头动画-2025-AIGC-Recraft, Adobe After Effects/FINAL.mp4"
AIGC_OUTPUT="$SITE_ROOT/assets/images/careers/aigc-title"
mkdir -p "$AIGC_OUTPUT"
ffmpeg -y -loglevel error -i "$AIGC_SOURCE" \
  -vf "scale=-2:'min(1920,ih)'" -c:v libx264 -crf 25 -preset medium -movflags +faststart -an \
  "$AIGC_OUTPUT/final.mp4"
ffmpeg -y -loglevel error -ss 00:00:03 -i "$AIGC_SOURCE" -frames:v 1 \
  "$AIGC_OUTPUT/poster.png"
convert_image "$AIGC_OUTPUT/poster.png" "$AIGC_OUTPUT/cover.webp" 1800 82
convert_image "$AIGC_OUTPUT/poster.png" "$AIGC_OUTPUT/thumb.webp" 900 80
rm -f "$AIGC_OUTPUT/poster.png"

echo "All site assets updated."
"$SITE_ROOT/tools/update-photography.sh" "$SOURCE_ROOT/arts"
