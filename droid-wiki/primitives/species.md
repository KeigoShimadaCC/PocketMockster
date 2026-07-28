# Species
Active contributors: Keigo

## Purpose
Describe the static species model that defines the roster, progression rules, and dex metadata used when creating and advancing Mockemon instances.

## Definition
Defined in `src/data/species.ts`:

- `SpeciesDef`: `id`, `key`, `name`, `types`, `base`, `catchRate`, `expYield`, `growth`, `genderRatio`, `eggGroups`, `eggMoves`, `abilities`, `evYield`, optional `baseFriendship`, `learnset`, optional `evolution`, `dex`
- `EvolutionDef`: `to`, `method` (`level` | `stone` | `trade` | `friendship`), plus method-specific fields (`level`, `stone`, `min`)
- `SPECIES`: `Record<string, SpeciesDef>`
- `DEX_ORDER`: ordered species keys for dex sequencing
- `DEX_COUNT`: total species count (`26`)

## Roster table (26 species)
| ID | Name | Types | Evolution |
| --- | --- | --- | --- |
| 1 | Sproutle | Grass | Level 15 -> Bramblore |
| 2 | Bramblore | Grass | None |
| 3 | Cindercub | Fire | Level 15 -> Emberuin |
| 4 | Emberuin | Fire | None |
| 5 | Puddlefin | Water | Level 15 -> Torrentle |
| 6 | Torrentle | Water | None |
| 7 | Nibbit | Normal | Friendship >= 160 -> Nibblex |
| 8 | Fluffowl | Normal/Flying | Friendship >= 160 -> Howlette |
| 9 | Buzzler | Bug | None |
| 10 | Cocoonet | Bug/Flying | None |
| 11 | Sparkit | Electric | Thunderstone -> Voltkat |
| 12 | Pebblit | Rock | Trade -> Bouldron |
| 13 | Bouldron | Rock/Ground | None |
| 14 | Mudlet | Ground | None |
| 15 | Floazy | Water/Flying | Waterstone -> Driftail |
| 16 | Psywisp | Psychic | Moonstone -> Somnara |
| 17 | Thistling | Grass/Bug | None |
| 18 | Gustling | Flying | None |
| 19 | Zapwing | Electric/Flying | None |
| 20 | Flarat | Fire | None |
| 21 | Nibblex | Normal | None |
| 22 | Howlette | Normal/Flying | None |
| 23 | Voltkat | Electric | None |
| 24 | Driftail | Water/Flying | None |
| 25 | Somnara | Psychic | None |
| 26 | Mimew | Normal | None |

## Structure highlights
### Starter lines
- Grass line: Sproutle -> Bramblore
- Fire line: Cindercub -> Emberuin
- Water line: Puddlefin -> Torrentle

### Single-stage species
Species with no `evolution` field and no evolution target role in the roster: Buzzler, Cocoonet, Mudlet, Gustling, Zapwing, Flarat, Mimew.

### Genderless special cases
- Gustling uses `genderRatio: null` (genderless).
- Mimew uses `genderRatio: null` and its egg group is `Mimic`.

## Notes
Detailed per-species stat and learnset reference tables are documented in [Data models reference](../reference/data-models.md).

## Related pages
- [Primitives index](./index.md)
- [Mockemon](./mockemon.md)
- [Move](./move.md)
- [Evolution feature](../features/evolution.md)
- [MockDex feature](../features/mockdex.md)
- [Data models reference](../reference/data-models.md)
