# Pocket Mockster — Scenario Bible

Source of truth for story, region layout, and content pacing. Content data (`src/content/**`) must match
this document; the validator and act e2e specs enforce the mechanical parts.

## Premise

The **Mocca region** runs on the **Ledger**, a stone archive in which every Mockemon ever recorded is
written down. Prof. Maple's MockDex is a portable page of it. **Team Rollback** believes the region was
released unfinished and wants to revert it to its first draft using **Originon**, the first Mockemon,
sealed at Null Peak. Their crimes are ordinary (theft, extortion, hoarding); their vocabulary is not
(they speak in patch notes). Tone: classic homage first, meta jokes as seasoning, never as plot.

## Cast

| Character | Role | Notes |
|---|---|---|
| Prof. Maple | mentor | gives MockDex, dex-milestone rewards, act hints |
| Juno | Maple's assistant | field guide, kidnapped in Act 7 |
| Kai | rival | 6 scripted encounters, becomes Champion |
| Director Nil | villain boss | Null Peak, Normal/Psychic team, uses Originon |
| Admin Patch | villain admin | Power Plant (Act 4) |
| Admin Merge | villain admin | Lava Tube (Act 6) |
| Grunts | villain mooks | 14 total across acts |
| Gym leaders | 8, see ladder | each has a gym puzzle + 1-3 gym trainers |

## Gym ladder

| # | Town | Leader | Type | Badge | Cap | Gym gimmick |
|---|---|---|---|---|---|---|
| 1 | Verdant City | Terra | Rock | Boulder | 14 | boulder maze (exists) |
| 2 | Thornbury | Weave | Bug | Silk | 18 | silk-thread one-way tiles |
| 3 | Tidewell Town | Nerin | Water | Tide | 24 | rising/falling water rows |
| 4 | Voltmere City | Dyna | Electric | Surge | 30 | switch-driven gates |
| 5 | Bloomrest | Fern | Grass | Bloom | 35 | hedge maze, hidden trainers |
| 6 | Cinderwake | Pyra | Fire | Ember | 40 | timed lava tiles |
| 7 | Zephyr Heights | Aeris | Flying | Gale | 45 | wind push tiles |
| 8 | Somnium Town | Mira | Psychic | Dream | 50 | teleport pads |
| — | Summit Null | 4 Elites + Champion Kai | mixed | — | 56 | no heal between Elites |

Badges also unlock field progress (no HM moves): Boulder → push `o` boulders, Tide → cross shallow
water `~`, Surge → power dead lifts/doors, Gale → use the Wing Whistle to fast-travel to visited towns.

## Act structure

Each act = one route + one settlement + one gym + one villain beat + 1-2 side quests. Acts are the unit
of work, the unit of testing (`tests/acts/actN.spec.ts`), and the unit of save-compat.

| Act | Region beat | Gym | Villain beat | Side content |
|---|---|---|---|---|
| 0 | Maple Town, Lab | — | — | starter, Kai battle, Maple's Parcel |
| 1 | Route 1 → Verdant City | Terra | grunts extort the Mock Center | Lost Nibbit, hiker trade |
| 2 | Verdant Woods → Thornbury | Weave | grunt steals the keeper's egg | Bug Catching Contest, daycare egg |
| 3 | Route 3, Seaside Cave → Tidewell | Nerin | dredging the cave for the Fossil | Fossil revival, Lighthouse Lamp |
| 4 | Route 4 → Voltmere City | Dyna | **Power Plant B1/B2**, Admin Patch | Voltmere Gauntlet |
| 5 | Route 5 → Bloomrest | Fern | Rollback buys the Ledger index | Berry farmer, Kai rematch |
| 6 | Route 6 → Cinderwake | Pyra | **Lava Tube**, Admin Merge | Cinder forge (held items) |
| 7 | Route 7 (pass) → Zephyr Heights | Aeris | Juno kidnapped, sky bridge chase | Sky Feather delivery |
| 8 | Route 8 → Somnium Town | Mira | Observatory: Null Peak coordinates | Observatory "ghost" |
| 9 | **Null Peak 1F/summit** | — | Director Nil, Originon (catchable) | — |
| 10 | Victory Trail → Summit Null | Elites + Kai | — | ending, credits, post-game |

Goal statement shown to the player: *"Earn eight badges, stop Team Rollback, and stand at Summit Null."*

## Region graph (map ids)

```
mapletown ─ lab, house_player, house_neighbor
   │ route1 ─ verdantcity ─ center, mart, gym1
   │             │ verdantwoods ─ thornbury ─ center, mart, gym2, contest_hall
   │                                  │ route3 ─ seasidecave ─ tidewell ─ center, mart, gym3, museum, lighthouse
   │                                                              │ route4 ─ voltmere ─ center, mart, gym4, powerplant_b1, powerplant_b2
   │                                                                            │ route5 ─ bloomrest ─ center, mart, gym5, greenhouse
   │                                                                                        │ route6 ─ cinderwake ─ center, mart, gym6, lavatube
   │                                                                                                    │ route7 ─ zephyrheights ─ center, mart, gym7, skybridge
   │                                                                                                              │ route8 ─ somnium ─ center, mart, gym8, observatory
   │                                                                                                                       │ nullpeak_1f ─ nullpeak_summit
   │                                                                                                                       │ victorytrail ─ summitnull
```

Target: 42 maps (7 today). Every map must be reachable from `mapletown` (validator enforces it).

## Roster plan: 26 → 40 species

Additions by gym need, each with stats, learnset, evolution, sprite, dex entry:

| Type | New species |
|---|---|
| Bug | Silkette → Lumoth |
| Water | Coralily, Krabbet |
| Electric | Ampule → Dynabolt |
| Grass | Bloomule, Cactoss |
| Fire | Pyrelisk, Cindrake |
| Flying | Skywyrm |
| Psychic | Enigmew, Oraculum |
| Fossil | Fossilisk |
| Legendary | Originon |

## Quests

Data-driven (`content/quests.ts`), each with stages, journal lines, and rewards; the pause menu shows
**NEXT OBJECTIVE** from the active main quest, and the QUEST LOG screen lists all.

Main: `main_journey` (stages: starter → parcel → badge1 … badge8 → nullpeak → league → champion).
Side: parcel, lost_nibbit, hiker_trade, contest, daycare_egg, fossil, lighthouse, gauntlet, berries,
sky_feather, observatory_ghost, dex_milestones (10/20/30/40 rewards).

## Progression pacing

- Money: 3000 by Act 3, 12000 by Act 6; mart stock unlocks per badge count.
- Wild levels track the cap minus 4-8; trainer aces sit 1-2 under the leader's ace.
- One Mock Center per settlement; heal point auto-set on entry (autosave fires here and on badge gain).
- Day/night: every route gets 2-3 night-weighted species; two quests are night-only.

## Front-end flow (items 4-5)

1. **Boot** → intro movie (`Sequence` timeline: region pan, Ledger glyphs, Rollback shadow, Originon
   silhouette, logo smash; ~25s, B skips, replayable from OPTIONS).
2. **Title** → NEW GAME / CONTINUE / OPTIONS, three save slots showing badges, playtime, party lead.
3. **In game** → autosave on badge + heal point, manual save from the pause menu, save version + migration.
4. **Ending** → champion defeat cutscene → credits scroll (starfield + sprite parade) → stats card
   (badges, dex seen/caught, playtime, party) → THE END → back to title with `postGame` set.
5. **Post-game** → free roam, Originon rematch if uncaught, dex completion reward from Maple.
