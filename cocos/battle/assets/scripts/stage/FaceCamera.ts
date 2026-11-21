import { _decorator, Camera, Component, Node, Quat } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

/* 让 2D 特效面片始终正对镜头（镜头推拉转向时不会看出是一张纸）。 */
@ccclass('FaceCamera')
@executeInEditMode
export class FaceCamera extends Component {
    @property(Node) cameraNode: Node | null = null;

    private static cached: Node | null = null;

    lateUpdate() {
        let cam = this.cameraNode;
        if (!cam) {
            if (!FaceCamera.cached || !FaceCamera.cached.isValid) {
                const c = this.node.scene?.getComponentInChildren(Camera);
                FaceCamera.cached = c ? c.node : null;
            }
            cam = FaceCamera.cached;
        }
        if (!cam) return;
        const q = new Quat();
        cam.getWorldRotation(q);
        this.node.setWorldRotation(q);
    }
}
