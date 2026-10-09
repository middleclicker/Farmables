# Farmables

Farmables is a third person browser farming game set on John's starter farm in an English countryside landscape. The first playable season follows winter wheat from an overgrown field through harvest.

## Play

1. Clear access at the field gate and test the soil.
2. At the equipment shed, rent or buy a tractor, then rent a mower, lime spreader, cultivator, and seed drill as each stage requires. Lime and winter wheat seed are available at the shed or village shop.
3. Drive over the field to mow, lime, cultivate, and sow. Use the farmhouse calendar to move through quiet periods. Spring fertilizer is an optional investment.
4. Rent a combine and harvest the crop. The sale earns coins for the next season. Village cottage jobs can also earn a little money.

Progress and positions save in the browser. The controls are in the game's **?** menu. Move with **WASD** or the arrow keys, hold **Shift** to run, drag to look around, and press **E** to interact or leave a vehicle. Touch devices have a movement joystick and on screen interaction button.

## Run locally

```bash
npm install
npm run dev
```

Use `npm run check`, `npm test`, and `npm run build` for source validation, crop cycle tests, and a production build.

## GitHub Pages

The game is static and bundles all runtime assets. Vite uses `/Farmables/` as the base path. Pushes to `main` trigger `.github/workflows/pages.yml`, which builds `dist/` and deploys it to GitHub Pages. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

## Assets

Ground, field, and road surface maps are from [Poly Haven](https://polyhaven.com/) under CC0. John's rigged farmer model and the oak and birch trees are from [Grab3D](https://grab3d.com/) under CC0. The farmer asset includes AI assisted content; its original license and disclosure are preserved in `assets/john-license.txt`. Fonts are bundled locally.
