# Farmables

A third person farming game prototype set in a 3D English countryside. Play as John and explore the first field, the roadside, surrounding woods, and the village beyond.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Use **WASD** or the arrow keys to walk, **Shift** to run, drag to turn the camera, and scroll to zoom. Touch devices have a movement joystick and drag camera controls.

## GitHub Pages

The game is entirely static. `npm run build` creates `dist/`, and `.github/workflows/pages.yml` deploys it on pushes to `main`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. Vite uses `/Farmables/` as its base path for the repository Pages URL.

## Scope

This first slice focuses on landscape and exploration. The terrain, field, road, village, hedges, and barn are built in Three.js; John and selected roadside trees use bundled 3D models. Farming tools, crop growth, saves, and progression are future work.

## Assets

Ground, field, and road surface maps are from [Poly Haven](https://polyhaven.com/) under CC0. John's rigged farmer model and the oak and birch trees are from [Grab3D](https://grab3d.com/) under CC0. The farmer asset includes AI-assisted content; its original license and disclosure are preserved in `assets/john-license.txt`. Fonts are bundled locally, so the deployed game does not request Google Fonts or other runtime services.
