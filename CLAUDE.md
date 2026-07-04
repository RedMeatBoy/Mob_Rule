# MOB RULE — swarm-leader survivor

Designed explicitly around proven strengths (see Brad's verdicts on prior
games): constant feedback, auto-combat, entity-count spectacle, zero precision
input, headlessly simulatable balance. No platforming, no feel-critical physics.

**Core fantasy:** the mob IS the shield, the weapon, and the progression.
Redesign (Brad round-2 feedback): critters ORBIT the piper as a shield;
Space sends ONE out to hunt (hold = stream), Shift recalls one (hold = all).
Piper has 100 HP + slow regen + apple drops (+25). Music: 5 songs 30s+ each,
rotating every ~2 min at song boundaries.

Round-3 (Brad feedback): mob health is a managed resource — HUD MOB bar,
per-critter HP bars when hurt, critters heal 4%/s on shield duty, hunters
auto-retreat to shield below 50% HP. Mob wipe triggers LAST STAND (12s to
crack a cage, arrow points the way) else the run ends with cause 'mobwipe'
(no soft-lock). Sneaky bots (30%, e.sneaky) target the piper directly so
piper HP matters before the mob dies; boss stomp/broom sweep deal 0.6-0.65x
to critters so one AOE can't erase the packed orbit.

Phase A (Brad's expansion plan): 3 save slots (localStorage mob_rule_slot_0..2,
legacy mob_rule_v1 auto-migrates to slot 0; game boots to 'saves' state;
delete = double confirm, both spoken, NO is default). CHARACTERS in data.js:
pip (baseline), bam (send 3 + 1.5s cd, hunterAspd 1.2, nibbleMul 0.8, speed
0.88), vivi (recallStream 0.06, recallRush 2.5, shieldSlow 1.2, hunterDmg
0.85, sendStream 0.2). Mods ride on critters (c.mods = owner piper.char);
atkCad() centralizes cadence. audio.lead: bam doubles kicks, vivi saw lead.
Sim: all 3 chars median 9 IN BAND (tests/simulate.mjs N runs pip|bam|vivi).
Sister editions on the same GitHub origin: Mob_Rule_Upgraded (Phase B) and
Mob_Rule_Extended (Phase C) — localStorage keys MUST stay namespaced per
edition to avoid cross-save contamination.

Round-6 (Brad feedback): final boss reskinned to BUNNYTRON, giant pink robot
bunny (same id 'supervisor', same stomp/projectile/summon moveset) + carrot
bombs: telegraphed AOE (enemies.bombs, 1.25s fall, r92, aimed at random
critters; 2/volley, 3 + faster in phase2). Acorn-fed growth: every 50
run-acorns mob sizeMul ×1.15 (cap ×2 at tier 5) — scales sprite, reach,
nibble size, orbit radius (×0.7 blend). enemyScale nudged 0.18→0.21 hp /
0.06→0.065 dmg to offset the reach buff (sim was median 11 + a bot win;
back to median 10, 0 wins).

Round-5 (Brad feedback, post-victory): fx.notice() = 2.6s readable popups
(cage frees, crossroads cards, acorn hint) vs 0.55s fx.num; audio.say() =
Web Speech announcer (bright/positive, priority lines interrupt, chatter
lines skip-if-busy; no-ops headless) for waves, boss, cards, cages, rescue,
win/lose, first acorn — for the pre-reading 5yo; ambient mob chatter
(random species voice every 2-4s); acorn pickups show '+N acorn' and the
first of each run explains unlocks.

Round-4 (Brad feedback): RESCUE DRIP — mob < 5 spawns a golden rescue cage
(4-5 critters) within ~10s then every 30s, with a gold HUD arrow, so a
shrinking mob is recoverable instead of a death spiral. Health scarcer:
snack drop 9%→5%, regen 1.0→0.7 (little 1.2). Chasers get e.flank (personal
bearing, fades inside 120px) so packs surround and box in instead of
trailing in one clump.

## Status: complete & tuned

- 12 species × 3 tiers (auto-merge 3→1 with fanfare), 6 bot types + 3 bosses,
  12 waves, 24 crossroads cards, 7 meta unlocks (lifetime acorns), co-op with
  proximity revive, Little Piper mode, march music (lookahead scheduler).
- Verified: 31/31 headless assertions (stable across repeated runs);
  balance sim IN BAND (mediocre bot: median wave 7 of 12, never wins);
  perf 0.27ms avg tick with 154 critters + bots + projectiles.

## Architecture

```
src/
  data.js      ALL content: species, enemies, waves, choices, flavor
  critters.js  MobSystem: trail-following AI (each critter follows the piper's
               recorded path at its own lag+lateral offset — the conga-swarm),
               9 role behaviors, auto-merge (worth grows even as count shrinks),
               wild-card effects, cached procedural sprites
  piper.js     player: movement, trail ring-buffer, whistle rally, hearts
  enemies.js   Tidy Empire bots + MOWTRON/SUCC-5000/BUNNYTRON
  game.js      state machine, fixed 60Hz, waves, cages, acorns, crossroads,
               camera (co-op zoom), meta save (localStorage 'mob_rule_v1')
  ui.js        title, HUD (the BIG mob counter), crossroads cards, end screens
  input.js, audio.js, fx.js, pool.js
```

### Key invariants & gotchas
- **Merges can shrink `mob.list` mid-iteration** (boss drops, bunny breeding,
  pack applies). `remove()` marks `_gone`; every list iteration guards
  `!c || c._gone`. Tests measure mob WORTH (Σ 3^(tier-1)), never raw count.
- Mob cap 150; over-cap recruits convert to acorns with a joke.
- Trail: piper stores a point every 7px moved (ring buffer 420); critter i
  follows point at `lag` with perpendicular `side` offset.
- Whistle rally: hold-to-maintain, 0.35s linger, snaps to nearest bot within
  200px of the aim point (aim assist for kids).
- Bag-bots physically remove critters (`bagged`) — killing the bot frees them;
  reaching the arena edge deletes them permanently.

## Balance knobs (in tuning order)
- `data.js` SPECIES hp/dmg (already +60% hp pass applied), `enemyScale()`
  growth (0.18 hp / 0.06 dmg per wave), WAVES rate arrays, pack counts.
- Between-wave full mob heal happens in `game.endWave` (kindness mechanic).
- Run `node tests/simulate.mjs 24` after ANY change: target median wave 6–11
  for the mediocre bot. Currently 7.

## Verification
```
node tests/engine.mjs      # 31 assertions: follow/merge/combat/whistle/
                           # crossroads/bosses/co-op/wilds
node tests/simulate.mjs 24 # difficulty band check
node tests/perf.mjs        # max-load tick time
```

## Adding content
- Species: add to SPECIES in data.js (role picks the behavior; add a pack
  card + unlock threshold). New roles need a case in critters.behaveCombat.
- Enemy: ENEMIES entry + behavior case in enemies.behave + drawBot case.
- Crossroads card: CHOICES entry; wild effects need a hook in critters/game.
- Waves: WAVES table (12 entries; boss field spawns at 12% progress).
