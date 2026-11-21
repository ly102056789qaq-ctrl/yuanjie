import { _decorator, Animation, Component, instantiate, Node, UIOpacity, Vec3 } from 'cc';
import { FxPlayer } from './FxPlayer';
import { StageApi } from './StageApi';
const { ccclass, property } = _decorator;

/* 演出导演：挂在 CameraRig 上，和镜头动画剪辑放在同一个节点。
   剪辑里的“事件帧”调用这里的方法（参数都是字符串，方便在动画编辑器里直接填）：
     fx(特效名, 目标节点路径, 高度偏移, 缩放)   在目标脚下/身上放一个特效
     act(角色节点路径, 动作剪辑名)             让角色播一个动作
     shake(幅度, 时长)                         镜头震动
   特效模板在 fxLibrary 下，按节点名查找。 */
@ccclass('CutsceneDirector')
export class CutsceneDirector extends Component {
    @property(Node) fxLibrary: Node | null = null;
    @property(Node) fxLayer: Node | null = null;
    @property playOnStart = '';
    @property loopDelay = 2.5;

    private shakeTime = 0;
    private shakeDur = 0;
    private shakeAmp = 0;
    private shakeOffset = new Vec3();

    private busy = false;
    private api: StageApi | null = null;

    start() {
        // 网页接口：外层 HUD 通过 window.yjBattle 触发演出；演出开始/结束时回调 window.yjOnCutscene(true/false)
        // 场景里保存的演出节点可能停在编辑器预览的某一帧（插画亮着、镜头在特写）：把每段演出采样回第 0 帧
        const ui = this.node.getChildByName('UI');
        if (ui) for (const n of ui.children) { const op = n.getComponent(UIOpacity); if (op) op.opacity = 0; }
        // 战斗表现接口（act / hit / fx / screenPos …）见 StageApi；演出相关的留在这里
        const w = window as any;
        const api = new StageApi(this);
        this.api = api;
        w.yjBattle = {
            ready: true,
            playCutscene: (name: string) => this.playCutscene(name),
            cutsceneLength: (name: string) => { const st = this.getComponent(Animation)?.getState(name); return st ? st.duration : 0; },
            act: (n: string, clip: string) => api.act(n, clip),
            hit: (n: string, hex?: string, heavy?: boolean) => api.hit(n, hex, heavy),
            flash: (n: string, hex?: string, k?: number, dur?: number) => api.flash(n, hex, k, dur),
            fx: (name: string, n: string, h?: number, scale?: number, loopKey?: string, tint?: string) => api.fx(name, n, h, scale, loopKey, tint),
            stopLoop: (key: string) => api.stopLoop(key),
            preload: (names: string[]) => api.preload(names),
            shake: (amp = 0.08, dur = 0.35) => this.shake(String(amp), String(dur)),
            hitstop: (sec?: number) => api.hitstop(sec),
            screenPos: (n: string, h?: number) => api.screenPos(n, h),
            target: (n: string, hex?: string) => api.target(n, hex),
            select: (names: string[], hex?: string) => api.select(names, hex),
            shot: (kind: string, n?: string, dur?: number) => api.shot(kind, n, dur),
            hideTarget: () => api.hideTarget(),
            die: (n: string) => api.die(n),
            reset: () => api.reset(),
            get fxReady() { return api.fxReady; },
        };
        try { window.parent && (window.parent as any).yjOnBattleReady && (window.parent as any).yjOnBattleReady(); } catch (e) { /* 跨域时忽略 */ }
        if (this.playOnStart) this.scheduleOnce(() => this.playCutscene(this.playOnStart), 1.2);
    }

    private notify(on: boolean) {
        const targets = [window as any];
        try { if (window.parent !== window) targets.push(window.parent as any); } catch (e) { /* 跨域时忽略 */ }
        for (const t of targets) { try { t.yjOnCutscene && t.yjOnCutscene(on); } catch (e) { /* 忽略 */ } }
    }

    playCutscene(name: string) {
        const anim = this.getComponent(Animation);
        if (!anim || this.busy) return;
        const st = anim.getState(name);
        if (!st) return;
        this.busy = true;
        this.notify(true);
        anim.play(name);
        this.scheduleOnce(() => {
            this.busy = false;
            this.notify(false);
            if (this.loopDelay > 0 && this.playOnStart) this.scheduleOnce(() => this.playCutscene(name), this.loopDelay);
        }, st.duration);
    }

    private find(path: string): Node | null {
        const scene = this.node.scene;
        if (!scene || !path) return null;
        let n: Node | null = scene;
        for (const part of path.split('/')) { n = n ? n.getChildByName(part) : null; }
        return n;
    }

    fx(name: string, target: string, offsetY = '0', scale = '1') {
        const tpl = this.fxLibrary?.getChildByName(name);
        const at = this.find(target);
        if (!tpl || !at) { console.warn('[Cutscene] 找不到特效或目标', name, target); return; }
        const n = instantiate(tpl);
        n.parent = this.fxLayer || this.node.scene;
        const p = at.worldPosition.clone();
        p.y += parseFloat(offsetY) || 0;
        n.setWorldPosition(p);
        const s = (parseFloat(scale) || 1) * tpl.scale.x;
        n.setScale(s, s, s);
        n.active = true;
        n.getComponentInChildren(FxPlayer)?.play();
    }

    act(actorPath: string, clip: string) {
        const a = this.find(actorPath)?.getComponent(Animation);
        if (!a) return;
        a.crossFade(clip, 0.08);
        const st = a.getState(clip);
        if (st && clip !== 'idle') this.scheduleOnce(() => a.crossFade('idle', 0.25), st.duration);
    }

    shake(amp = '0.08', dur = '0.35') {
        this.shakeAmp = parseFloat(amp) || 0.08;
        this.shakeDur = parseFloat(dur) || 0.35;
        this.shakeTime = 0;
    }

    lateUpdate(dt: number) {
        // 震动加在 CameraRig 自身（动画只驱动子节点 Main Camera），两者互不覆盖
        if (this.shakeTime < this.shakeDur) {
            this.shakeTime += dt;
            const k = Math.max(0, 1 - this.shakeTime / this.shakeDur);
            this.shakeOffset.set((Math.random() * 2 - 1) * this.shakeAmp * k, (Math.random() * 2 - 1) * this.shakeAmp * k, 0);
            this.node.setPosition(this.shakeOffset);
        } else if (this.shakeOffset.lengthSqr() > 0) {
            this.shakeOffset.set(0, 0, 0);
            this.node.setPosition(this.shakeOffset);
        }
    }
}
