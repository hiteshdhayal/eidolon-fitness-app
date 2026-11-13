Hero slides folder.

Put your photos here as `01-name.png`, `02-name.jpg`, `03-name.webp`, ... (up to 8).
Order is by filename. Each slide is processed at build time into a 4:5 AVIF/WebP set.

`src/data/hero-slides.json` controls alt text, focal point (focalX/focalY), scale and
whether a slide is skipped. The processing script creates entries for new files and
preserves your edits. Restart `pnpm dev` after adding or removing files.

If this folder is empty, `hero.png` or `hero.jpg` in this parent folder is used as a
single static slide. With no image at all, the outlined EIDOLON wordmark carries the hero.
