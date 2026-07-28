# Balance simulation

`tools/simulate.ts` is a campaign difficulty simulator used to tune the demo progression and early-game reliability.

It reuses production systems directly:

- `Battle` from `src/battle.ts`
- Species, moves, and type effectiveness from `src/data/*`
- Trainer parties and encounter tables from `src/maps.ts`

## Player policy and campaign model

The simulated player uses a greedy move policy (`pickPlayerMove`) that scores damaging moves by:

- base power
- type effectiveness against the current enemy
- STAB multiplier when move type matches the active Mockemon

Status moves are skipped by this policy, and if no damaging PP remains it falls back to any move with PP.

`runCampaign` models one story run:

- Rival fight first (`COUNTER` starter), with story-tolerated loss.
- Wild grinding on `route1` for configurable counts (`wildFights`), including a simulated early catch.
- Route trainers (`trainer_ben`, `trainer_mia`, `trainer_cliff`) with pre-fight heals and minimum potion stock.
- Gym sequence with center heal, Super Potion budget, then `trainer_rocco` and `leader_terra`.

Whiteouts are modeled as soft failures, matching game behavior (heal and retry), not instant run failure.

## Stuck detection and metrics

The script uses `MAX_ATTEMPTS = 5` per trainer. A campaign is marked stuck only after 5 straight losses to the same trainer.

Each config runs `TRIALS = 400`, across:

- `wildFights` in `[4, 8, 12]`
- starters `sproutle`, `cindercub`, `puddlefin`

Reported outputs include:

- badge clear rate (`badge%`)
- flawless run rate (`flawless%`, zero whiteouts)
- average whiteouts
- average lead level at Terra (`avgLv@Terra`)
- stuck-point distribution
- first-try loss distribution

## Changes driven by simulation

The sim was used to drive concrete balance retunes, including:

- `cc84809`: EXP gain multiplier retuned (`x2.3`), softer gym stats, town heal flow, and Dig added for Cindercub progression.
- `f3ea51a`: Dig standardized at 80 power, Bouldron learns Mud Slap at level 12, Terra Bouldron set to level 10, restoring Cindercub badge rate to the 92-98% range in 400-trial sweeps.

Related:

- [Tooling](../how-to-contribute/tooling.md)
- [Trainer AI](../systems/battle-engine/trainer-ai.md)
