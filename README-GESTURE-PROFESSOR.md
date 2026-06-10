# Mobile breakpoint update

The mobile / portrait adaptation now triggers when:

- screen width <= 840px
- and width < height (portrait)

This applies to:
1. Apple-style mobile dropdown navigation
2. BABEL title upward mobile position
3. Homepage portrait orbit restore
4. Gesture panel / scroll button mobile positioning
5. Mobile menu close condition

The thumb + index click restore and Vimeo embed are preserved.

- Added pinch-drag page scrolling: thumb+index pinch, move hand up to scroll down and hand down to scroll up.
