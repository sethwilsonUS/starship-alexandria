# Game Assets

Phase 1.3 uses **procedural placeholder assets** generated at runtime. No files are required to run the game.

## Adding a Real Tileset (Optional)

To use a custom 32×32 tileset from itch.io or Kenney:

1. Download a post-apocalyptic/ruins tileset (e.g. [Pixkari](https://pixkari.itch.io/post-apocalyptic-tileset), [Kenney Roguelike](https://kenney.nl/assets/roguelike-rpg-pack)).
2. Export a spritesheet (multiple tiles in one image, 32×32 each).
3. Place it as `tileset.png` in this folder.
4. Update `BootScene.ts` to load it:  
   `this.load.spritesheet('tileset', 'assets/tileset.png', { frameWidth: 32, frameHeight: 32 })`  
   and remove the procedural generation block.

## Suggested Free Assets (itch.io)

- **Post-Apocalyptic 32×32** – Pixkari (free demo pack)
- **Roguelike Indoor/RPG packs** – Kenney (CC0)
- Search: "post apocalyptic tileset 32x32"
