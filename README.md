# 🐸 MOB RULE

**Lead an ever-growing critter horde against the Tidy Empire.**

You are a tiny piper. You don't fight. You *walk*, and every critter you free
follows the exact path you walked — a living, hopping, ribbiting parade that
attacks anything tidy-looking all by itself. Start with two frogs, two ducks,
and a goat. End with a hundred-strong stampede with a FROG KING at the front.

The enemy: robot vacuums, mower drones, and clipboard-wielding mechs who
believe animals are clutter. Prove them extremely wrong.

## ▶️ Play it right now

**No install needed:** 👉 **<https://redmeatboy.github.io/Mob_Rule/>** 👈

1–2 players (local co-op) · keyboard or Xbox controllers · Chrome/Edge best.

## 🎮 How to play (there are only two buttons)

| Action | Keyboard P1 | Keyboard P2 | Xbox |
|---|---|---|---|
| Walk | `WASD` | Arrows | Left stick |
| **Whistle** (hold — sends the mob ahead) | `Space` | `Enter` | **A** |
| Recall (mob comes home) | `Shift` | `RShift` | **B** |
| Pause | `Esc` | `Esc` | **Start** |
| Mute | `M` | `M` | **View** |

That's it. The mob follows your footsteps and fights automatically. Your only
jobs: don't get cornered, walk over **cages** to free recruits, and whistle
the swarm at whatever deserves it.

## 🐾 The rules of the mob

- **Three of a kind MERGE.** Three frogs become a Bullfrog. Three Bullfrogs
  become the **FROG KING**. Every species has a throne.
- **Crossroads:** after each wave, pick a card — recruit packs, mob-wide
  buffs, piper upgrades, or wild ones (*"Bunnies occasionally make MORE
  bunnies"*).
- **12 species**, each with a job: frogs bite, ducks spit, goats headbutt,
  turtles taunt, skunks… you know. Owls snipe. The moose is a moose.
- **12 waves, 3 bosses:** MOWTRON 9000 (charges), THE SUCC-5000 (pulls your
  whole mob toward its nozzle — waddle away!), and THE SUPERVISOR (clipboard,
  stomps, performance reviews).
- **Bag-Bots steal critters.** Pop the bot, free the friend.
- **Acorns** drop from scrapped bots — they unlock **7 more species**
  permanently (bunny → skunk → owl → wizard mouse → penguin → butterfly →
  moose) and track your legend: *biggest mob ever* is saved forever.
- **Co-op:** critters follow whichever piper is nearest; each of you whistles
  your own half of the swarm. Downed partner? Stand close to revive.
- **Little Piper mode** (per player): extra hearts, bigger pickup magnet,
  louder whistle. Toggle on the title screen.

## 🛠️ Running locally & tech

```bash
git clone https://github.com/RedMeatBoy/Mob_Rule.git
cd Mob_Rule && npx serve     # or python -m http.server
node tests/engine.mjs        # 31 headless assertions
node tests/simulate.mjs 24   # bot plays full runs; reports difficulty band
node tests/perf.mjs          # 150-critter mob tick time
```

Vanilla JS + Canvas, zero dependencies, zero asset files — every critter is
drawn in code and every sound (including each species' voice) is synthesized.
The whole game is balance-simulated headlessly before any human plays it.

---

*No critters are harmed. Defeated bots are recycled. The lawn will never be
tidy again.* 🦆🐐🐝
