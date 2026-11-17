/* 远景 2D 贴图平面 + 近景 3D 石台、水面、冰晶。和页面上的 #far 共用同一张图，WebGL 失败时只靠 CSS。 */
import * as THREE from '../../../charui/vendor/three/three.module.min.js';

const FOG = 0xB7C6D6;
const FOG_SEA = 0x152038;
const CLEAR = 0x9BB0C6;

function hash21(p) {
  return `float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}`;
}

const STONE_VERT = /* glsl */`
  varying vec3 vPos; varying vec3 vN; varying vec2 vUv;
  void main(){
    vUv = uv;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position,1.0);
    vPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const STONE_FRAG = /* glsl */`
  ${hash21()}
  uniform vec3 uColor; uniform vec3 uDark; uniform vec3 uLight;
  uniform float uDomain; uniform float uTime; uniform float uRadius;
  uniform sampler2D uMap; uniform float uHasMap;
  varying vec3 vPos; varying vec3 vN; varying vec2 vUv;
  float crack(vec2 p){
    float d=1.0;
    for(int i=0;i<5;i++){
      vec2 iv=floor(p), fv=fract(p);
      float m=8.0;
      for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
        vec2 g=vec2(float(x),float(y));
        vec2 o=vec2(hash21(iv+g),hash21(iv+g+17.13));
        vec2 r=g+o-fv;
        m=min(m,dot(r,r));
      }
      d=min(d,m); p=p*1.9+vec2(3.1,1.7);
    }
    return smoothstep(0.012,0.0,d);
  }
  void main(){
    vec3 n=normalize(vN);
    float lit=clamp(dot(n,normalize(vec3(.35,.8,.4))),0.0,1.0);
    float rim=pow(1.0-abs(n.y),3.0);
    vec2 xz=vPos.xz;
    float r=length(xz);
    float veins=crack(xz*1.15);
    vec3 col=mix(uColor,uDark,veins*0.18);
    /* 冰地贴图：近处用画里的裂冰，远处淡出，露出远景里的遗迹和海 */
    if(uHasMap>0.5){
      vec2 uv=vec2(xz.x/(uRadius*2.0)+0.5, -xz.y/(uRadius*2.0)+0.55);
      vec3 tex=texture2D(uMap, clamp(uv,0.0,1.0)).rgb;
      col=mix(col,tex,0.9);
    }
    float frost=smoothstep(0.15,uRadius*0.95,r);
    float sheen=pow(clamp(lit,0.0,1.0),1.4)*0.16;
    col=mix(col,uLight,sheen+rim*0.06);
    vec3 glow=mix(vec3(0.70,0.84,1.0),vec3(0.32,0.52,1.0),uDomain);
    col+=glow*veins*(0.05+uDomain*0.16);
    col=mix(col,glow,uDomain*0.12);
    float fade=smoothstep(uRadius*0.98,uRadius*0.62,r);
    gl_FragColor=vec4(col,fade);
  }
`;

const WATER_VERT = /* glsl */`
  uniform float uTime; varying vec3 vPos; varying vec3 vW; varying vec2 vUv;
  void main(){
    vec3 p=position;
    float r=length(p.xz);
    float w=sin(r*4.2-uTime*1.7)*0.02*smoothstep(8.4,1.2,r);
    w+=sin(p.x*3.4+p.z*2.2+uTime*1.2)*0.01;
    p.y+=w;
    vPos=p; vUv=uv;
    vec4 wp=modelMatrix*vec4(p,1.0); vW=wp.xyz;
    gl_Position=projectionMatrix*viewMatrix*wp;
  }
`;
const WATER_FRAG = /* glsl */`
  uniform float uTime; uniform float uDomain; uniform vec3 uSky; uniform vec3 uDeep;
  varying vec3 vPos; varying vec3 vW; varying vec2 vUv;
  void main(){
    float r=length(vPos.xz);
    float fade=smoothstep(8.6,3.2,r);
    vec2 d=vec2(dFdx(vPos.y),dFdy(vPos.y));
    vec3 n=normalize(vec3(-d.x*18.0,1.0,-d.y*18.0));
    /* 假反射：按法线把天色和下层冷色混起来 */
    float fres=pow(1.0-clamp(n.y,0.0,1.0),2.2);
    vec3 sky=mix(uSky,vec3(0.25,0.4,0.75),uDomain);
    vec3 deep=mix(uDeep,vec3(0.05,0.1,0.22),uDomain);
    vec3 col=mix(deep,sky,fres);
    float rings=sin(r*12.0-uTime*2.2);
    col+=vec3(0.7,0.85,1.0)*smoothstep(0.7,1.0,rings)*0.08*fade;
    float alpha=(0.42+fres*0.4)*fade;
    gl_FragColor=vec4(col,alpha);
  }
