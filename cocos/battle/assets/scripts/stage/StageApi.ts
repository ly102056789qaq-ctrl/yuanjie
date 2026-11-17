import { Animation, Camera, Color, MeshRenderer, Quat, director, EffectAsset, ImageAsset, instantiate, JsonAsset, Material, Node, rect, RenderRoot2D, resources, Sprite, SpriteFrame, Texture2D, tween, UITransform, Vec3 } from 'cc';
import { FaceCamera } from './FaceCamera';
import { FxPlayer } from './FxPlayer';

/* 战斗表现接口：HUD 层（网页）按战斗事件调用这里，Cocos 只管“怎么演”，不知道任何规则。
   由 CutsceneDirector 创建并挂到 window.yjBattle 上。角色用节点名称呼（Actors 下的 Ally_Rin、Enemy_A 等）。
   运行时特效来自 resources/fx 的图集（cocos/tools/pack_fx.py 生成），FxLibrary 里已有的模板优先。 */

type SheetInfo = { cols: number; rows: number; frames: number; fw: number; fh: number; fps: number; loop: boolean; size: number; aspect: number; anchor: [number, number] };

export interface Host {
    node: Node;
    fxLibrary: Node | null;
    fxLayer: Node | null;
    shake(amp: string, dur: string): void;
}

export class StageApi {
    private actors: Node | null;
    private camera: Camera | null;
    private flashEffect: EffectAsset | null = null;
    private flashMats = new Map<string, Material[]>();
    private sheets: Record<string, SheetInfo> = {};
    private sheetFrames = new Map<string, Promise<SpriteFrame[]>>();
    private loops = new Map<string, Node>();
    private home = new Map<string, Vec3>();
    private bodyHome = new Map<string, Vec3>();
    private shadowScale = new Map<string, Vec3>();
    private addMat: Material | null = null;
    private stopTimer: any = null;

    constructor(private host: Host) {
        const scene = host.node.scene;
        this.actors = scene.getChildByName('Actors');
        this.camera = scene.getComponentInChildren(Camera);
        for (const a of this.actors ? this.actors.children : []) {
            this.home.set(a.name, a.position.clone());
            const body = a.getChildByName('Body'), sh = a.getChildByName('Shadow');
            if (body) this.bodyHome.set(a.name, body.position.clone());
            if (sh) this.shadowScale.set(a.name, sh.scale.clone());
        }
        const tpl = host.fxLibrary?.children[0]?.getComponentInChildren(Sprite);
        this.addMat = tpl ? tpl.customMaterial : null;
        resources.load('effects/yj-sprite-flash', EffectAsset, (err, fx) => { if (!err) { this.flashEffect = fx; this.installFlash(); } else console.warn('[Stage] 闪白材质加载失败', err); });
        resources.load('fx/index', JsonAsset, (err, j) => { if (!err) this.sheets = j.json as any; });
    }

    private actor(name: string): Node | null { return this.actors ? this.actors.getChildByName(name) : null; }

    /* 给每个角色的所有图层换上带 flashColor 的材质（每个角色一份实例，同角色的图层一起闪） */
    private installFlash() {
        if (!this.flashEffect || !this.actors) return;
        for (const a of this.actors.children) {
            const body = a.getChildByName('Body');
            if (!body) continue;
            const mats: Material[] = [];
            for (const sp of body.getComponentsInChildren(Sprite)) {
                const m = new Material();
                m.initialize({ effectAsset: this.flashEffect });
                sp.customMaterial = m;
                mats.push(sp.getMaterialInstance(0)!);
            }
            this.flashMats.set(a.name, mats);
        }
    }

    private setFlash(name: string, c: Color, k: number) {
        const v = new Color(c.r, c.g, c.b, Math.round(Math.max(0, Math.min(1, k)) * 255));
        for (const m of this.flashMats.get(name) || []) m.setProperty('flashColor', v);
    }

    /* 闪一下：颜色 hex，峰值 k，时长 dur 秒（先满后衰减） */
    flash(name: string, hex = '#ffffff', k = 0.85, dur = 0.22) {
        const c = new Color().fromHEX(hex);
        const s = { k };
        this.flashing.set(name, (this.flashing.get(name) || 0) + 1);
        this.setFlash(name, c, k);
        tween(s).to(dur, { k: 0 }, { easing: 'quadOut', onUpdate: () => this.setFlash(name, c, s.k) })
            .call(() => this.flashing.set(name, Math.max(0, (this.flashing.get(name) || 1) - 1))).start();
    }

