# Day-night cycle
Active contributors: Keigo

## Purpose
Explain clock progression, phase logic, and encounter weighting from `src/daynight.ts` and `src/game.ts`.

## Clock and phase rules
From `src/daynight.ts`:
- `MINUTES_PER_DAY = 1440`
- `phaseFor(minute)`:
  - morning: `360 <= m < 600`
  - day: `600 <= m < 1020`
  - evening: `1020 <= m < 1200`
  - night: all remaining minutes
- `tintFor(phase)` provides overlay color and alpha
- `formatTime(minute)` returns `HH:MM`
- `isNight(phase)` checks whether phase is night

In `Game`:
- Clock starts at `minute = 600` (10:00).
- Time advances by 1 minute every 10 frames.
- At 60 FPS, a full in-game day is about 4 real minutes.

## Rendering effects
- `renderTint()` applies phase tint to outdoor maps.
- Indoor maps skip tint (`if (this.map.indoor) return`).
- `renderOverworld()` shows formatted clock text in the HUD panel.

## Night encounter weighting
In `startWildBattle()`:
- Encounter weight function is:
  - day or non-night: `weight`
  - night: `nightWeight ?? (weight * 0.25)`
- `EncounterEntry.nightWeight` can override default night scaling per species.

This allows explicit night species tuning while still reducing non-overridden entries at night.

## Related pages
- [Overworld system](../systems/overworld.md)
- [World map primitive](../primitives/world-map.md)
