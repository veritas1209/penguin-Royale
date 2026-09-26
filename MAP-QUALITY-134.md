# Whole-map quality pass (134)

The map is evaluated as a connected extraction space, not as isolated decorative districts.

## Criteria and decisions

- **Continuous terrain:** retain the coast taper and extended terrain from 133. Replace straight-edged random ground polygons with overlapping, feathered patches; preserve the readable north/south climate gradient.
- **District identity and cohesion:** use a muted shared palette with distinct roof/wall combinations for the base, armory, support centre, barracks, market, logistics area, villages and observatory. Preserve authored red farm buildings and the coastal/nuclear architecture.
- **Wayfinding:** add short worn access spurs from usable building entrances and extraction sites to roads. Do not render a spur through a building, water, fence or solid structure.
- **Traversal:** check every entrance and all six extraction sites against a one-metre navigation grid connected to the spawn. Keep the existing bridge crossings and road network.
- **Door usability:** relocate the nuclear building's blocked doorway to a clear side and regenerate its physical walls. The reactor had obstructed its previous landing.
- **Combat pacing and sightlines:** add staggered rock cover on road shoulders, with three metres of separation from roads and four metres from buildings. Keep crossroads and road travel open.
- **Spawn, loot and extraction fairness:** preserve existing population, loot and extraction rules. Reject new cover near spawn, enemy anchors, caches and extraction circles.
- **Collision truth:** use the same deterministic authoring function in the server world and shipped client bundle. Ground markings are cosmetic; rocks retain actual collision.
- **Occlusion/readability:** retain building roof fading and the existing district roof meshes. No new opaque overhead structures.
- **Performance:** 56 additional cover objects; 58 access spurs share one mesh and material. The terrain texture is generated once, with no per-frame ground work.
- **Regression scope:** retain squad visibility, lobby spacing, coastal continuity and Arbiter fixes from the base revision.
- **Release safety:** this branch does not deploy. Check active expedition state again immediately before release, as required by the user.

## Validation

`node --test server/tests/world-quality.test.js server/tests/coastal-nuclear-world.test.js server/tests/river-barrier.test.js server/tests/spatialObstacles.test.js server/tests/access.test.js`

25 tests passed. New checks cover every generated path at 0.35 m samples, road/building/loot/extraction clearance, all 66 entrances and six extractions reachable from spawn, and exact shared/bundle authoring parity.

`node tools/verify-coastal-visual.mjs` validates finite geometry, animated water/steam, roof fading metadata and the batched access-path mesh. `node --check dist/assets/index-terrain-squad-133.js` passes.

The pre-existing boss equipment grade-policy test still fails in the broader loot suite; this pass does not alter equipment generation. Final in-game browser inspection belongs to the integrated release check.

The repository contains an incomplete source snapshot, so do not rebuild the entire client from it. `python tools/sync-world-quality-bundle.py` re-syncs these additions into the preserved shipped bundle without replacing prior runtime patches.