    /* 选中高亮：被选中的角色身上一层呼吸式的柔光（和受击闪光共用 flashColor，受击时让位） */
    private glow = new Map<string, Color>();
    private flashing = new Map<string, number>();
    private glowTimer: any = null;
    select(names: string[], hex = '#bfefff') {
        for (const n of Array.from(this.glow.keys())) if (names.indexOf(n) < 0) this.setFlash(n, Color.WHITE, 0);
        this.glow.clear();
        const c = new Color().fromHEX(hex);
        for (const n of names) this.glow.set(n, c);
        if (!this.glowTimer && names.length) {
            this.glowTimer = setInterval(() => {
                const k = 0.16 + 0.2 * (0.5 + 0.5 * Math.sin(Date.now() / 1000 * 4.2));
                for (const [n, col] of Array.from(this.glow.entries())) if (!this.flashing.get(n)) this.setFlash(n, col, k);
                if (!this.glow.size) { clearInterval(this.glowTimer); this.glowTimer = null; }
            }, 33);
        }
    }

    /* 角色动作：有剪辑就播剪辑；没有（敌人是单张立绘）就用程序动作 */
    act(name: string, clip: string): number {
        const a = this.actor(name);
        if (!a) return 0;
        const anim = a.getComponent(Animation);
        const st = anim && anim.getState(clip);
        if (anim && st) {
            anim.crossFade(clip, 0.08);
            if (clip !== 'idle') setTimeout(() => anim.crossFade('idle', 0.25), st.duration * 1000);
            return st.duration;
        }
        const body = a.getChildByName('Body');
        if (!body) return 0;
        const base = body.position.clone();
        const dir = name.startsWith('Enemy') ? 1 : -1;   // 敌人在画面左边，朝右冲
        if (clip === 'attack') {
            tween(body).to(0.14, { position: new Vec3(base.x - dir * 0.15, base.y, base.z) }, { easing: 'quadOut' })
                .to(0.12, { position: new Vec3(base.x + dir * 0.9, base.y + 0.05, base.z) }, { easing: 'quadIn' })
                .delay(0.18).to(0.35, { position: base }, { easing: 'quadInOut' }).start();
            return 0.8;
        }
        if (clip === 'hit') {
            tween(body).to(0.06, { position: new Vec3(base.x - dir * 0.28, base.y, base.z) }, { easing: 'quadOut' })
                .to(0.08, { position: new Vec3(base.x - dir * 0.2, base.y, base.z) })
                .to(0.3, { position: base }, { easing: 'quadInOut' }).start();
            return 0.45;
        }
        if (clip === 'cast') {
            const s = body.scale.clone();
            tween(body).to(0.25, { scale: new Vec3(s.x * 1.05, s.y * 1.05, s.z) }, { easing: 'quadOut' }).delay(0.3).to(0.3, { scale: s }).start();
            return 0.85;
        }
        return 0;
    }

    /* 受击：闪光 + 后仰击退；heavy 时加震屏 */
    hit(name: string, hex = '#ffffff', heavy = false) {
        this.flash(name, hex, heavy ? 0.75 : 0.55, heavy ? 0.26 : 0.18);
        this.act(name, 'hit');
        if (heavy) this.host.shake('0.12', '0.3');
    }

    /* ───────── 运镜（大招等）：在常态机位、角色特写、越肩看敌人之间切换或缓动 ───────── */
    private camBase: { pos: Vec3; rot: Quat } | null = null;
    private camTween: any = null;
    private camNode(): Node | null { return this.camera ? this.camera.node : null; }
    private pose(pos: Vec3, look: Vec3): { pos: Vec3; rot: Quat } {
        const n = this.camNode()!;
        const keepP = n.position.clone(), keepR = n.rotation.clone();
        n.setPosition(pos); n.lookAt(look);
        const out = { pos: pos.clone(), rot: n.rotation.clone() };
        n.setPosition(keepP); n.setRotation(keepR);
        return out;
    }
    private centroid(side: 'Ally' | 'Enemy'): Vec3 {
        const list = (this.actors ? this.actors.children : []).filter(a => a.name.startsWith(side + '_') && a.getChildByName('Body')?.active !== false);
        const c = new Vec3();
        for (const a of list) c.add(a.worldPosition);
        if (list.length) c.multiplyScalar(1 / list.length);
        return c;
    }
    /* kind: close 角色特写 / low 仰拍特写 / enemies 越过我方肩头看敌人 / base 常态。dur = 0 为硬切 */
    shot(kind: string, actorName = '', dur = 0.6) {
        const n = this.camNode();
        if (!n) return;
        if (!this.camBase) this.camBase = { pos: n.position.clone(), rot: n.rotation.clone() };
        let to = this.camBase;
        const a = this.actor(actorName);
        if (kind !== 'base') {
            const p = a ? a.worldPosition.clone() : this.centroid('Ally');
            const h = a ? this.heightOf(a) : 2.8;
            if (kind === 'close') to = this.pose(new Vec3(p.x + 1.1, p.y + h * 0.68, p.z + 4.4), new Vec3(p.x - 0.35, p.y + h * 0.62, p.z));
            else if (kind === 'low') to = this.pose(new Vec3(p.x - 1.3, p.y + h * 0.3, p.z + 3.6), new Vec3(p.x + 0.2, p.y + h * 0.72, p.z));
            else if (kind === 'enemies') {
                const e = this.centroid('Enemy'), al = this.centroid('Ally');
                to = this.pose(new Vec3(al.x + 0.6, 2.6, al.z + 5.2), new Vec3(e.x + 0.4, 1.5, e.z));
            }
        }
        if (this.camTween) { this.camTween.stop(); this.camTween = null; }
        const fromP = n.position.clone(), fromR = n.rotation.clone();
        if (dur <= 0) { n.setPosition(to.pos); n.setRotation(to.rot); return; }
        const st = { k: 0 }, q = new Quat(), v = new Vec3();
        this.camTween = tween(st).to(dur, { k: 1 }, { easing: 'cubicInOut', onUpdate: () => {
            Vec3.lerp(v, fromP, to.pos, st.k); Quat.slerp(q, fromR, to.rot, st.k);
            n.setPosition(v); n.setRotation(q);
        } }).start();
    }

