// data.js — species, enemies, waves, crossroads choices, flavor. All content
// lives here; systems never hardcode a critter.

// ---------- SPECIES ----------
// role: melee | ranged | charge | aoe | heal | tank | slam | homing | pierce
// Tier scaling applied in critters.js: dmg/hp ×2.3 per tier, size ×1.32.
// tierNames feed the merge fanfare — evolving to "FROG KING" matters.

export const SPECIES = {
  frog: {
    name: 'Frog', tierNames: ['Frog', 'Bullfrog', 'FROG KING'],
    role: 'melee', dmg: 3, atkTime: 0.9, hp: 13, speed: 150, size: 11,
    body: '#6fbf73', belly: '#c8e8b0', accent: '#3a7a3e', shape: 'blob',
    sound: 'ribbit', unlock: 0,
  },
  duck: {
    name: 'Duck', tierNames: ['Duck', 'Mallard Elite', 'DUCK OF WAR'],
    role: 'ranged', dmg: 2, atkTime: 1.1, range: 150, hp: 10, speed: 140, size: 11,
    body: '#f0e6c8', belly: '#fff8e0', accent: '#ff9c42', shape: 'bird',
    sound: 'quack', unlock: 0,
  },
  goat: {
    name: 'Goat', tierNames: ['Goat', 'Battering Goat', 'THE UNFENCED'],
    role: 'charge', dmg: 5, atkTime: 2.0, hp: 18, speed: 160, size: 13,
    body: '#d8d0c0', belly: '#f0ece0', accent: '#8a7a5a', shape: 'quad', horns: true,
    sound: 'bleat', unlock: 0,
  },
  bee: {
    name: 'Bee', tierNames: ['Bee', 'Big Bee', 'THE COMMITTEE'],
    role: 'melee', dmg: 1, atkTime: 0.35, hp: 5, speed: 210, size: 7,
    body: '#ffd24a', belly: '#ffe9a0', accent: '#2e2a20', shape: 'bug', flies: true, stripes: true,
    sound: 'buzz', unlock: 0,
  },
  turtle: {
    name: 'Turtle', tierNames: ['Turtle', 'Battle Shell', 'FORTRESS'],
    role: 'tank', dmg: 2, atkTime: 1.2, hp: 38, speed: 90, size: 12,
    body: '#7bb87f', belly: '#c8b878', accent: '#4a7a4e', shape: 'shell',
    sound: 'thunk', unlock: 0,
  },
  bunny: {
    name: 'Bunny', tierNames: ['Bunny', 'Jackrabbit', 'THE MULTIPLIER'],
    role: 'melee', dmg: 2, atkTime: 0.8, hp: 10, speed: 180, size: 10,
    body: '#e8d8c8', belly: '#f8f0e4', accent: '#ffb7c5', shape: 'blob', ears: true,
    sound: 'squeak', unlock: 300,
  },
  skunk: {
    name: 'Skunk', tierNames: ['Skunk', 'Code Green', 'THE INCIDENT'],
    role: 'aoe', dmg: 1, atkTime: 0.5, radius: 62, cooldown: 3, hp: 13, speed: 120, size: 12,
    body: '#2e2a35', belly: '#4a4455', accent: '#f0f0f0', shape: 'quad', tail: true,
    sound: 'pfft', unlock: 700,
  },
  owl: {
    name: 'Owl', tierNames: ['Owl', 'Night Watch', 'THE PROFESSOR'],
    role: 'ranged', dmg: 6, atkTime: 1.8, range: 260, hp: 9, speed: 150, size: 11,
    body: '#a58a6f', belly: '#e0cfa8', accent: '#6f5a45', shape: 'bird', flies: true, tufts: true,
    sound: 'hoot', unlock: 1200,
  },
  wizmouse: {
    name: 'Wizard Mouse', tierNames: ['Wizard Mouse', 'Arch-Mouse', 'MOUSTERIOUS'],
    role: 'homing', dmg: 4, atkTime: 1.4, range: 200, hp: 8, speed: 140, size: 9,
    body: '#b8b0c8', belly: '#e0dcea', accent: '#6a4fbf', shape: 'blob', hat: true,
    sound: 'zap', unlock: 1800,
  },
  penguin: {
    name: 'Penguin', tierNames: ['Penguin', 'Torpedo', 'EMPEROR'],
    role: 'pierce', dmg: 4, atkTime: 2.2, hp: 16, speed: 130, size: 11,
    body: '#2e3440', belly: '#f0f4f8', accent: '#ff9c42', shape: 'bird',
    sound: 'honk', unlock: 2500,
  },
  butterfly: {
    name: 'Butterfly', tierNames: ['Butterfly', 'Monarch', 'THE APOTHECARY'],
    role: 'heal', heal: 3, atkTime: 2.0, radius: 90, hp: 8, speed: 160, size: 9,
    body: '#e8a0d0', belly: '#f8d0ea', accent: '#c05a9a', shape: 'bug', flies: true, wings: true,
    sound: 'chime', unlock: 3500,
  },
  moose: {
    name: 'Moose', tierNames: ['Moose', 'Vast Moose', 'THE LANDMASS'],
    role: 'slam', dmg: 8, atkTime: 1.6, radius: 55, hp: 60, speed: 110, size: 18,
    body: '#8a6b45', belly: '#a88a60', accent: '#5a4632', shape: 'quad', antlers: true, big: true,
    sound: 'bellow', unlock: 5000,
  },
};

