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
| **SEND** one critter to attack (hold = stream) | `Space` | `Enter` | **A** |
| **RECALL** one to your shield (hold = all) | `Shift` | `RShift` | **B** |
| Pause | `Esc` | `Esc` | **Start** |
| Mute | `M` | `M` | **View** |

That's it — but the heart of the game is the **attack-vs-shield economy**:
your critters orbit you as a living shield. Every critter you SEND out is a
hunter that fights for you — and one less body between you and the robots.
Balance it in real time: turtle up when swarmed, unleash when it's safe.

**⚠️ YOU are the health bar (100 HP).** You regenerate slowly, apples heal
+25, and shield critters nibble anything that breaches the wall. Walk over
**cages** to free recruits, and never stop moving.

**Your mob has health too** — watch the MOB bar at the top. Critters *heal
while on shield duty*, and wounded hunters retreat home on their own to mend.
If the whole mob falls, it's a **LAST STAND**: 12 seconds to crack a cage and
rebuild, or the Tidy Empire wins. Drop below 5 critters and **golden rescue
cages** of wild volunteers start appearing — follow the gold arrow and
rebuild the parade.

## 🐾 The rules of the mob

- **Three of a kind MERGE.** Three frogs become a Bullfrog. Three Bullfrogs
  become the **FROG KING**. Every species has a throne.
- **Crossroads:** after each wave, pick a card — recruit packs, mob-wide
  buffs, piper upgrades, or wild ones (*"Bunnies occasionally make MORE
  bunnies"*).
- **12 species**, each with a job: frogs bite, ducks spit, goats headbutt,
  turtles taunt, skunks… you know. Owls snipe. The moose is a moose.
- **12 waves, 3 bosses:** MOWTRON 9000 (charges), THE SUCC-5000 (pulls your
  whole mob toward its nozzle — waddle away!), and **BUNNYTRON** — a giant
  pink robot bunny that stomps, summons, and rains **carrot bombs** on your
  mob (watch for the orange landing rings!).
- **Bag-Bots steal critters.** Pop the bot, free the friend.
- **Acorns feed the mob:** every 50 acorns you grab in a run, your whole mob
  physically **grows 15% bigger** (and reaches farther). Chunky parade!
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
node tests/engine.mjs        # 73 headless assertions
node tests/simulate.mjs 24   # bot plays full runs; reports difficulty band
node tests/perf.mjs          # 150-critter mob tick time
```

Vanilla JS + Canvas, zero dependencies, zero asset files — every critter is
drawn in code and every sound (including each species' voice) is synthesized.
A friendly announcer (your browser's built-in speech) calls out waves, bosses,
and powerups — perfect for players who can't read yet.
The whole game is balance-simulated headlessly before any human plays it.

---

*No critters are harmed. Defeated bots are recycled. The lawn will never be
tidy again.* 🦆🐐🐝