    /* 顿帧：逻辑停住、画面照常渲染 */
    hitstop(sec = 0.06) {
        if (this.stopTimer) clearTimeout(this.stopTimer);
        director.pause();
        this.stopTimer = setTimeout(() => { this.stopTimer = null; director.resume(); }, sec * 1000);
    }

    /* 角色身上某个高度（0 脚下，1 头顶）在屏幕上的位置，归一化到 0..1，左上为原点 */
    screenPos(name: string, h = 0.6): { x: number; y: number } | null {
        const a = this.actor(name);
        if (!a || !this.camera) return null;
        const p = a.worldPosition.clone();
        p.y += this.heightOf(a) * h;
        const out = new Vec3();
        this.camera.worldToScreen(p, out);
        const cam = this.camera.camera;
        return { x: out.x / cam.width, y: 1 - out.y / cam.height };
    }

    private heights = new Map<string, number>();
    private heightOf(a: Node): number {
        const cached = this.heights.get(a.name);
        if (cached) return cached;
        const h = this.measure(a);
        this.heights.set(a.name, h);
        return h;
    }
    private measure(a: Node): number {
        const body = a.getChildByName('Body');
        if (!body) return 2.5;
        let top = 0;
        for (const ut of body.getComponentsInChildren(UITransform)) {
            const p = ut.node.worldPosition;
            top = Math.max(top, p.y + ut.height * ut.node.worldScale.y * (1 - ut.anchorY));
        }
        return Math.max(0.5, top - a.worldPosition.y);
    }

    /* 选中目标：脚下光环移过去 */
    target(name: string, hex = '#ffffff') {
        const ring = this.actor('TargetRing'), a = this.actor(name);
        if (!ring || !a) return;
        const mr = ring.getComponent(MeshRenderer);
        const m = mr && mr.getMaterialInstance(0);
        if (m) { const c = new Color().fromHEX(hex); c.a = 240; m.setProperty('mainColor', c); }
        const local = new Vec3();
        ring.parent!.inverseTransformPoint(local, a.worldPosition);
        tween(ring).to(0.18, { position: new Vec3(local.x, ring.position.y, local.z) }, { easing: 'quadOut' }).start();
        ring.active = true;
    }
    hideTarget() { const r = this.actor('TargetRing'); if (r) r.active = false; this.select([]); }

    /* 倒下：变暗、下沉、淡出 */
    die(name: string) {
        const a = this.actor(name);
        if (!a) return;
        this.stopLoop(name + ':*');
        this.flash(name, '#ffffff', 0.8, 0.5);
        const body = a.getChildByName('Body');
        if (body) {
            // RenderRoot2D 下 UIOpacity 不往下传，直接逐图层改颜色的 alpha
            const sprites = body.getComponentsInChildren(Sprite);
            const fade = { k: 1 };
            tween(fade).delay(0.25).to(0.9, { k: 0 }, { onUpdate: () => { for (const sp of sprites) { const c = sp.color.clone(); c.a = Math.round(255 * fade.k); sp.color = c; } } })
                .call(() => { body.active = false; }).start();
            const p = body.position.clone();
            tween(body).delay(0.25).to(0.9, { position: new Vec3(p.x, p.y - 0.3, p.z) }, { easing: 'quadIn' }).start();
        }
        const sh = a.getChildByName('Shadow');
        if (sh) tween(sh).delay(0.4).to(0.6, { scale: new Vec3(0, 0, 1) }).start();
    }

