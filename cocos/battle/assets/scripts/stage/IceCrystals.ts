import { _decorator, CCObject, Component, Material, MeshRenderer, Node, Vec3, utils, primitives, Mesh } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

/* 近景漂浮冰晶：移植自旧版 scene3d.js。按种子生成，编辑器里也会显示和转动。
   数量、种子、分布半径都能在属性检查器里改。 */
function mulberry(seed: number) {
    return () => {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

/* 八面体，每个面独立顶点，做出平直着色 */
function octahedron(): Mesh {
    const v = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    const faces = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]];
    const positions: number[] = [], normals: number[] = [], indices: number[] = [];
    for (const f of faces) {
        const [a, b, c] = f.map(i => new Vec3(v[i][0], v[i][1], v[i][2]));
        const n = new Vec3();
        Vec3.cross(n, Vec3.subtract(new Vec3(), b, a), Vec3.subtract(new Vec3(), c, a)).normalize();
        for (const p of [a, b, c]) { positions.push(p.x, p.y, p.z); normals.push(n.x, n.y, n.z); indices.push(indices.length); }
    }
    const geo: primitives.IGeometry = { positions, normals, indices, minPos: new Vec3(-1, -1, -1), maxPos: new Vec3(1, 1, 1) };
    return utils.MeshUtils.createMesh(geo);
}

interface Crystal { node: Node; spin: number; bob: number; baseY: number; }

@ccclass('IceCrystals')
@executeInEditMode
export class IceCrystals extends Component {
    @property(Material) material: Material | null = null;
    @property count = 5;
    @property seed = 21;
    @property innerRadius = 5.4;
    @property radiusSpread = 1.8;
    @property depthSquash = 0.65;

    private crystals: Crystal[] = [];
    private clock = 0;

    onEnable() { this.rebuild(); }
    onDisable() { this.clear(); }

    clear() {
        for (const c of this.crystals) c.node.destroy();
        this.crystals = [];
    }

    rebuild() {
        this.clear();
        const mesh = octahedron();
        const rnd = mulberry(this.seed);
        for (let i = 0; i < this.count; i++) {
            const n = new Node('crystal');
            n.layer = this.node.layer;
            n.parent = this.node;
            // 运行时生成的节点不存进场景文件，避免和组件重复
            n.hideFlags |= CCObject.Flags.DontSave | CCObject.Flags.HideInHierarchy;
            const mr = n.addComponent(MeshRenderer);
            mr.mesh = mesh;
            if (this.material) mr.setMaterial(this.material, 0);
            const ang = rnd() * Math.PI * 2;
            const rad = this.innerRadius + rnd() * this.radiusSpread;
            n.setPosition(Math.cos(ang) * rad, 0.45 + rnd() * 1.5, Math.sin(ang) * rad * this.depthSquash);
            const s = 0.08 + rnd() * 0.12;
            n.setScale(s, s * (1.2 + rnd()), s);
            n.setRotationFromEuler(rnd() * 57.3, rnd() * 57.3, rnd() * 57.3);
            this.crystals.push({ node: n, spin: (0.2 + rnd() * 0.4) * (rnd() < 0.5 ? 1 : -1), bob: 0.4 + rnd() * 0.8, baseY: n.position.y });
        }
    }

    update(dt: number) {
        this.clock += dt;
        for (const c of this.crystals) {
            const e = c.node.eulerAngles;
            c.node.setRotationFromEuler(e.x + c.spin * 0.4 * dt * 57.3, e.y + c.spin * dt * 57.3, e.z);
            const p = c.node.position;
            c.node.setPosition(p.x, c.baseY + Math.sin(this.clock * c.bob) * 0.08, p.z);
        }
    }
}
