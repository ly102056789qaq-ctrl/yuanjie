export function rinSequence(stage) {
  const screen = document.createElement('div');
  screen.id = 'rin-cine';
  screen.innerHTML = '<img alt="" class="flower-shop"><img alt="" class="petals"><div class="rain"></div><div class="letterbox"></div><div class="subtitle">“……等雨停了，我们再走吧。”</div><div class="flash"></div>';
  document.body.append(screen);
  const [shop, petals] = screen.querySelectorAll('img');
  shop.src='../../cocos/battle/assets/art/cg/rin-ult-a.png';
  petals.src='../../cocos/battle/assets/art/cg/rin-ult-b.png';
  let previousBeat=-1;
  return (beat, fraction, speed) => {
    const progress=Math.min(1, Math.max(0,fraction));
    if (previousBeat!==beat) {
      screen.dataset.beat=String(beat);
      if (beat===0) { parent.yjOnCutscene?.(true); stage.spell('Ally_Rin',{effect:'Flower spell',height:.12,scale:.45,seconds:1.8},speed); }
      if (beat===3) {
        stage.act('Ally_Rin','cast',speed);
        stage.spell('Ally_Rin',{effect:'Flower spell',height:.08,scale:.66,seconds:1.65,socket:'party'},speed);
      }
      if (beat===-1) parent.yjOnCutscene?.(false);
      previousBeat=beat;
    }
    screen.style.setProperty('--push',String(1.02+.075*progress));
    screen.style.setProperty('--pan',`${(beat===1?-1:1)*1.8*progress}%`);
    screen.style.setProperty('--flash', String(beat===0?Math.max(0,(progress-.85)/.15):beat===1||beat===3?Math.max(0,1-progress*10):0));
    screen.style.setProperty('--subtitle',String(beat===1?Math.min(1,Math.max(0,(progress-.22)*8),Math.max(0,(1-progress)*12)):0));
  };
}