    /* 重开一局：所有角色回到原位、恢复显示 */
    reset() {
        this.select([]);
        for (const n of Array.from(this.loops.values())) if (n.isValid) n.destroy();
        this.loops.clear();
        for (const a of this.actors ? this.actors.children : []) {
            const home = this.home.get(a.name);
            if (home) a.setPosition(home);
            const body = a.getChildByName('Body');
            if (body) {
                body.active = true;
                for (const sp of body.getComponentsInChildren(Sprite)) { const c = sp.color.clone(); c.a = 255; sp.color = c; }
                const base = this.bodyHome.get(a.name);
                if (base) body.setPosition(base);
            }
            const sh = a.getChildByName('Shadow');
            const shs = this.shadowScale.get(a.name);
            if (sh && shs) sh.setScale(shs);
            this.setFlash(a.name, Color.WHITE, 0);
        }
        director.resume();
    }

    /* 放特效：在角色脚下往上 h（0..1 身高比例）处；scale 相对图集登记的尺寸 */
    async fx(name: string, actorName: string, h = 0.5, scale = 1, loopKey = ''): Promise<void> {
        const a = this.actor(actorName);
        if (!a) return;
        const p = a.worldPosition.clone();
        p.y += this.heightOf(a) * h;
        const n = await this.spawn(name, scale);
        if (!n) return;
        n.setWorldPosition(p);
        if (loopKey) { this.stopLoop(actorName + ':' + loopKey); this.loops.set(actorName + ':' + loopKey, n); }
    }

    stopLoop(key: string) {
        for (const [k, n] of Array.from(this.loops.entries())) {
            if (k === key || (key.endsWith(':*') && k.startsWith(key.slice(0, -1)))) { if (n.isValid) n.destroy(); this.loops.delete(k); }
        }
    }

    private async spawn(name: string, scale: number): Promise<Node | null> {
        const layer = this.host.fxLayer || this.host.node.scene;
        const tpl = this.host.fxLibrary?.getChildByName(name);
        if (tpl) {
            const n = instantiate(tpl);
            n.parent = layer;
            const s = scale * tpl.scale.x;
            n.setScale(s, s, s);
            n.active = true;
            n.getComponentInChildren(FxPlayer)?.play();
            return n;
        }
        const info = this.sheets[name];
        if (!info) { console.warn('[Stage] 没有这个特效', name); return null; }
        const frames = await this.framesOf(name, info);
        const root = new Node('fx:' + name);
        root.parent = layer;
        root.addComponent(RenderRoot2D);
        root.addComponent(FaceCamera);
        const s = info.size * scale / Math.max(info.fw, info.fh);
        root.setScale(s, s, s);
        const img = new Node('img');
        img.parent = root;
        const ut = img.addComponent(UITransform);
        ut.setContentSize(info.fw, info.fh);
        ut.setAnchorPoint(info.anchor[0], info.anchor[1]);
        const sp = img.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        if (this.addMat) sp.customMaterial = this.addMat;
        const player = img.addComponent(FxPlayer);
        player.frames = frames;
        player.fps = info.fps;
        player.loop = info.loop;
        player.destroyOnEnd = false;
        player.play();
        if (!info.loop) setTimeout(() => { if (root.isValid) root.destroy(); }, frames.length / info.fps * 1000 + 100);
        return root;
    }

    private framesOf(name: string, info: SheetInfo): Promise<SpriteFrame[]> {
        let p = this.sheetFrames.get(name);
        if (!p) {
            p = new Promise(resolve => resources.load('fx/' + name, ImageAsset, (err, img) => {
                if (err) { console.warn('[Stage] 特效图集加载失败', name, err); resolve([]); return; }
                const tex = new Texture2D();
                tex.image = img;
                const out: SpriteFrame[] = [];
                for (let i = 0; i < info.frames; i++) {
                    const f = new SpriteFrame();
                    f.texture = tex;
                    f.rect = rect((i % info.cols) * info.fw, Math.floor(i / info.cols) * info.fh, info.fw, info.fh);
                    out.push(f);
                }
                resolve(out);
            }));
            this.sheetFrames.set(name, p);
        }
        return p;
    }

    /* 预加载，避免第一次放特效时卡一下 */
    preload(names: string[]) { for (const n of names) if (this.sheets[n]) this.framesOf(n, this.sheets[n]); }
    get fxReady() { return Object.keys(this.sheets).length > 0; }
}
