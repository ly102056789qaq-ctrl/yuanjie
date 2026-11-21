const spell = (effect, scale, seconds, height = .025, socket = '') => ({effect, scale, seconds, height, socket});

export const breakSpell = spell('Ice explosion', .52, 2.2);

export const eventSpells = {
  tornSilk:spell('2) Projectile Hit',.44,1.05,.42),
  encore:{...spell('3) Mana rune',.50,5.35,.065),rate:1.65},
  warWound:spell('FX_splash_hit_02_floor',.19,.75,.03),
  frostEtch: spell('Flash ice',.25,.8,.38),
  phantomReplay: spell('Hit butterfly', .48, 1.55, .5),
  phantomChase: spell('Flash butterfly', .41, 1.1, .55),
  realityOverwrite: spell('Blue meteor hit', .75, 2.1),
  arc: spell('Hit cyber', .49, 1.3, .55),
  conductDot: spell('Hit cyber', .28, .65, .5),
  overload: spell('Lightning', .62, 1.6),
  dreamMark: spell('Flash butterfly', .36, 1.15, .70),
  conduct: spell('Flash cyber', .38, 1.25, .5),
  sync: spell('Flash music', .36, 1.25, .44),
  tempo: spell('Tiger buff', .34, 1.7),
  bloom: spell('Flower hit', .31, 1.55, .25),
  shade: spell('Flower spell', .32, 1.65),
};

export const combatEffects = {
  daier:{
    basic:{projectile:'mana',flight:.46},
    skill:{focus:spell('1) Mana Projectile Rain',.36,4.75),contact:.87},
    ultimate:{
      cast:{...spell('6) Mana energy gathering',.36,5.05,.40),rate:1.8},
      focus:{...spell('4) Mana Big Beam',.18,6.5,.55,'beam'),rate:1.65},
      contact:3 / 1.65
    }
  },
  liselotte:{
    basic:{focus:spell('FX_splash_portal_floor',.70,2.55),contact:.40},
    skill:{focus:spell('FX_splash_hit_02_floor',.87,1.4),contact:.16},
    ultimate:{focus:spell('FX_splash_eye_air',.87,2.4,.76),contact:.28}
  },
  shen: {
    basic: {projectile:'fire',flight:.48,impact:spell('FX_splash_portal_floor',.52,1.8)},
    skill: {cast:spell('Fire crossfade cast',.53,1.55,0,'hand'),impact:spell('Fire crossfade',.68,1.9),splash:spell('Hit fire',.44,1.1,.45)},
    ultimate: {
      volley: {...spell('Red meteors',.36,2.3), sound:'meteor-ignite'},
      impact: spell('Hit fire',.50,1.2,.35),
      finisher: spell('Red meteor hit',.78,2.2),
      finisherSound: 'meteor-impact',
    },
  },
  eliot: {
    basic: {projectile:'ice',flight:.46},
    skill: {cast:spell('Flash ice',.42,1.1,0,'hand'),impact:spell('Ice magic circle',.56,2),},
    ultimate: {cast:spell('Ice magic circle',.47,1.65),impact:spell('Ice eruption',.70,2.3)},
  },
  enemy: {basic: {cast: spell('Flash cyber', .39, 1.0, .55), impact: spell('Hit cyber', .48, 1.25, .48)}},
  siwei: {
    basic: {projectile: 'butterfly', flight: .54},
    skill: {cast: spell('Flash butterfly', .58, 1.4, 0, 'hand'), impact: spell('Hit butterfly', .64, 1.65, .50)},
    ultimate: {volley: spell('Blue meteors', .31, 2.3), impact: spell('Blue meteor hit', .64, 2.1)},
  },
  dekeke: {
    basic: {projectile: 'music', flight: .70},
    skill: {cast: spell('Flash music', .54, 1.35, 0, 'hand'), benefit: spell('Tiger buff', .53, 2.2), status: 'sync'},
    ultimate: {cast: spell('Tiger buff cast', .62, 2.3, .14), benefit: spell('Tiger buff', .39, 2.2), status: 'tempo'},
  },
  vera: {
    basic: {projectile: 'cyber', flight: .36},
    skill: {cast:spell('Dark signet cast',.82,1.75,0,'hand'),focus:spell('Dark debuff',.82,1.6,.08),contact:.58},
    ultimate: {focus:spell('FX_splash_magic_02_floor',.92,2.2),contact:.70},
  },
  rin: {
    basic: {focus:spell('Vine spell',.82,3.0,.02),contact:.32},
    skill: {cast:spell('Flower spell',.71,2.3),benefit:spell('Flower hit',.56,1.75,.27)},
    ultimate: {returning:spell('Flower rain',.96,3.8,.10,'party')},
  },
};

export function openingSpellAssets(party) {
  const assets = new Set([breakSpell.effect, 'Flash cyber', 'Hit cyber']);
  for (const id of party) {
    for (const recipe of Object.values(combatEffects[id] || {})) {
      for (const cue of Object.values(recipe)) if (cue?.effect) assets.add(cue.effect);
      const projectile = recipe.projectile;
      if (projectile === 'mana') {
        assets.add('2) Projectile'); assets.add('2) Projectile Hit');
      } else if (projectile) {
        for (const part of ['Flash ', 'Projectile ', 'Hit ']) assets.add(part + projectile);
      }
    }
  }
  if (party.includes('daier')) assets.add(eventSpells.encore.effect);
  if (party.includes('vera')) assets.add(eventSpells.overload.effect);
  return assets;
}
