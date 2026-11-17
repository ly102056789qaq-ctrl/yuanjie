/* 源界 · 升格页 3D 玻璃碎片（Three.js r170，本地文件）。
   碎片 = 有厚度的挤出体：正面贴她的原画（自发光保真 + 清漆反射），侧面是发光玻璃边；
   正面再叠一层物理透射玻璃（折射、色散、虹彩）；裂缝流光、选中描边和光尘走选择性泛光（Bloom）。
   只负责画面；点击、键盘、文字都在 HTML 层。 */
import * as THREE from 'three';
import {EffectComposer} from './vendor/three/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from './vendor/three/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from './vendor/three/jsm/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from './vendor/three/jsm/postprocessing/ShaderPass.js';
import {OutputPass} from './vendor/three/jsm/postprocessing/OutputPass.js';
import {RoomEnvironment} from './vendor/three/jsm/environments/RoomEnvironment.js';

const BLOOM=1;const useBloom=new URLSearchParams(location.search).get('bloom')==='1';
export async function mount(host,o){
  /* o: {polys:[[ [x,y],... ]×6], art:url|null, img:{x,y,w,h}, unlocked:[bool×6], sel, stage:{w,h}} —— 坐标都是 1920×1080 舞台像素 */
  const W=o.stage.w,H=o.stage.h;
  const canvas=document.createElement('canvas');canvas.className='as3d';host.prepend(canvas);
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance',premultipliedAlpha:true})}catch(e){canvas.remove();throw e}
  renderer.setClearColor(0x000000,0);renderer.toneMapping=THREE.NoToneMapping;renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();
  const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(new RoomEnvironment(),.04).texture;
  const fov=18,D=(H/2)/Math.tan(THREE.MathUtils.degToRad(fov/2));
  const cam=new THREE.PerspectiveCamera(fov,W/H,D*.3,D*3);cam.position.set(0,0,D);cam.layers.enable(BLOOM);
  const S=(x,y)=>new THREE.Vector2(x-W/2,H/2-y);       /* 舞台像素 → 世界坐标（y 向上） */
  const key=new THREE.DirectionalLight(0xdfe6ff,1.2);key.position.set(-.6,.8,1);scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff,.25));

  /* 贴图：原画 + 去饱和压暗版（未解锁） */
  const loadImg=src=>new Promise((r,j)=>{const im=new Image();im.crossOrigin='anonymous';im.onload=()=>r(im);im.onerror=j;im.src=src});
  let tex=null,texLk=null;
  if(o.art){const im=await loadImg(o.art);
    tex=new THREE.Texture(im);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;tex.needsUpdate=true;
    const cv=document.createElement('canvas');cv.width=im.naturalWidth>>1;cv.height=im.naturalHeight>>1;const g=cv.getContext('2d');g.filter='grayscale(.9) brightness(.3) contrast(1.1)';g.drawImage(im,0,0,cv.width,cv.height);
    texLk=new THREE.CanvasTexture(cv);texLk.colorSpace=THREE.SRGBColorSpace}
  /* 玻璃表面的细微起伏（法线贴图，程序生成），让透射层产生轻微折射 */
  const nmap=(()=>{const n=256,cv=document.createElement('canvas');cv.width=cv.height=n;const g=cv.getContext('2d');const id=g.createImageData(n,n);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){const a=Math.sin(x*.07+Math.sin(y*.05)*2)*.5+Math.sin((x+y)*.031)*.5;const b=Math.cos(y*.06+Math.sin(x*.04)*2)*.5;const i=(y*n+x)*4;
      id.data[i]=128+a*40;id.data[i+1]=128+b*40;id.data[i+2]=255;id.data[i+3]=255}g.putImageData(id,0,0);const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,3);return t})();

  const DEPTH=22,group=new THREE.Group();scene.add(group);group.scale.setScalar(.95);
  const shards=[];
  o.polys.forEach((poly,i)=>{
    const c=poly.reduce((a,p)=>[a[0]+p[0]/poly.length,a[1]+p[1]/poly.length],[0,0]);
    const shape=new THREE.Shape(poly.map(p=>S(p[0],p[1]).sub(S(c[0],c[1]))));
    const geo=new THREE.ExtrudeGeometry(shape,{depth:DEPTH,bevelEnabled:true,bevelThickness:2.5,bevelSize:2.5,bevelSegments:2,curveSegments:1});
    /* UV：按舞台坐标映射到原画的显示区域，所以六块合起来仍是一张完整的人 */
    const pos=geo.attributes.position,uv=geo.attributes.uv;const cw=S(c[0],c[1]);const RO=[[-7,4],[6,-3],[-4,-6],[8,5],[-6,7],[5,-7]][i],RS=1+[.006,-.004,.008,-.006,.005,-.007][i];
    for(let k=0;k<pos.count;k++){const sx=pos.getX(k)+cw.x+W/2,sy=H/2-(pos.getY(k)+cw.y);const qx=c[0]+(sx-c[0])*RS+RO[0],qy=c[1]+(sy-c[1])*RS+RO[1];uv.setXY(k,(qx-o.img.x)/o.img.w,1-(qy-o.img.y)/o.img.h)}
    const lk=!o.unlocked[i];
    const cap=new THREE.MeshPhysicalMaterial({color:tex?0x101218:0x1a2142,map:null,emissive:0xffffff,emissiveMap:lk?texLk:tex,emissiveIntensity:tex?(lk?.9:1):0,
      roughness:.35,metalness:0,clearcoat:.5,clearcoatRoughness:.08,envMapIntensity:.12,specularIntensity:.25});
    if(!tex){cap.emissive.set(0x1a2142);cap.emissiveIntensity=1}
    const side=new THREE.MeshPhysicalMaterial({color:0xeaf0ff,emissive:0xbcd0ff,emissiveIntensity:lk?.25:.9,roughness:.08,metalness:.1,envMapIntensity:1.4,transparent:true,opacity:.92});
    const mesh=new THREE.Mesh(geo,[cap,side]);
    /* 透射玻璃层 */
    const plate=sheen(shape,i,lk);
    plate.position.z=DEPTH+3.2;const hair=glowStrip(shape.getPoints(),7,0x1a2350);hair.material.blending=THREE.NormalBlending;hair.material.fragmentShader='uniform float uA;uniform float uT;uniform vec3 uC;varying float vS;void main(){float a=exp(-vS*vS*6.)*.55;gl_FragColor=vec4(uC,a);}';hair.position.z=DEPTH+3.4;const rim=rimStrip(shape.getPoints(),5);rim.position.z=DEPTH+3.6;rim.material.uniforms.uA.value=lk?.35:1;
    /* 选中描边（泛光层） */
    const edge=glowStrip(shape.getPoints(),12,0x5f88ff);edge.position.z=DEPTH+4;edge.material.uniforms.uA.value=0;edge.layers.set(BLOOM);
    const holder=new THREE.Group();holder.add(mesh,hair,plate,rim,edge);holder.position.set(cw.x,cw.y,0);group.add(holder);
    shards.push({holder,mesh,cap,side,edge,plate,rim,lift:0,phase:i*1.7,lk,ult:i===5&&!lk})});

  /* 裂缝：沿碎片接缝的发光带，流光沿边移动（泛光层），放在缝隙中间深度 */
  const crack=(()=>{const segs=[];o.polys.forEach(p=>p.forEach((a,k)=>segs.push([a,p[(k+1)%p.length]])));
    const pts=[],u=[],side=[];let acc=0;
    for(const [a,b] of segs){const A=S(a[0],a[1]),B=S(b[0],b[1]);const d=B.clone().sub(A);const L=d.length();const n=new THREE.Vector2(-d.y,d.x).normalize().multiplyScalar(11);
      const q=[A.clone().add(n),A.clone().sub(n),B.clone().add(n),B.clone().sub(n)];
      [[0,1,2],[2,1,3]].forEach(t=>t.forEach(j=>{pts.push(q[j].x,q[j].y,DEPTH+6);u.push((acc+(j>1?L:0))/900);side.push(j%2?-1:1)}));acc+=L}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));g.setAttribute('u',new THREE.Float32BufferAttribute(u,1));g.setAttribute('s',new THREE.Float32BufferAttribute(side,1));
    const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{uT:{value:0}},
      vertexShader:'attribute float u;attribute float s;varying float vU;varying float vS;void main(){vU=u;vS=s;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform float uT;varying float vU;varying float vS;void main(){float a=abs(vS);float core=exp(-a*a*28.)*1.1+exp(-a*4.)*.28;float f=fract(vU*1.3-uT*.12);float flow=smoothstep(.0,.08,f)*smoothstep(.22,.08,f);vec3 c=mix(vec3(.45,.6,1.),vec3(.9,.95,1.),flow);float i=(.6+1.6*flow)*core;gl_FragColor=vec4(c*i,clamp(i,0.,1.)*.8);}'});
    const mesh=new THREE.Mesh(g,m);mesh.layers.set(BLOOM);group.add(mesh);return m})();

  /* 光尘 / 花瓣 */
  const dust=(()=>{const N=140,p=new Float32Array(N*3),sz=new Float32Array(N),ph=new Float32Array(N);
    for(let i=0;i<N;i++){p[i*3]=(Math.random()-.5)*W*.75;p[i*3+1]=(Math.random()-.5)*H;p[i*3+2]=Math.random()*160-20;sz[i]=Math.random()<.22?16+Math.random()*16:2+Math.random()*4;ph[i]=Math.random()*6.28}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('sz',new THREE.BufferAttribute(sz,1));g.setAttribute('ph',new THREE.BufferAttribute(ph,1));
    const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uT:{value:0},uH:{value:H},uK:{value:1}},
      vertexShader:'attribute float sz;attribute float ph;uniform float uT;uniform float uH;uniform float uK;varying float vA;varying float vP;void main(){vec3 q=position;q.y=mod(q.y+uT*(10.+sz*.8)+uH*.5,uH)-uH*.5;q.x+=sin(uT*.4+ph)*18.;vA=pow(.5+.5*sin(uT*(1.2+fract(ph)*2.)+ph*3.),3.);vP=step(10.,sz);vec4 mv=modelViewMatrix*vec4(q,1.);gl_PointSize=sz*uK;gl_Position=projectionMatrix*mv;}',
      fragmentShader:'varying float vA;varying float vP;void main(){vec2 c=gl_PointCoord-.5;float a;if(vP>.5){vec2 q=abs(c);a=exp(-q.x*40.)*exp(-q.y*5.)+exp(-q.y*40.)*exp(-q.x*5.)+exp(-dot(c,c)*90.);}else a=smoothstep(.5,.0,length(c));float k=min(a,1.)*vA;gl_FragColor=vec4(mix(vec3(.65,.78,1.),vec3(1.),vP)*k,k*.7);}'});
    const pts=new THREE.Points(g,m);pts.layers.set(BLOOM);scene.add(pts);return m})();

  /* 选择性泛光：只有 BLOOM 层参与，最后加回主画面；保留透明背景 */
  const bloomC=new EffectComposer(renderer);bloomC.renderToScreen=false;
  const bloomRender=new RenderPass(scene,cam);bloomRender.clearAlpha=0;bloomC.addPass(bloomRender);
  const bloom=new UnrealBloomPass(new THREE.Vector2(W,H),.7,.45,0);bloomC.addPass(bloom);
  const finalC=new EffectComposer(renderer);const mainRender=new RenderPass(scene,cam);mainRender.clearAlpha=0;finalC.addPass(mainRender);
  const mix=new ShaderPass(new THREE.ShaderMaterial({uniforms:{tDiffuse:{value:null},tBloom:{value:bloomC.renderTarget2.texture}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform sampler2D tDiffuse;uniform sampler2D tBloom;varying vec2 vUv;void main(){vec4 b=texture2D(tDiffuse,vUv);vec3 g=texture2D(tBloom,vUv).rgb;float l=clamp(max(g.r,max(g.g,g.b)),0.,1.);gl_FragColor=vec4(b.rgb+g,clamp(b.a+l,0.,1.));}'}),'tDiffuse');
  finalC.addPass(mix);finalC.addPass(new OutputPass());

  let k=1;function resize(){const r=host.getBoundingClientRect();const dpr=Math.min(devicePixelRatio||1,1.5);
    const px=Math.max(1,r.width*dpr),py=Math.max(1,r.height*dpr);const cap=Math.min(1,Math.sqrt(2.4e6/(px*py)));
    renderer.setPixelRatio(dpr*cap);renderer.setSize(r.width,r.height,false);bloomC.setSize(r.width,r.height);finalC.setSize(r.width,r.height);
    bloomC.setPixelRatio&&bloomC.setPixelRatio(dpr*cap*.5);k=r.width/W*dpr*cap;dust.uniforms.uK.value=k;canvas.style.width='100%';canvas.style.height='100%'}
  const ro=new ResizeObserver(resize);ro.observe(host);resize();

  /* 鼠标视差 */
  const mouse={x:0,y:0,tx:0,ty:0};
  const onMove=e=>{const r=host.getBoundingClientRect();mouse.tx=((e.clientX-r.left)/r.width-.5)*2;mouse.ty=((e.clientY-r.top)/r.height-.5)*2};
  addEventListener('pointermove',onMove,{passive:true});

  let sel=o.sel??-1,pulse=-9,raf=0,running=false,t0=performance.now(),last=t0,frames=0,slow=0;const api={};
  function frame(now){raf=0;if(!running)return;const t=(now-t0)/1000,dt=Math.min(.05,(now-last)/1000);last=now;
    mouse.x+=(mouse.tx-mouse.x)*.06;mouse.y+=(mouse.ty-mouse.y)*.06;
    group.rotation.y=-.07+mouse.x*.05;group.rotation.x=.035+mouse.y*.03;
    const pu=Math.max(0,1-(t-pulse)/.8);
    shards.forEach((s,i)=>{const on=i===sel;s.lift+=((on?70:0)-s.lift)*.12;
      s.holder.position.z=s.lift+Math.sin(t*.8+s.phase)*3;s.holder.rotation.x=Math.sin(t*.5+s.phase)*.012;s.holder.rotation.y=Math.cos(t*.43+s.phase)*.014;
      const sc=1+s.lift/70*.02;s.holder.scale.setScalar(sc);
      s.side.emissiveIntensity=(s.lk?.25:s.ult?1.1+.3*Math.sin(t*1.6):.9)+(on?.6+pu*1.5:0);s.side.emissive.setHex(on?0x9fbaff:0xbcd0ff);s.plate.material.uniforms.uT.value=t;s.plate.material.uniforms.uOn.value+=((on?1:0)-s.plate.material.uniforms.uOn.value)*.15;s.rim.material.uniforms.uA.value=(s.lk?.35:s.ult?1.25+.25*Math.sin(t*1.6):1)+(on?.5+pu*1.5:0);
      s.edge.material.uniforms.uA.value+=(((on?1.15:0)+(on?pu*2:0))-s.edge.material.uniforms.uA.value)*.2;s.edge.material.uniforms.uT.value=t;
      if(tex)s.cap.emissive.setRGB(1-(on?.1:0),1-(on?.05:0),1);s.cap.emissiveIntensity=tex?((s.lk?.9:1)+(on?.08+pu*.25:0)):1});
    crack.uniforms.uT.value=t;dust.uniforms.uT.value=t;
    if(useBloom){cam.layers.set(BLOOM);bloomC.render(dt);cam.layers.enableAll();finalC.render(dt)}else renderer.render(scene,cam);
    frames++;if(dt>1/40)slow++;if(frames===120&&slow>70&&api.onSlow)api.onSlow();
    raf=requestAnimationFrame(frame)}
  api.start=()=>{if(running)return;running=true;last=performance.now();raf=requestAnimationFrame(frame)};
  api.stop=()=>{running=false;if(raf)cancelAnimationFrame(raf);raf=0};
  api.dbg=()=>({sel,running,frames,lift:shards.map(s=>+s.lift.toFixed(1)),uA:shards.map(s=>+s.edge.material.uniforms.uA.value.toFixed(2))});api.select=i=>{sel=i;pulse=(performance.now()-t0)/1000};
  api.renderOnce=()=>{cam.layers.set(BLOOM);bloomC.render(.016);cam.layers.enableAll();finalC.render(.016)};
  api.destroy=()=>{api.stop();ro.disconnect();removeEventListener('pointermove',onMove);renderer.dispose();scene.traverse(x=>{x.geometry&&x.geometry.dispose();(Array.isArray(x.material)?x.material:[x.material]).forEach(m=>m&&m.dispose&&m.dispose())});canvas.remove()};
  return api}

/* 沿多边形的柔和发光描边（用于选中） */
function glowStrip(pts,w,color){const P=[],S=[];const n=pts.length;
  for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n];const d=b.clone().sub(a);const nn=new THREE.Vector2(-d.y,d.x).normalize().multiplyScalar(w);
    const q=[a.clone().add(nn),a.clone().sub(nn),b.clone().add(nn),b.clone().sub(nn)];[[0,1,2],[2,1,3]].forEach(t=>t.forEach(j=>{P.push(q[j].x,q[j].y,0);S.push(j%2?-1:1)}))}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('s',new THREE.Float32BufferAttribute(S,1));
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{uA:{value:0},uT:{value:0},uC:{value:new THREE.Color(color)}},
    vertexShader:'attribute float s;varying float vS;void main(){vS=s;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform float uA;uniform float uT;uniform vec3 uC;varying float vS;void main(){float c=pow(1.-abs(vS),2.);float i=c*uA*(.85+.15*sin(uT*3.));gl_FragColor=vec4(uC*i,clamp(i,0.,1.));}'});
  return new THREE.Mesh(g,m)}

