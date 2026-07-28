# Data models

This page is the canonical static data reference for `src/data/*`.

## Species (`src/data/species.ts`)

| id | name | types | hp | atk | def | spa | spd | spe | catchRate | growth | evolution |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Sproutle | Grass | 45 | 49 | 49 | 65 | 65 | 45 | 45 | mediumfast | Level 15 -> `bramblore` |
| 2 | Bramblore | Grass | 60 | 62 | 63 | 80 | 80 | 60 | 45 | mediumfast | - |
| 3 | Cindercub | Fire | 39 | 52 | 43 | 60 | 50 | 65 | 45 | mediumfast | Level 15 -> `emberuin` |
| 4 | Emberuin | Fire | 58 | 64 | 58 | 80 | 65 | 80 | 45 | mediumfast | - |
| 5 | Puddlefin | Water | 44 | 48 | 65 | 50 | 64 | 43 | 45 | mediumfast | Level 15 -> `torrentle` |
| 6 | Torrentle | Water | 59 | 63 | 80 | 65 | 80 | 58 | 45 | mediumfast | - |
| 7 | Nibbit | Normal | 30 | 56 | 35 | 25 | 35 | 72 | 255 | fast | Friendship 160 -> `nibblex` |
| 8 | Fluffowl | Normal/Flying | 40 | 45 | 40 | 35 | 35 | 56 | 255 | mediumslow | Friendship 160 -> `howlette` |
| 9 | Buzzler | Bug | 45 | 60 | 50 | 30 | 40 | 55 | 190 | fast | - |
| 10 | Cocoonet | Bug/Flying | 55 | 45 | 55 | 60 | 55 | 65 | 120 | erratic | - |
| 11 | Sparkit | Electric | 35 | 55 | 40 | 60 | 50 | 90 | 190 | mediumfast | Use `thunderstone` -> `voltkat` |
| 12 | Pebblit | Rock | 40 | 55 | 100 | 30 | 30 | 20 | 255 | mediumslow | Trade -> `bouldron` |
| 13 | Bouldron | Rock/Ground | 55 | 45 | 130 | 45 | 45 | 35 | 120 | mediumslow | - |
| 14 | Mudlet | Ground | 50 | 60 | 55 | 40 | 45 | 40 | 190 | mediumfast | - |
| 15 | Floazy | Water/Flying | 52 | 44 | 42 | 58 | 50 | 60 | 190 | mediumfast | Use `waterstone` -> `driftail` |
| 16 | Psywisp | Psychic | 40 | 30 | 35 | 75 | 60 | 70 | 100 | slow | Use `moonstone` -> `somnara` |
| 17 | Thistling | Grass/Bug | 42 | 55 | 48 | 45 | 48 | 50 | 190 | mediumfast | - |
| 18 | Gustling | Flying | 38 | 50 | 38 | 50 | 42 | 85 | 190 | erratic | - |
| 19 | Zapwing | Electric/Flying | 45 | 48 | 40 | 68 | 50 | 88 | 90 | slow | - |
| 20 | Flarat | Fire | 38 | 58 | 38 | 52 | 40 | 78 | 190 | fast | - |
| 21 | Nibblex | Normal | 55 | 81 | 60 | 50 | 60 | 97 | 127 | fast | - |
| 22 | Howlette | Normal/Flying | 70 | 60 | 55 | 76 | 66 | 90 | 90 | mediumslow | - |
| 23 | Voltkat | Electric | 60 | 75 | 55 | 90 | 70 | 115 | 75 | mediumfast | - |
| 24 | Driftail | Water/Flying | 75 | 62 | 60 | 85 | 72 | 82 | 75 | mediumfast | - |
| 25 | Somnara | Psychic | 65 | 45 | 55 | 110 | 90 | 85 | 60 | slow | - |
| 26 | Mimew | Normal | 70 | 60 | 60 | 60 | 60 | 60 | 45 | slow | - |

Egg groups referenced in species data:

`Grass`, `Monster`, `Field`, `Water1`, `Flying`, `Bug`, `Mineral`, `Amorphous`, `Mimic`.

## Moves (`src/data/moves.ts`)

