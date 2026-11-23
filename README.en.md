---
kind: effect
engine: three.js
---

# Patchwork quilt

Makes a three.js world out of cloth, as if it had been cut, stuffed and sewn by hand and photographed on the table it was made on: a quilt whose every patch is its own puffed pillow, with real seams and a thread for every stitch, felt with fibres standing off it, and a camera that sees it as a small thing. The demo is a small country sewn into one quilt, still being finished, with a rag doll to walk about in it.

![A rag doll in a straw hat on a patchwork quilt, looking up at a felt village, a windmill and a desk lamp for a sun](shots/readme.jpg)

**In the demo:** click to look with the mouse, WASD to move, Shift to sprint, Space to jump, the wheel to step the eye back or in, H hides the hint. A gamepad works too. P changes how often the doll is posed (15 times a second, 24, every frame, 12). There is no sound.

Follow the buttons up the hill to the village, cross the ribbon, go and look at the corner that isn't sewn yet.

![The corner of the quilt that hasn't been pieced: wadding ruled with chalk, patches pinned in place, the needle still threaded](shots/corner.jpg)

![The whole table: the quilt, three bobble hats for mountains, the lamp, the cutting mat](shots/table.jpg)

It is a starting point, not a filter. You can't lay it over a finished game: the things in your world are made of cloth here, one by one. Start from this scene, change it, replace it.

## The idea

Nothing is a picture of cloth. What you see is the cloth's own shape, lit like a photograph of something small.

- **A quilt is pieced.** `sewQuilt()` (`src/quilt.js`) cuts every patch as its own mesh on a grid whose corners are a little out of true, puffs it up between its seams (no two stuffed quite alike), pulls it down along the line its quilting runs, and lays a short piece of thread for each stitch. The land is the shape the quilt lies in: give it a function for the heaps under it.
- **Cloth is made in code.** `src/fabric.js` weaves normal maps thread by thread (plain, linen, twill, corduroy, knit, felt) and prints cotton on a canvas (gingham, stripes, ticking, dots, small flowers, plaid). One unit of a mesh's UV is one unit of the world, so a print is the same size on whatever it is sewn into.
- **Things lie on things.** `ribbon()` (`src/sew.js`) lays a ribbon or a tape over the real top of the patches, so it drapes over each one and bridges the seams, and rides over the binding at the quilt's edge.
- **Felt has fuzz.** `fuzz()` scatters fibres over any mesh, and they lie a little differently on every second frame of the film, as they do when a hand has touched the puppet between frames.
- **The creases are dark.** The camera (`src/post.js`) works out from depth alone where cloth meets cloth, and shades it; then it blurs what is far from the plane of focus, which is what says the world is small; then it develops the picture with a film curve and a little grain.
- **He is a puppet.** The doll is sewn parts hung on a skeleton. He goes where you send him at once, but his pose is taken only so many times a second and held between, like a stop-motion film. The smoke, the washing, the sails and the water's sequins move on a film of twelve frames a second.
- **It is on a table.** The lamp, the cutting mat, the shears, the tape measure and the spools are the size they really are. That, and the corner that isn't finished, is what makes it a thing somebody is making.

## Use it

```
npm install
npm run build        # dist/, the demo as it is published
npm run serve        # http://127.0.0.1:5412/
```

- `src/making/world.js` puts the demo together: what is built where, what grows, the light. Start there.
- `src/making/land.js` is the lie of the quilt: its hills, the river's line, the button path, the corner left unsewn.
- `src/country/buildings.js` and `src/country/nature.js` are the makers (cottage, church, windmill, washing line; pom-pom trees, felt firs, sheep, fringe grass, the river, clouds). Each takes a `kit` that says what land it stands on, so they work on any quilt.
- `src/making/room.js` and `src/making/work.js` are the table, the room and the work in progress.
- `src/doll.js` and `src/cape.js` are the rag doll and his felt cape.
- Two more scenes are in the code and open by address: `?scene=table` (a smaller quilt, the first one made) and `?scene=country` (a whole valley of fields under a dyed sky).
- `?lens=0` turns off the focus blur and `?ao=0` the shading of the creases, for looking at the making. `?fps=` sets how often the doll is posed.

The tools in `tools/` take stills and films of the built demo with a headless Chromium (`CHROME` names one of your own): `sh tools/go.sh --name still` builds and takes one.

## What it costs

About 7 ms a frame at 1080p on a fast desktop card, most of it the quilt's 1,270 patches and their 18,000 stitches drawn twice (once for the lamp's shadows). It has not been measured on a laptop. The demo is about 9 MB to download: the doll's skeleton and clips are 3.6 MB of it and the physics engine 2 MB.

## Licence

Code MIT, art CC0 1.0. Everything sewn is made in code. The doll moves on Patch's starter man's skeleton with clips from Quaternius' Universal Animation Library and Patch's own, all CC0. Physics is Rapier (Apache-2.0). `LICENCE-NOTES.md` has every part and where it came from.
