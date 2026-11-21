const clipFiles = ['cast.wav', 'strike.wav', 'fracture.wav', 'sea-open.wav', 'sea-close.wav',
  'meteor-ignite.mp3', 'meteor-impact.mp3'];

export function createCombatFeedback(positionOf) {
  const clips = new Map();
  const voices = new Set();
  let context, output, lastHit = -Infinity, lit = 0, field = false;
  const gleams = Array.from({length: 4}, () => {
    const element = document.createElement('i');
    element.className = 'contact-light';
    element.setAttribute('aria-hidden', 'true');
    document.body.append(element);
    return element;
  });
  const unlocked = () => {
    if (!window.AudioContext) return;
    if (!context) {
      context = new AudioContext();
      output = context.createGain();
      output.gain.value = .48;
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -15;
      limiter.ratio.value = 5;
      output.connect(limiter).connect(context.destination);
      for (const file of clipFiles) {
        const name = file.split('.')[0];
        fetch(new URL(`./audio/${file}`, import.meta.url)).then(response => {
          if (!response.ok) throw new Error(response.status);
          return response.arrayBuffer();
        }).then(bytes => context.decodeAudioData(bytes)).then(buffer => clips.set(name, buffer))
          .catch(error => console.warn('Battle sound unavailable', name, error));
      }
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
  };
  for (const surface of new Set([window, window.parent])) {
    for (const type of ['pointerdown', 'keydown']) surface.addEventListener(type, unlocked, {capture:true});
  }
  if (navigator.userActivation?.hasBeenActive || window.parent.navigator.userActivation?.hasBeenActive) unlocked();

  function play(name, pan = 0, gain = 1, pitch = 1) {
    const buffer = clips.get(name);
    if (context?.state !== 'running' || !buffer || document.hidden || voices.size >= 12) return;
    const source = context.createBufferSource();
    const level = context.createGain();
    const stereo = context.createStereoPanner();
    source.buffer = buffer;
    source.playbackRate.value = pitch;
    level.gain.value = gain;
    stereo.pan.value = Math.max(-.65, Math.min(.65, pan));
    source.connect(level).connect(stereo).connect(output);
    voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); level.disconnect(); stereo.disconnect(); };
    source.start();
  }

  function light(point, color, heavy) {
    if (!point || document.hidden) return;
    const element = gleams[lit++ % gleams.length];
    element.getAnimations().forEach(animation => animation.cancel());
    element.style.left = `${point.x * 100}%`;
    element.style.top = `${point.y * 100}%`;
    element.style.color = color;
    element.style.width = heavy ? '21vmin' : '14vmin';
    element.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.58)'},
      {opacity:heavy ? .80 : .55,offset:.12,transform:'translate(-50%,-50%) scale(.88)'},
      {opacity:0,transform:'translate(-50%,-50%) scale(1.28)'}],{duration:heavy ? 260 : 170,easing:'ease-out'});
  }

  return {
    spell(node, sound) {
      const point = positionOf(node,.55);
      play(sound, point ? point.x*2-1 : 0, .70);
    },
    cast(node, motion) {
      const point = positionOf(node,.6);
      play('cast',point ? point.x*2-1 : 0, motion === 'attack' ? .43 : .75, node === 'Ally_Siwei' ? 1.15 : .95);
    },
    hit(node, heavy, color, sound) {
      const point = positionOf(node,.55);
      light(point, color, heavy);
      const now = performance.now();
      if (!sound && now-lastHit < 46) return;
      lastHit = now;
      if (sound && clips.has(sound)) {
        play(sound,point ? point.x*2-1 : 0);
        return;
      }
      play(heavy ? 'fracture' : 'strike',point ? point.x*2-1 : 0,heavy ? 1 : .78, .96 + Math.random()*.09);
    },
    sea(active) { if (field === active) return; field = active; play(active ? 'sea-open' : 'sea-close',0,.9); },
    reset() { field=false; lastHit=-Infinity; voices.forEach(voice=>voice.stop()); gleams.forEach(element=>element.getAnimations().forEach(animation=>animation.cancel())); },
  };
}