| name | type | category | power | accuracy | pp | notable effect |
| --- | --- | --- | --- | --- | --- | --- |
| Tackle | Normal | physical | 40 | 100 | 35 | - |
| Scratch | Normal | physical | 40 | 100 | 35 | - |
| Quick Attack | Normal | physical | 40 | 100 | 30 | Priority +1 |
| Bite | Normal | physical | 60 | 100 | 25 | 30% flinch chance |
| Take Down | Normal | physical | 90 | 85 | 20 | 25% recoil (damage dealt basis) |
| Fury Swipes | Normal | physical | 18 | 80 | 15 | 2-5 hits |
| Fury Attack | Normal | physical | 15 | 85 | 20 | 2-5 hits |
| Growl | Normal | status | 0 | 100 | 40 | Lowers foe Attack by 1 stage |
| Tail Whip | Normal | status | 0 | 100 | 30 | Lowers foe Defense by 1 stage |
| Harden | Normal | status | 0 | 999 | 30 | Raises self Defense by 1 stage |
| Double Team | Normal | status | 0 | 999 | 15 | Raises self Evasion by 1 stage |
| Struggle | Normal | physical | 50 | 999 | 1 | Typeless; 25% max-HP recoil |
| Ember | Fire | special | 40 | 100 | 25 | 10% burn chance |
| Flame Burst | Fire | special | 70 | 100 | 15 | 10% burn chance |
| Fire Fang | Fire | physical | 65 | 95 | 15 | 10% burn, 10% flinch |
| Sunny Day | Fire | status | 0 | 999 | 5 | Sets sun weather |
| Water Gun | Water | special | 40 | 100 | 25 | - |
| Bubble Beam | Water | special | 65 | 100 | 20 | 10% chance to lower foe Speed |
| Aqua Jet | Water | physical | 40 | 100 | 20 | Priority +1 |
| Cold Snap | Water | special | 40 | 100 | 25 | 10% freeze chance |
| Rain Dance | Water | status | 0 | 999 | 5 | Sets rain weather |
| Vine Whip | Grass | physical | 45 | 100 | 25 | - |
| Razor Leaf | Grass | physical | 55 | 95 | 25 | - |
| Sleep Powder | Grass | status | 0 | 75 | 15 | Inflicts sleep |
| Absorb | Grass | special | 40 | 100 | 25 | Drains 50% of dealt damage |
| Mega Drain | Grass | special | 60 | 100 | 15 | Drains 50% of dealt damage |
| Leech Seed | Grass | status | 0 | 90 | 10 | Seeds target for end-turn drain |
| Grassy Terrain | Grass | status | 0 | 999 | 10 | Sets grassy terrain |
| Thunder Shock | Electric | special | 40 | 100 | 30 | 10% paralysis chance |
| Spark | Electric | physical | 65 | 100 | 20 | 30% paralysis chance |
| Thunder Wave | Electric | status | 0 | 90 | 20 | Inflicts paralysis |
| Electric Terrain | Electric | status | 0 | 999 | 10 | Sets electric terrain |
| Rock Throw | Rock | physical | 50 | 90 | 15 | - |
| Rock Tomb | Rock | physical | 60 | 95 | 15 | Lowers foe Speed by 1 stage |
| Sandstorm | Rock | status | 0 | 999 | 10 | Sets sand weather |
| Stealth Rock | Rock | status | 0 | 999 | 20 | Sets stealth rock hazard |
| Mud Slap | Ground | special | 30 | 100 | 10 | Lowers foe Accuracy by 1 stage |
| Sand Attack | Ground | status | 0 | 100 | 15 | Lowers foe Accuracy by 1 stage |
| Dig | Ground | physical | 80 | 100 | 10 | Two-turn move with invulnerable charge turn |
| Spikes | Ground | status | 0 | 999 | 20 | Sets spikes hazard |
| Bug Bite | Bug | physical | 60 | 100 | 20 | - |
| String Shot | Bug | status | 0 | 95 | 40 | Lowers foe Speed by 1 stage |
| Toxic | Bug | status | 0 | 90 | 10 | Inflicts toxic poison |
| Gust | Flying | special | 40 | 100 | 35 | - |
| Peck | Flying | physical | 35 | 100 | 35 | - |
| Wing Attack | Flying | physical | 60 | 100 | 35 | - |
| Fly | Flying | physical | 70 | 95 | 15 | Two-turn move with invulnerable charge turn |
| Confusion | Psychic | special | 50 | 100 | 25 | - |
| Confuse Ray | Psychic | status | 0 | 100 | 10 | Inflicts confusion |
| Reflect | Psychic | status | 0 | 999 | 20 | Sets Reflect screen |
| Light Screen | Psychic | status | 0 | 999 | 30 | Sets Light Screen |
| Mend | Psychic | status | 0 | 999 | 10 | Heals self for 50% max HP |