export const SPECIES_IDS = Object.keys(SPECIES);
export const TIER_MULT = { dmg: 2.3, hp: 2.3, size: 1.32 };
export const MOB_CAP = 150;

// ---------- ENEMIES (the Tidy Empire) ----------
export const ENEMIES = {
  dustbot: {
    name: 'Dust-Bot', hp: 10, dmg: 1, speed: 70, size: 12, xp: 1,
    body: '#8a8a96', accent: '#5aa9ff', behavior: 'chase',
  },
  mower: {
    name: 'Mower Drone', hp: 22, dmg: 3, speed: 55, size: 15, xp: 3,
    body: '#6a8a3a', accent: '#e05c5c', behavior: 'mowcharge',
    chargeSpeed: 300, chargeCd: 3.5, telegraph: 0.8,
  },
  tidydrone: {
    name: 'Tidy Drone', hp: 12, dmg: 2, speed: 80, size: 11, xp: 2,
    body: '#b8bec8', accent: '#e8c33a', behavior: 'shooter',
    range: 220, keepDist: 170, shootCd: 2.4, projSpeed: 160, flies: true,
  },
  broom: {
    name: 'Broom Mech', hp: 30, dmg: 2, speed: 50, size: 16, xp: 4,
    body: '#7a6a58', accent: '#c9a05a', behavior: 'sweeper',
    sweepCd: 3, sweepRange: 70,
  },
  bagbot: {
    name: 'Bag-Bot', hp: 16, dmg: 0, speed: 115, size: 13, xp: 4,
    body: '#5a5a66', accent: '#e8e8f0', behavior: 'bagger',
  },
  conebot: {
    name: 'Cone-Bot', hp: 14, dmg: 1, speed: 65, size: 12, xp: 3,
    body: '#c96a2e', accent: '#f0f0f0', behavior: 'coner', coneCd: 4,
  },
  cone: { // placed obstacle, not really an enemy but lives in the enemy pool
    name: 'Traffic Cone', hp: 10, dmg: 0, speed: 0, size: 10, xp: 1,
    body: '#e8762e', accent: '#f0f0f0', behavior: 'static',
  },
  mowtron: {
    name: 'MOWTRON 9000', hp: 450, dmg: 5, speed: 40, size: 34, xp: 60, boss: true,
    body: '#5a7a2a', accent: '#e05c5c', behavior: 'boss_mowtron',
    chargeSpeed: 340, telegraph: 1.0,
  },
  succ: {
    name: 'THE SUCC-5000', hp: 650, dmg: 4, speed: 35, size: 36, xp: 80, boss: true,
    body: '#6a5a8a', accent: '#c8ccd8', behavior: 'boss_succ',
    pullRadius: 340, pullForce: 130,
  },
  supervisor: { // final boss: BUNNYTRON, the giant pink robot bunny
    name: 'BUNNYTRON', hp: 950, dmg: 6, speed: 45, size: 38, xp: 120, boss: true,
    body: '#ff8fb3', accent: '#ffd7e6', behavior: 'boss_supervisor',
  },
};

export function enemyScale(wave) {
  return { hp: 1 + 0.21 * (wave - 1), dmg: 1 + 0.065 * (wave - 1) };
}

