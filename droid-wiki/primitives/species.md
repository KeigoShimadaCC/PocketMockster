# Species
Active contributors: KeigoShimadaCC

## Purpose
Describe the static species model used to build roster data, learnsets, evolution rules, and dex text.

## Definition
Defined in `src/data/species.ts`:

- `SpeciesDef`: `id`, `key`, `name`, `types`, `base`, `catchRate`, `expYield`, `growth`, `genderRatio`, `eggGroups`, `eggMoves`, `abilities`, `evYield`, optional `baseFriendship`, `learnset`, optional `evolution`, `dex`
- `EvolutionDef`: `to`, `method` (`level` | `stone` | `trade` | `friendship`) plus method-specific fields (`level`, `stone`, `min`)
- `SPECIES`: keyed registry used across battle/capture/content systems
- `DEX_ORDER`: ordered key list for dex sequencing
- `DEX_COUNT`: `list.length` (currently 41 entries in this file)

## Roster snapshot
Current `DEX_ORDER` keys in `src/data/species.ts`:

`sproutle`, `bramblore`, `cindercub`, `emberuin`, `puddlefin`, `torrentle`, `nibbit`, `fluffowl`, `buzzler`, `cocoonet`, `sparkit`, `pebblit`, `bouldron`, `mudlet`, `floazy`, `psywisp`, `thistling`, `gustling`, `zapwing`, `flarat`, `nibblex`, `howlette`, `voltkat`, `driftail`, `somnara`, `mimew`, `silkette`, `lumoth`, `coralily`, `krabbet`, `ampule`, `dynabolt`, `bloomule`, `cactoss`, `pyrelisk`, `cindrake`, `skywyrm`, `enigmew`, `oraculum`, `fossilisk`, `originon`.

## Notable newer species and lines
- `fossilisk` is wired to the fossil revival quest script (`fossil_revive` gives `fossilisk`) in `src/content/scripts/index.ts`.
- `originon` is tied to the summit script flow (`originon_awaken` in `src/content/scripts/index.ts`, summit encounter in `src/content/maps/nullpeak_summit.ts`) and is described in-species as the first mind in `src/data/species.ts`.
- Added evolution lines include `silkette -> lumoth`, `ampule -> dynabolt`, and `enigmew -> oraculum` (all defined in `src/data/species.ts`).

## Related pages
- [Primitives index](./index.md)
- [Mockemon](./mockemon.md)
- [Move](./move.md)
- [Evolution feature](../features/evolution.md)
- [MockDex feature](../features/mockdex.md)
- [Data models reference](../reference/data-models.md)
