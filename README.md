# Farmables

Farmables is a third person browser farming game set on John's starter farm in an English countryside landscape. The first playable season follows winter wheat from an overgrown field through harvest.

## Play

1. Clear access at the field gate, collect a soil sample, and hand it to village supplies. The laboratory report arrives at the farmhouse two days later.
2. At the equipment shed, rent or buy a tractor, then rent a mower, lime spreader, cultivator, and seed drill as each stage requires. Lime and winter wheat seed are available at the shed or village shop.
3. Drive each implement through the field to mow, lime, cultivate, and sow. The ground changes beneath the implement's moving width rather than whole map squares. Use the farmhouse calendar to move through quiet periods. Spring fertilizer is an optional investment.
4. Rent a combine and harvest the crop. The sale earns coins for the next season. Village cottage jobs can also earn a little money.

Progress and positions save in the browser. A full day/night cycle, changing daily weather, rain, mist, and indoor lighting affect the scene. The farmhouse offers sleep when it is dark. The controls are in the game's **?** menu. Move with **WASD** or the arrow keys, hold **Shift** to sprint or press **C** to toggle it, drag to look around, and press **E** to interact or leave a vehicle. Touch devices have a movement joystick, sprint button, and on screen interaction button. Click or focus and press Enter on the minimap to expand it; click again or press Escape to close it. The map shows the exact worked swaths as equipment passes over the field and its heading arrow matches world direction. Sheep graze in the west pasture and villagers walk along the paved paths.

## Run locally

```bash
npm install
npm run dev
```

Use `npm run check`, `npm test`, and `npm run build` for source validation, crop cycle tests, and a production build.

## GitHub Pages

The game is static and bundles all runtime assets. Vite uses `/Farmables/` as the base path. Pushes to `main` trigger `.github/workflows/pages.yml`, which builds `dist/` and deploys it to GitHub Pages. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

## Assets

Ground, field, and road surface maps are from [Poly Haven](https://polyhaven.com/) under CC0. The bundled building materials are Poly Haven's [weathered plank siding](https://polyhaven.com/a/weathered_plank_siding), [plaster stone wall](https://polyhaven.com/a/plaster_stone_wall_02), [rough plaster](https://polyhaven.com/a/rough_plaster_03), [roof slates](https://polyhaven.com/a/roof_slates_02), [roof tiles](https://polyhaven.com/a/roof_3), [hangar concrete floor](https://polyhaven.com/a/hangar_concrete_floor), [old wooden floor](https://polyhaven.com/a/old_wooden_floor_01), and [wood plank wall](https://polyhaven.com/a/wood_plank_wall), converted to smaller WebP images for the browser. The field hedgerow uses their [Shrub 03 model](https://polyhaven.com/a/shrub_03). John's rigged farmer model and the oak and birch trees are from [Grab3D](https://grab3d.com/) under CC0. The farmer asset includes AI assisted content; its original license and disclosure are preserved in `assets/john-license.txt`. Fonts are bundled locally.
