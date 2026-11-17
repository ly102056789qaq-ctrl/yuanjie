/* 常态战场的屏幕比例（舞台宽高，原点左上）。来自构图建议，用来反推三维脚点。 */
export const STAGE = {
  fov: 34,
  cam: { x: 0.16, y: 3.55, z: 13.6 },
  look: { x: 0.14, y: 0.62, z: 0 },
  allies: [
    { x: 0.59, y: 0.69, height: 2.42 },
    { x: 0.67, y: 0.61, height: 2.28 },
    { x: 0.75, y: 0.72, height: 2.42 },
    { x: 0.84, y: 0.64, height: 2.28 },
  ],
  enemies: [
    { x: 0.34, y: 0.66, height: 3.15 }, /* 大型敌人，可见高度约 45% */
    { x: 0.24, y: 0.61, height: 2.35 },
  ],
};

export function applyScreenStands(scene, encounter) {
  encounter.allies.forEach((a, i) => {
    const slot = STAGE.allies[i];
    if (!slot) return;
    const p = scene.screenToGround(slot.x, slot.y);
    if (!p) return;
    scene.addStand(a.id, { x: p.x, y: a.stand?.y || 0, z: p.z });
    a.height = slot.height;
  });
  encounter.enemies.forEach((e, i) => {
    const slot = STAGE.enemies[i];
    if (!slot) return;
    const y = e.hover ? (e.stand?.y ?? 0.16) : 0;
    const p = scene.screenToGround(slot.x, slot.y, y);
    if (!p) return;
    scene.addStand(e.id, { x: p.x, y, z: p.z });
    e.height = slot.height;
  });
}