// ---------- WAVES ----------
// duration secs, rate spawns/sec [start,end], mix [[id, weight]], boss?, cages: recruit crates
export const WAVES = [
  { duration: 28, rate: [0.32, 0.55], mix: [['dustbot', 1]], cages: 4 },
  { duration: 32, rate: [0.45, 0.75], mix: [['dustbot', 6], ['mower', 2]], cages: 4 },
  { duration: 36, rate: [0.55, 0.95], mix: [['dustbot', 5], ['mower', 2], ['tidydrone', 3]], cages: 4 },
  { duration: 45, rate: [0.35, 0.6], mix: [['dustbot', 1]], boss: 'mowtron', cages: 2 },
  { duration: 38, rate: [0.9, 1.4], mix: [['dustbot', 5], ['tidydrone', 3], ['broom', 2]], cages: 3 },
  { duration: 40, rate: [1.0, 1.5], mix: [['dustbot', 4], ['mower', 3], ['bagbot', 2]], cages: 3 },
  { duration: 42, rate: [1.1, 1.7], mix: [['dustbot', 4], ['tidydrone', 3], ['broom', 2], ['bagbot', 2]], cages: 3 },
  { duration: 50, rate: [0.4, 0.7], mix: [['tidydrone', 1], ['dustbot', 2]], boss: 'succ', cages: 2 },
  { duration: 42, rate: [1.2, 1.8], mix: [['dustbot', 4], ['mower', 3], ['conebot', 2], ['broom', 2]], elite: true, cages: 3 },
  { duration: 45, rate: [1.3, 2.0], mix: [['dustbot', 4], ['tidydrone', 4], ['bagbot', 2], ['conebot', 2]], elite: true, cages: 3 },
  { duration: 48, rate: [1.4, 2.2], mix: [['mower', 3], ['broom', 3], ['tidydrone', 3], ['bagbot', 2]], elite: true, cages: 3 },
  { duration: 60, rate: [0.5, 0.9], mix: [['dustbot', 3], ['tidydrone', 2], ['mower', 1]], boss: 'supervisor', cages: 2 },
];

// ---------- CROSSROADS CHOICES ----------
// kind: pack (recruit critters) | mobBuff | piperBuff | wild
// Weights adjust dynamically in game.js (packs favored early).
export const CHOICES = [
  { id: 'pack_frog', kind: 'pack', species: 'frog', count: 5, icon: 'frog', title: '4 Frogs', desc: 'The classic. They bite.' },
  { id: 'pack_duck', kind: 'pack', species: 'duck', count: 4, icon: 'duck', title: '3 Ducks', desc: 'Ranged spit. Zero remorse.' },
  { id: 'pack_goat', kind: 'pack', species: 'goat', count: 2, icon: 'goat', title: '2 Goats', desc: 'Headbutts. Knockback. Attitude.' },
  { id: 'pack_bee', kind: 'pack', species: 'bee', count: 8, icon: 'bee', title: '6 Bees', desc: 'So many. So fast. So angry.' },
  { id: 'pack_turtle', kind: 'pack', species: 'turtle', count: 2, icon: 'turtle', title: '2 Turtles', desc: 'Walls with opinions.' },
  { id: 'pack_bunny', kind: 'pack', species: 'bunny', count: 4, icon: 'bunny', title: '3 Bunnies', desc: 'Quick nibblers.', needsUnlock: 'bunny' },
  { id: 'pack_skunk', kind: 'pack', species: 'skunk', count: 2, icon: 'skunk', title: '2 Skunks', desc: 'Area denial. You know what.', needsUnlock: 'skunk' },
  { id: 'pack_owl', kind: 'pack', species: 'owl', count: 2, icon: 'owl', title: '2 Owls', desc: 'Long-range judgment.', needsUnlock: 'owl' },
  { id: 'pack_wizmouse', kind: 'pack', species: 'wizmouse', count: 2, icon: 'wizmouse', title: '2 Wizard Mice', desc: 'Homing missiles (magic).', needsUnlock: 'wizmouse' },
  { id: 'pack_penguin', kind: 'pack', species: 'penguin', count: 2, icon: 'penguin', title: '2 Penguins', desc: 'Belly-slide torpedoes.', needsUnlock: 'penguin' },
  { id: 'pack_butterfly', kind: 'pack', species: 'butterfly', count: 2, icon: 'butterfly', title: '2 Butterflies', desc: 'Mob medics. Very gentle.', needsUnlock: 'butterfly' },
  { id: 'pack_moose', kind: 'pack', species: 'moose', count: 1, icon: 'moose', title: 'A Moose', desc: 'It’s a moose.', needsUnlock: 'moose' },

  { id: 'buff_dmg', kind: 'mobBuff', stat: 'dmg', amount: 0.15, icon: 'star', title: 'Sharper Teeth', desc: 'Mob damage +15%' },
  { id: 'buff_hp', kind: 'mobBuff', stat: 'hp', amount: 0.20, icon: 'heart', title: 'Thicker Fur', desc: 'Mob toughness +20%' },
  { id: 'buff_speed', kind: 'mobBuff', stat: 'speed', amount: 0.12, icon: 'wind', title: 'Zoomies For All', desc: 'Mob speed +12%' },
  { id: 'buff_atkspd', kind: 'mobBuff', stat: 'atkspd', amount: 0.12, icon: 'bolt', title: 'Caffeinated Mob', desc: 'Mob attack speed +12%' },
  { id: 'buff_crit', kind: 'mobBuff', stat: 'crit', amount: 0.08, icon: 'burst', title: 'Wild Swings', desc: '+8% chance of DOUBLE damage' },

  { id: 'piper_heart', kind: 'piperBuff', stat: 'maxhp', amount: 25, icon: 'heart', title: 'Second Wind', desc: '+25 Max HP, and heal up!' },
  { id: 'piper_speed', kind: 'piperBuff', stat: 'speed', amount: 0.12, icon: 'wind', title: 'Marching Boots', desc: 'Piper speed +12%' },
  { id: 'piper_regen', kind: 'piperBuff', stat: 'regen', amount: 1, icon: 'heart', title: 'Healing Hum', desc: '+1 HP regen every second' },
  { id: 'piper_charm', kind: 'piperBuff', stat: 'charm', icon: 'swirl', title: 'Charming Tune', desc: 'Bots near you get dizzy (slowed)' },

  { id: 'wild_bunnies', kind: 'wild', effect: 'bunnyBreed', icon: 'bunny', title: 'Spring Time', desc: 'Bunnies occasionally make MORE bunnies', needsUnlock: 'bunny' },
  { id: 'wild_crown', kind: 'wild', effect: 'crown', icon: 'crown', title: 'Royal Decree', desc: 'Your biggest critter gets a crown: +50% everything' },
  { id: 'wild_bees', kind: 'wild', effect: 'beeFuneral', icon: 'bee', title: 'Bee Solidarity', desc: 'When a critter is lost, a bee joins in its memory' },
];