## Items (`src/data/items.ts`)

| name | kind | price | effect |
| --- | --- | --- | --- |
| Potion | medicine | 300 | Restores 20 HP |
| Super Potion | medicine | 700 | Restores 50 HP |
| MockBall | ball | 200 | Catches wild Mockemon |
| Thunder Stone | stone | 2100 | Evolves certain Electric Mockemon |
| Water Stone | stone | 2100 | Evolves certain Water Mockemon |
| Moon Stone | stone | 2100 | Evolves certain mysterious Mockemon |
| Oran Berry | held | 100 | Auto-restores 10 HP below half HP |
| Sitrus Berry | held | 200 | Auto-restores 25% HP below half HP |
| Leftovers | held | 1200 | Restores a little HP each turn |
| Power Band | held | 1500 | Attack x1.5; locks into one move |
| Safety Sash | held | 1500 | Survive one one-hit KO from full HP |
| Swift Feather | held | 1000 | 20% chance to move first |
| Lucky Charm | held | 1800 | 50% more EXP gain |
| Ember Charm | held | 900 | Fire move power +20% |
| Tide Charm | held | 900 | Water move power +20% |
| Leaf Charm | held | 900 | Grass move power +20% |

## Abilities (`src/data/abilities.ts`)

| name | effect |
| --- | --- |
| Verdant Force | Grass moves gain 50% power when HP is low |
| Cinder Heart | Fire moves gain 50% power when HP is low |
| Riptide | Water moves gain 50% power when HP is low |
| Static Fur | Contact may paralyze the attacker (30%) |
| Toxic Barb | Contact may poison the attacker (30%) |
| Menace | Lowers the foe's Attack when entering battle |
| Musclebound | Doubles Attack |
| Momentum | Speed rises at the end of every turn |
| Rock Solid | Survives a one-hit KO from full HP with 1 HP |
| Airborne | Immune to Ground moves and ground hazards |
| Sponge | Water moves heal 25% HP instead of damaging |
| Ember Gut | Fire moves are absorbed, boosting own Fire moves |
| Adaptive | Same-type attack bonus is doubled |

## Type effectiveness matrix (`src/data/types.ts`)

Attack type versus defender type multiplier.

| atk \ def | Normal | Fire | Water | Grass | Electric | Rock | Ground | Bug | Flying | Psychic |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Normal | 1 | 1 | 1 | 1 | 1 | 0.5 | 1 | 1 | 1 | 1 |
| Fire | 1 | 0.5 | 0.5 | 2 | 1 | 0.5 | 1 | 2 | 1 | 1 |
| Water | 1 | 2 | 0.5 | 0.5 | 1 | 2 | 2 | 1 | 1 | 1 |
| Grass | 1 | 0.5 | 2 | 0.5 | 1 | 2 | 2 | 0.5 | 0.5 | 1 |
| Electric | 1 | 1 | 2 | 0.5 | 0.5 | 1 | 0 | 1 | 2 | 1 |
| Rock | 1 | 2 | 1 | 1 | 1 | 1 | 0.5 | 2 | 2 | 1 |
| Ground | 1 | 2 | 1 | 0.5 | 2 | 2 | 1 | 0.5 | 0 | 1 |
| Bug | 1 | 0.5 | 1 | 2 | 1 | 0.5 | 1 | 1 | 0.5 | 2 |
| Flying | 1 | 1 | 1 | 2 | 0.5 | 0.5 | 1 | 2 | 1 | 1 |
| Psychic | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0.5 |

Related:

- [Species primitive](../primitives/species.md)
- [Move primitive](../primitives/move.md)
- [Mockemon primitive](../primitives/mockemon.md)