/* 碎片外缘：亮白锐利描边 + 两侧彩虹色散（青 / 品红错位） */
function rimStrip(pts,w){const m=glowStrip(pts,w,0xffffff);m.material.fragmentShader='uniform float uA;uniform float uT;uniform vec3 uC;varying float vS;void main(){float wh=exp(-vS*vS*45.)*1.15;vec3 c=vec3(1.)*wh*uA;gl_FragColor=vec4(c,clamp(c.r,0.,1.));}';return m}
/* 玻璃表面：斜向渐变反光 + 周期流光 + 内部细小星光（叠加） */
function sheen(shape,i,lk){const g=new THREE.ShapeGeometry(shape);g.computeBoundingBox();const bb=g.boundingBox;
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{uT:{value:0},uOn:{value:0},uLk:{value:lk?1:0},uPh:{value:i*1.37},uMin:{value:new THREE.Vector2(bb.min.x,bb.min.y)},uSize:{value:new THREE.Vector2(bb.max.x-bb.min.x,bb.max.y-bb.min.y)}},
    vertexShader:'varying vec2 vL;varying vec2 vW;uniform vec2 uMin;uniform vec2 uSize;void main(){vL=(position.xy-uMin)/uSize;vec4 w=modelMatrix*vec4(position,1.);vW=w.xy;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader:`uniform float uT;uniform float uOn;uniform float uLk;uniform float uPh;varying vec2 vL;varying vec2 vW;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        float diag=vL.x*.65+(1.-vL.y)*.35;
        float refl=smoothstep(.55,.0,diag)*.10;                       /* 左上角大面积反光 */
        float band=exp(-pow((vL.x-vL.y*.55-.18)*9.,2.))*.08;           /* 固定的一道斜向高光 */
        float sw=fract(uT*.11+uPh*.07)*3.2-1.;                         /* 流光：整组从左到右扫过 */
        float sweep=exp(-pow((vW.x/1100.+vW.y/2600.)-sw,2.)*260.)*.55;
        vec2 cell=floor(vW/26.);float r=h(cell);vec2 f=fract(vW/26.)-.5;
        float tw=pow(max(0.,sin(uT*(1.5+r*3.)+r*40.)),24.);
        float star=(r>.93?1.:0.)*tw*(exp(-abs(f.x)*30.)*exp(-abs(f.y)*6.)+exp(-abs(f.y)*30.)*exp(-abs(f.x)*6.))*.9;
        float edgeShade=0.;
        vec3 c=vec3(.85,.9,1.)*(refl+band)+vec3(1.)*sweep+vec3(.85,.92,1.)*star+vec3(.25,.4,1.)*uOn*.12;
        c*=mix(1.,.35,uLk);
        gl_FragColor=vec4(c,clamp(max(c.r,max(c.g,c.b)),0.,1.));}`});
  return new THREE.Mesh(g,m)}