// ---------- UNLOCKS (lifetime acorns) ----------
export const UNLOCK_ORDER = ['bunny', 'skunk', 'owl', 'wizmouse', 'penguin', 'butterfly', 'moose'];

// ---------- FLAVOR ----------
export const TIDY_LINES = [
  'CLUTTER DETECTED.', 'PLEASE HOLD STILL FOR BAGGING.', 'THIS LAWN IS NOT UP TO CODE.',
  'ANIMALS BELONG IN FILING CABINETS.', 'BEEP. RUDE.', 'YOUR CHAOS HAS BEEN SCHEDULED FOR REMOVAL.',
];
export const DEFEAT_LINES = [
  'The mob scattered. They’ll tell stories about you at the pond.',
  'The Tidy Empire filed you under M for Mess.',
  'You have been swept. Respectfully.',
  'The bots tidied everything. It’s horrible. So clean.',
];
export const VICTORY_LINES = [
  'BUNNYTRON has been unplugged. The meadow is gloriously messy forever.',
  'Nature wins. The paperwork is returned to sender, via goat.',
  'The mob celebrates by ignoring you and eating everything.',
];
export const TIPS = [
  'Critters follow the path YOU walk. Loop around enemies to surround them!',
  'Whistle (hold it!) to send the mob ahead. Let go and they come home.',
  'Your mob circles you as a SHIELD. Tap Space to send ONE out hunting.',
  'Hold Shift to pull hunters back when the robots get pushy.',
  'YOU are the health bar (100 HP). Snacks heal 25. Standing still regens.',
  'More shields = safer piper. More hunters = faster kills. Choose!',
  'The MOB bar shows your wall’s health. Critters HEAL while on shield duty.',
  'Hurt hunters retreat home by themselves. Let them mend before re-sending.',
  'If the whole mob falls, sprint for a cage — 12 seconds to rebuild or bust.',
  'Three of the same critter MERGE into something bigger. Collect triples!',
  'Cages hold recruits. Walk over them. Free the friends.',
  'Bag-Bots steal critters — pop the bot, get your friend back.',
  'The vacuum boss pulls. Waddle away and let the mob chew its hose.',
  'Turtles up front, ducks in the back. Or all bees. All bees works.',
];
export const MERGE_LINES = ['EVOLVED!', 'BIG UPGRADE!', 'PROMOTION!', 'ASCENDED!'];
