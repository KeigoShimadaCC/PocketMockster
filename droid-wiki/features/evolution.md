# Evolution
Active contributors: Keigo

## Purpose
Describe evolution triggers from `src/evolution.ts` and where each trigger is applied in battle and overworld flows.

## Evolution triggers
`checkEvolution(m, trigger)` supports four evolution methods:
1. Level: `method: 'level'` with `m.level >= evo.level`
2. Friendship: `method: 'friendship'` with `m.friendship >= (evo.min ?? 160)`
3. Stone: `method: 'stone'` with matching stone item id
4. Trade: `method: 'trade'`

## Where each trigger fires
- Level and friendship:
  - In `Battle.grantExp` after level-up checks.
  - In `Game.processEvolutions` after battle move-learning prompts, via `checkEvolution(..., { kind: 'level' })`.
- Stone:
  - In `openPartyMenu` when using a pending stone from bag flow.
- Trade:
  - In `openTradeSelect` for the hiker trade, via `checkEvolution(received, { kind: 'trade' })`.

## Evolution application
`evolve(m, toSpecies)` in `src/mockemon.ts`:
- Replaces `m.species` with the target species.
- Preserves nickname if the Mockemon had a custom nickname.
- If nickname matched default species name, it is replaced with the new default species name.
- Recalculates stats.

## Species examples from `src/data/species.ts`
- `sproutle -> bramblore` at level 15
- `nibbit -> nibblex` by friendship
- `sparkit -> voltkat` with `thunderstone`
- `pebblit -> bouldron` by trade
- `floazy -> driftail` with `waterstone`
- `psywisp -> somnara` with `moonstone`

## Related pages
- [Trading](trading.md)
- [Species primitive](../primitives/species.md)
