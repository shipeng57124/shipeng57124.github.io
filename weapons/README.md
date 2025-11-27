# weapons assets

1. Copy `manifest.sample.json` to `manifest.json` and adjust the entries.
2. Place transparent PNG/WebP art inside matching subfolders (e.g. `weapons/tomato/weapon.png`).
3. Assign audio per stage: hitscan weapons should provide `firingSound` (if omitted the game falls back to `sfx/hit.mp3` when you click) and may optionally include an `impactSound` for bullet hits—leaving it out keeps the impact silent. Lob weapons stay quiet at launch and rely on `impactSound` when the projectile lands. If you omit explicit paths the loader will look for files named `<weapon>_firing.mp3` and `<weapon>_splat.mp3` inside the weapon folder.
4. Set the `power` field to control how many hit points a shot removes (use positive integers). The default is 1 (one character per hit); bump it to 3 or more for heavy weapons that should wipe several characters at once.
5. Hitscan weapons can add a `recoil` value to control how much the crosshair kicks and expands after each shot (try 0.2–0.4 for rifles and dial up or down as needed).
6. Adjust `previewImageScale`, `projectileImageScale`, and `splatImageScale` to fine-tune the rendered sizes of `weapon.png`, `projectile.png`, and the impact art. Aim for splat artwork that is at least 1.2× the launcher preview width (roughly 220px or larger) so that hits feel impactful; you can fine-tune the final size with the scale fields in the manifest if needed. Hitscan weapons may omit `projectile.png` entirely if you don’t need a bullet trail.
7. Refresh the game to load the new weapons listed in `manifest.json`.
