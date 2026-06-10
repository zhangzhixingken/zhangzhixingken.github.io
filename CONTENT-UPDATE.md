# Updating website images

The website now uses `/Users/ken/Desktop/webpage picture` as its source image folder.

## Art projects

For each folder inside `arts`:

- `main.jpg` is the cover and thumbnail.
- `1.jpg`, `2.jpg`, `3.jpg`, etc. are shown in numeric order.
- JPG, JPEG, and PNG gallery files are supported.

The supported folders are:

- `arts/babel`
- `arts/ephemeral`
- `arts/tsang chieh`
- `arts/undetected`
- `arts/untitled`

## Other pages

- `about/IMG_4740.jpg` is the About portrait.
- Career images remain in their current named folders.
- `contact` currently contains no source images, so the Contact page remains text-based.

## Update command

From the website folder:

```bash
./tools/update-all-assets.sh "/Users/ken/Desktop/webpage picture"
```

This command:

1. Sorts art images by their numeric filenames.
2. Converts large source files into web-friendly WebP assets.
3. Generates cover and thumbnail images.
4. Optimizes the two career videos for web playback.
5. Updates the Undetected and Untitled image data automatically.

When only Undetected or Untitled changes, this shorter command also works:

```bash
./tools/update-photography.sh "/Users/ken/Desktop/webpage picture/arts"
```
