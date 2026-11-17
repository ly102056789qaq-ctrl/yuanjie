/* 行动序列（行动值 AV 模型，借鉴 hsr-tools / starrail-sdk 的公式）：
   每个单位有一条长度 = trackLength 的行动条；剩余距离 ÷ 速度 = 距离下次行动的行动值。
   行动提前 X% = 减少 trackLength×X 的距离；延后 = 增加距离。轮次边界按行动值切分。 */
export class Timeline {
  constructor(rules) {
    this.L = rules.trackLength; this.firstRound = rules.firstRoundAV; this.roundAV = rules.roundAV;
    this.av = 0; this.round = 1; this.roundEnd = this.firstRound; this.units = new Map();
  }
  add(unit) { this.units.set(unit.id, { unit, dist: this.L }); }
  remove(id) { this.units.delete(id); }
  speed(u) { return Math.max(1, u.stats.spd); }
  avOf(id) { const t = this.units.get(id); return t ? t.dist / this.speed(t.unit) : Infinity; }
  advance(id, pct) { const t = this.units.get(id); if (t) t.dist = Math.max(0, t.dist - this.L * pct); }
  delay(id, pct) { const t = this.units.get(id); if (t) t.dist = t.dist + this.L * pct; }
  order() { return [...this.units.values()].filter(t => t.unit.alive).sort((a, b) => a.dist / this.speed(a.unit) - b.dist / this.speed(b.unit)).map(t => t.unit); }
  /* 取下一个行动者；返回 {unit, roundsEnded}，跨过的轮次边界由 Battle 统一结算 */
  next() {
    const u = this.order()[0]; if (!u) return null;
    const dt = this.avOf(u.id); const target = this.av + dt; let roundsEnded = 0;
    while (target >= this.roundEnd) { roundsEnded++; this.round++; this.roundEnd += this.roundAV; }
    this.av = target;
    for (const t of this.units.values()) if (t.unit.alive) t.dist = Math.max(0, t.dist - dt * this.speed(t.unit));
    return { unit: u, roundsEnded };
  }
  resetAfterTurn(id) { const t = this.units.get(id); if (t) t.dist = this.L; }
}
