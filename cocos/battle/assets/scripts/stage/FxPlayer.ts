import { _decorator, Component, Sprite, SpriteFrame } from 'cc';
const { ccclass, property } = _decorator;

/* 序列帧特效。帧图是黑底发光图，材质用叠加混合（见 materials/fx-additive.mtl）。
   放在 FxLibrary 下的节点是模板，导演按名字克隆后播放；模板本身不显示。 */
@ccclass('FxPlayer')
export class FxPlayer extends Component {
    @property([SpriteFrame]) frames: SpriteFrame[] = [];
    @property fps = 30;
    @property loop = false;
    @property destroyOnEnd = true;
    @property playOnStart = false;

    private sprite: Sprite | null = null;
    private time = 0;
    private playing = false;

    onLoad() {
        this.sprite = this.getComponent(Sprite);
        if (this.sprite) this.sprite.enabled = false;
    }

    start() { if (this.playOnStart) this.play(); }

    play() {
        this.time = 0;
        this.playing = true;
        if (this.sprite) { this.sprite.enabled = true; this.sprite.spriteFrame = this.frames[0] || null; }
    }

    update(dt: number) {
        if (!this.playing || !this.sprite || this.frames.length === 0) return;
        this.time += dt;
        let i = Math.floor(this.time * this.fps);
        if (i >= this.frames.length) {
            if (this.loop) { i %= this.frames.length; }
            else {
                this.playing = false;
                this.sprite.enabled = false;
                if (this.destroyOnEnd) this.node.destroy();
                return;
            }
        }
        this.sprite.spriteFrame = this.frames[i];
    }
}