`;

function mulberry(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function platformGeo(radius = 2.7) {
  const shape = new THREE.Shape();
  const rnd = mulberry(7);
  const segs = 96;
  for (let i = 0; i <= segs; i++) {
    const t = (i / segs) * Math.PI * 2;
    let n = 0.96 + 0.035 * Math.sin(t * 5 + 0.4) + 0.02 * Math.sin(t * 13) + (rnd() - 0.5) * 0.03;
    /* 几处明显的崩边 */
    const notches = [0.35, 1.8, 3.4, 4.9];
    for (const a of notches) {
      const d = Math.atan2(Math.sin(t - a), Math.cos(t - a));
      if (Math.abs(d) < 0.14) n -= (0.14 - Math.abs(d)) / 0.14 * 0.06;
    }
    const x = Math.cos(t) * radius * n, y = Math.sin(t) * radius * n;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.06, bevelSegments: 2, curveSegments: 4,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export class BattleScene {
  constructor(canvas, { reducedMotion = false, background = 'assets/battle/huanhai-field.webp' } = {}) {
    this.canvas = canvas;
    this.reduced = reducedMotion;
    this.bgUrl = background;
    this.stands = new Map();
    this.parallax = { x: 0, y: 0 };
    this.push = 0;
    this.domain = 0;
    this._targetDomain = 0;
    this.clock = 0;
  }

  async init() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(w, h, false);
    this.renderer.setClearColor(CLEAR, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(FOG, 10, 24);

    this.camera = new THREE.PerspectiveCamera(34, w / Math.max(1, h), 0.1, 80);
    this._camBase = new THREE.Vector3(0.16, 3.55, 13.6);
    this._look = new THREE.Vector3(0.14, 0.62, 0);
    this._focusId = null;
    this._focus = 0;
    this.camera.position.copy(this._camBase);
    this.camera.lookAt(this._look);

    const hemi = new THREE.HemisphereLight(0xD6E4F4, 0x3A4A62, 0.85);
    this.hemi = hemi; this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xEEF3FA, 1.15);
    dir.position.set(-6, 8, 4);
    this.dir = dir; this.scene.add(dir);

    /* 远景平面 */
    const tex = await new THREE.TextureLoader().loadAsync(this.bgUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    const aspect = (tex.image && tex.image.width / tex.image.height) || 16 / 9;
    const farH = 22, farW = farH * aspect;
    const far = new THREE.Mesh(
      new THREE.PlaneGeometry(farW, farH),
      new THREE.MeshBasicMaterial({ map: tex, fog: false, depthWrite: false }),
    );
    far.position.set(0, 2.6, -14);
    far.visible = false; /* 远景改由 CSS #far 铺满，避免和 3D 平面对不齐 */
    this.far = far;
    this.scene.add(far);

    /* 石台 */
    const loader = new THREE.TextureLoader();
    let iceMap = null, marbleMap = null;
    try {
      iceMap = await loader.loadAsync('assets/battle/ice-ground.webp');
      iceMap.colorSpace = THREE.SRGBColorSpace;
      iceMap.minFilter = THREE.LinearFilter;
      iceMap.magFilter = THREE.LinearFilter;
    } catch (e) { iceMap = null; }
    try {
      marbleMap = await loader.loadAsync('assets/battle/marble-ruin.webp');
      marbleMap.colorSpace = THREE.SRGBColorSpace;
      marbleMap.minFilter = THREE.LinearFilter;
      marbleMap.magFilter = THREE.LinearFilter;
    } catch (e) { marbleMap = null; }

    this.stoneMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color('#D2DEEC') },
        uDark: { value: new THREE.Color('#9AADC2') },
        uLight: { value: new THREE.Color('#F3F7FC') },
        uDomain: { value: 0 },
        uTime: { value: 0 },
        uRadius: { value: 8.2 },
        uMap: { value: iceMap },
        uHasMap: { value: iceMap ? 1 : 0 },
      },
      vertexShader: STONE_VERT,
      fragmentShader: STONE_FRAG,
      transparent: true,
    });
    /* 大冰面用圆盘，UV 干净，边缘淡出接到远景里的海和遗迹 */
    const plat = new THREE.Mesh(new THREE.CircleGeometry(8.2, 96), this.stoneMat);
    plat.rotation.x = -Math.PI / 2;
    plat.position.y = 0;
    this.scene.add(plat);
    this.platform = plat;

    /* 近景残块改由平面背景承担，避免廉价的 3D 方块压过平面风格。 */
    this.ruins = [];
    this.marbleMap = marbleMap;

    this.ringLight = new THREE.PointLight(0x9EC0FF, 0.7, 9);
    this.ringLight.position.set(0, 0.5, 0);
    this.scene.add(this.ringLight);

    /* 当前目标脚下的选中环（1999 站位语言） */
    const mark = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.028, 10, 72),
      new THREE.MeshStandardMaterial({
        color: 0xE8F0FF, emissive: 0x7EA2E8, emissiveIntensity: 1.6,
        roughness: 0.22, metalness: 0.15, transparent: true, opacity: 0.95,
      }),
    );
    mark.rotation.x = Math.PI / 2;
    mark.position.y = 0.03;
    mark.visible = false;
    this.mark = mark;
    this.scene.add(mark);
    this.markFill = new THREE.Mesh(
      new THREE.CircleGeometry(0.92, 48),
      new THREE.MeshBasicMaterial({ color: 0x9EC0FF, transparent: true, opacity: 0.14, depthWrite: false }),
    );
    this.markFill.rotation.x = -Math.PI / 2;
    this.markFill.position.y = 0.025;
    this.markFill.visible = false;
    this.scene.add(this.markFill);

    /* 水面：铺在冰地外围，边缘融进雾里 */
    this.waterMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDomain: { value: 0 },
        uSky: { value: new THREE.Color('#C9D8EA') },
        uDeep: { value: new THREE.Color('#4A5C74') },
      },
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      transparent: true,
      depthWrite: false,
    });
    const water = new THREE.Mesh(new THREE.CircleGeometry(8.8, 96), this.waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.02;
    this.water = water;
    this.scene.add(water);

    /* 近景漂浮冰晶 */
    this.crystals = [];
    const cGeo = new THREE.OctahedronGeometry(1, 0);
    const rnd = mulberry(21);
    for (let i = 0; i < 5; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xD8E6F6, emissive: 0x6A8CC8, emissiveIntensity: 0.35,
        roughness: 0.18, metalness: 0.15, transparent: true, opacity: 0.82,
        flatShading: true,
      });
      const m = new THREE.Mesh(cGeo, mat);
      const ang = rnd() * Math.PI * 2;
      const rad = 5.4 + rnd() * 1.8;
      m.position.set(Math.cos(ang) * rad, 0.45 + rnd() * 1.5, Math.sin(ang) * rad * 0.65);
      const s = 0.08 + rnd() * 0.12;
      m.scale.set(s, s * (1.2 + rnd()), s);
      m.rotation.set(rnd(), rnd(), rnd());
      m.userData.spin = (0.2 + rnd() * 0.4) * (rnd() < 0.5 ? 1 : -1);
      m.userData.bob = 0.4 + rnd() * 0.8;
      m.userData.baseY = m.position.y;
      this.scene.add(m);
      this.crystals.push(m);
    }

    return this;
  }

  addStand(id, { x, y = 0, z = 0 }) {
    let o = this.stands.get(id);
    if (!o) {
      o = new THREE.Object3D();
      this.scene.add(o);
      this.stands.set(id, o);
    }
    o.position.set(x, y, z);
    return o;
  }

  /* 屏幕比例 (0-1, 原点左上) 反投到水平面。始终用常态镜头，避免行动近景改写脚点。 */
  screenToGround(nx, ny, planeY = 0) {
    const cam = this.camera;
    const savedPos = cam.position.clone();
    const savedQuat = cam.quaternion.clone();
    cam.position.copy(this._camBase);
    cam.lookAt(this._look);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    const ndc = new THREE.Vector3(nx * 2 - 1, -(ny * 2 - 1), 0.5);
    ndc.unproject(cam);
    const origin = cam.position.clone();
    const dir = ndc.sub(origin).normalize();
    let out = null;
    if (Math.abs(dir.y) >= 1e-4) {
      const t = (planeY - origin.y) / dir.y;
      if (t > 0) {
        const p = origin.add(dir.multiplyScalar(t));
        out = { x: p.x, y: planeY, z: p.z };
      }
    }
    cam.position.copy(savedPos);
    cam.quaternion.copy(savedQuat);
    cam.updateMatrixWorld();
    return out;
  }

  setActionFocus(id) {
    this._focusId = id || null;
  }

  project(id, height = 1.7) {
    const o = this.stands.get(id);
    if (!o) return null;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const feet = o.position.clone().project(this.camera);
    const head = o.position.clone().add(new THREE.Vector3(0, height, 0)).project(this.camera);
    const to = (v) => ({ x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h });
    const f = to(feet), p = to(head);
    return { feet: f, head: p, scale: Math.max(8, f.y - p.y) / height, visible: feet.z < 1 && feet.z > -1 };
  }

  setTarget(id) {
    this.targetId = id;
    const o = id && this.stands.get(id);
    if (!this.mark) return;
    if (!o) {
      this.mark.visible = false;
      if (this.markFill) this.markFill.visible = false;
      return;
    }
    this.mark.position.x = o.position.x;
    this.mark.position.z = o.position.z;
    this.mark.visible = true;
    if (this.markFill) {
      this.markFill.position.x = o.position.x;
      this.markFill.position.z = o.position.z;
      this.markFill.visible = true;
    }
  }

  setDomain(on) { this._targetDomain = on ? 1 : 0; }

  setPush(t) { this.push = t; }

  setParallax(x, y) { this.parallax.x = x; this.parallax.y = y; }

  update(dt) {
    this.clock += dt;
    const k = this.reduced ? 1 : 1 - Math.pow(0.08, dt);
    this.domain += (this._targetDomain - this.domain) * (this.reduced ? 1 : Math.min(1, dt * 1.8));
    if (this.stoneMat) this.stoneMat.uniforms.uTime.value = this.clock;
    if (this.stoneMat) this.stoneMat.uniforms.uDomain.value = this.domain;
    if (this.waterMat) {
      this.waterMat.uniforms.uTime.value = this.reduced ? 0 : this.clock;
      this.waterMat.uniforms.uDomain.value = this.domain;
    }
    if (this.mark) this.mark.material.emissiveIntensity = 1.5 + this.domain * 0.8 + Math.sin(this.clock * 2.4) * 0.25;
    if (this.ringLight) this.ringLight.intensity = 0.7 + this.domain * 1.1;
    const fogCol = new THREE.Color(FOG).lerp(new THREE.Color(FOG_SEA), this.domain);
    this.scene.fog.color.copy(fogCol);
    this.scene.fog.near = 11 - this.domain * 1.6;
    this.scene.fog.far = 22 - this.domain * 5;
    this.hemi.color.set(0xD6E4F4).lerp(new THREE.Color(0x6A8EC8), this.domain);
    this.hemi.groundColor.set(0x3A4A62).lerp(new THREE.Color(0x101828), this.domain);

    if (!this.reduced) {
      for (const c of this.crystals) {
        c.rotation.y += c.userData.spin * dt;
        c.rotation.x += c.userData.spin * 0.4 * dt;
        c.position.y = c.userData.baseY + Math.sin(this.clock * c.userData.bob) * 0.08;
        c.material.emissiveIntensity = 0.35 + this.domain * 0.5;
      }
    }

    const px = this.reduced ? 0 : this.parallax.x;
    const py = this.reduced ? 0 : this.parallax.y;
    this._focus += ((this._focusId ? 1 : 0) - this._focus) * (this.reduced ? 1 : Math.min(1, dt * 3.2));
    const dolly = this.push * 1.35;
    const dir = this._look.clone().sub(this._camBase).normalize();
    let base = this._camBase.clone().add(dir.multiplyScalar(dolly));
    let look = this._look.clone();
    const fo = this._focusId && this.stands.get(this._focusId);
    if (fo && this._focus > 0.001) {
      const closeCam = new THREE.Vector3(fo.position.x * 0.45 + 0.2, 2.15, fo.position.z + 7.2);
      const closeLook = new THREE.Vector3(fo.position.x, 1.05, fo.position.z);
      base = base.lerp(closeCam, this._focus);
      look = look.lerp(closeLook, this._focus);
    }
    const pos = base.add(new THREE.Vector3(px * 0.55, py * 0.28, px * 0.08));
    this.camera.position.lerp(pos, k);
    look.add(new THREE.Vector3(px * 0.15, py * 0.1, 0));
    this.camera.lookAt(look);
    if (this.far) {
      /* 远景跟得更少，做出视差 */
      this.far.position.x = px * 0.2;
      this.far.position.y = 2.6 + py * 0.12;
    }
    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  dispose() {
    this.renderer.dispose();
  }
}
