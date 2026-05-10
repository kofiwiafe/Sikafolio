# SikaFolio — Claude Preferences

## Logo
- The logo image is `src/assets/logo.jpg` (hand holding cash, black silhouette on white).
- It must appear on the yellow (`#C8A84B`) background box wherever a logo placeholder exists.
- Always use `mix-blend-mode: multiply` on the `<img>` so the white background becomes transparent, leaving a black hand on yellow.
- The image should be sized at `80%` width/height of its container with `objectFit: contain`.

## Brand colors
- Gold / yellow: `#C8A84B`
- Dark background: `#0d1117`
- Card background: `#131820`
- Border: `#1e2530`

## Logo component (`src/components/Logo.jsx`)
- `size="lg"` — 72 × 72 box, border-radius 22, used on the Splash screen.
- `size="md"` (default) — 30 × 30 box, border-radius 9, used in the nav bar.
- Layout: column (icon above text) for `lg`, row for `md`.
