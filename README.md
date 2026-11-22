[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/nowithyouu-pixel/neon-bay/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/nowithyouu-pixel/neon-bay/reward.svg)](https://make.fun/c/gta6-01)

# Neon Bay — an open-world crime game

Rex Marlowe is back in **Neon Bay** with nothing but a grudge and a fast pair of legs. Steal cars, lose the cops, run five jobs — and take the Marina Heights Bank.

An original 2D top-down open-world crime game, built for the [make.fun GTA 6 bounty](https://make.fun/c/gta6-01). Every name, character, district, vehicle and line of story is invented for this game: no Rockstar names, art, music or maps.

## The city

A seeded grid city with four districts — **Old Mill**, **Marina Heights**, **Coral Row** and **Dockside** — plus a beach and a marina on the bay. Roads, blocks, buildings, parks and piers are generated from a seed, so `?seed=1` always builds the same streets. The clock runs from morning to night, and the light follows it: clear noon, amber sunset, deep-blue night.

## What is in it

- **On foot and by car** — WASD/arrows to walk and run, `E` to steal any traffic or parked car, `W/S` to drive with steering, reverse and a `SPACE` handbrake. Cars have speed, grip, damage and smoke when wrecked.
- **Traffic and pedestrians** — cars follow lanes, yield to the car ahead and turn at intersections; pedestrians stroll the sidewalks and run from gunfire and crashes.
- **Wanted, 1–5 stars** — stealing, hitting pedestrians or cars, shooting and dropping officers all raise the heat. Foot cops chase and arrest, police cars hunt and ram, roadblocks appear at 3 stars, and a helicopter spotlight tracks you at 4. Lose the cops and the heat cools off.
- **Five chained missions** — First Wheels, Courier Run, Getaway, Dockside Deal and The Big Score, each with an objective banner, a waypoint marker and arrow, a timer where the job has one, and a cash payout. Progress saves automatically.
- **Combat** — `F` to punch, a pistol with ammo pickups (mouse aim, click to fire, auto-aim when the mouse is still), muzzle flashes, armed crews in the later jobs.
- **HUD and menus** — health, cash, ammo, wanted stars, a live minimap (player, cars, cops, mission marker), mission objective, speed, clock and district. Title screen with story and controls, pause, busted and wasted screens, story-complete screen, and a "Saved" indicator. Sound is synthesized WebAudio — engine hum, sirens, shots, pickups and a chiptune loop — with `M` to mute. No audio files, no network requests, no libraries.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| E | Enter / exit a car |
| F | Punch |
| Mouse + click | Aim and shoot the pistol |
| Q | Fire at the nearest threat |
| Space | Handbrake |
| Shift | Run |
| Esc | Pause |
| M | Mute |
| Enter | Start / continue |

## Screenshots

The four screenshots in `screenshots/` are staged renders of the real game, taken in this repository's session:

1. `1-cover.jpg` — `?shot=chase&seed=1`: a four-star chase at sunset
2. `2-drive.jpg` — `?shot=play&seed=1`: driving through Coral Row
3. `3-mission.jpg` — `?shot=mission&seed=1`: cracking the vault in The Big Score
4. `4-start.jpg` — `?shot=start&seed=1`: the title screen

## Layout

```
game/
  index.html        loads src/main.js as an ES module
  src/
    config.js       all tuning in one place
    random.js       seeded RNG + angle helpers
    world.js        city generation, roads, collision
    input.js        keyboard + mouse
    player.js       Rex on foot, entering/leaving cars
    vehicles.js     traffic AI + player car physics
    pedestrians.js  sidewalk crowds that flee danger
    police.js       wanted system, cops, roadblocks, helicopter
    missions.js     the five-job story
    combat.js       fists, pistol, enemies, pickups
    render.js       canvas drawing, camera, lighting
    hud.js          HUD, minimap, menus
    audio.js        synthesized WebAudio SFX + chiptune
    save.js         localStorage saves
    shots.js        ?shot= staging for screenshots
    main.js         boot + game loop
main.ts             the entrypoint: copies game/ + screenshots/, writes dossier.json
serve.ts            tiny static server for local play
shots.json          the four screenshot scenes
```

## Entry

This repository is the entry for the make.fun `gta6-01` competition. It is MIT licensed; see `LICENSE`.

My referral link, if you want to enter with your own agent: https://make.fun/r/q488z2cf
