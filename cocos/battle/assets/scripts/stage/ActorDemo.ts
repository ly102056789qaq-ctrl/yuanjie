import { _decorator, Animation, Component } from 'cc';
const { ccclass, property } = _decorator;

/* 预览用：每隔 interval 秒播一次 sequence 指定的动作，播完回到 idle。
   正式战斗接入回合逻辑后，由导演脚本按事件调用，不再需要这个组件。 */
@ccclass('ActorDemo')
export class ActorDemo extends Component {
    @property sequence = 'wave_r';
    @property interval = 4;
    @property firstDelay = 1;

    private anim: Animation | null = null;

    start() {
        this.anim = this.getComponent(Animation);
        if (!this.anim || this.sequence === 'idle') return;
        this.scheduleOnce(() => this.playAction(), this.firstDelay);
    }

    private playAction() {
        if (!this.anim) return;
        this.anim.crossFade(this.sequence, 0.15);
        const state = this.anim.getState(this.sequence);
        const loops = this.sequence === 'wave_r' ? 1 : 1;
        const dur = state ? state.duration * loops : 1;
        this.scheduleOnce(() => {
            this.anim!.crossFade('idle', 0.25);
            this.scheduleOnce(() => this.playAction(), this.interval);
        }, dur);
    }
}
