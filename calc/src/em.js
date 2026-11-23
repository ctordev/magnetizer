// Электромагнетика оснастки: индуктивность (точный суммарный Neumann по круглым нитям)
// и осевое поле соленоида в точке. Испольуются: master.js, coil_len.js.
// Пуск напрямую: node calc/src/em.js — печатает оснастку проекта.
const MU0 = 4 * Math.PI * 1e-7, PI = Math.PI;

// ── эллиптические интегралы (AGM, DLMF 19.8) ──
function KE(k) {
  let an = 1, bn = Math.sqrt(1 - k * k), sum = k * k / 2, p2 = 1;
  for (let i = 0; i < 40; i++) {
    const c = (an - bn) / 2;
    p2 *= 2; sum += p2 * c * c / 2;
    const a1 = (an + bn) / 2; bn = Math.sqrt(an * bn); an = a1;
    if (Math.abs(c) < 1e-16) break;
  }
  const K = PI / 2 / an;
  return [K, K * (1 - sum)];
}
// взаимная индукция двух круглых нитей (CRC 27.5)
function Mloop(a, c, d) {
  const k2 = 4 * a * c / ((a + c) * (a + c) + d * d), k = Math.sqrt(k2);
  const [K, E] = KE(k);
  return MU0 * Math.sqrt(a * c) * ((2 / k - k) * K - (2 / k) * E);
}
// L многослойной однослойно-шаговой намотки: layers=[{R, n, pitch}]
function Lwind(layers, wireR = 0.0028) {
  const loops = [];
  for (const lay of layers) for (let i = 0; i < lay.n; i++)
    loops.push([lay.R, -lay.n * lay.pitch / 2 + (i + 0.5) * lay.pitch]);
  let L = 0;
  for (let i = 0; i < loops.length; i++) {
    L += MU0 * loops[i][0] * (Math.log(8 * loops[i][0] / wireR) - 2);
    for (let j = 0; j < loops.length; j++) if (i !== j) L += Mloop(loops[i][0], loops[j][0], loops[i][1] - loops[j][1]);
  }
  return L;
}
// осевая H от одного витка в точке (r,z)
function HzLoop(a, r, z, I) {
  const d2 = (a + r) * (a + r) + z * z, k2 = 4 * a * r / d2;
  if (k2 >= 1) return I / (2 * a);
  const [K, E] = KE(Math.sqrt(k2));
  return I / (2 * PI * Math.sqrt(d2)) * (K + (a * a - r * r - z * z) / ((a - r) * (a - r) + z * z) * E);
}
// H многослойной намотки в точке (многовитковый ток NI разложен по виткам)
function Hpoint(layers, r, z, NI) {
  const loops = [];
  for (const lay of layers) for (let i = 0; i < lay.n; i++)
    loops.push([lay.R, -lay.n * lay.pitch / 2 + (i + 0.5) * lay.pitch]);
  let s = 0;
  for (const [a, dz] of loops) s += HzLoop(a, r, z - dz, NI / loops.length);
  return s;
}
// средняя H по объему изделия-кольца (rIn..rOut, −t/2..t/2)
function HmagAvg(layers, mag, NI) {
  let s = 0, n = 0;
  for (const rf of [0.2, 0.5, 0.8]) for (const zf of [-0.4, 0, 0.4]) {
    s += Hpoint(layers, mag.rIn + (mag.rOut - mag.rIn) * rf, mag.t * zf, NI); n++;
  }
  return s / n;
}
// эквивалентный «КПД оснастки» η = H·l_изделия / (N·I) — то, что подставляет калькулятор
function etaEff(layers, mag, NI) { return HmagAvg(layers, mag, NI) * mag.t / NI; }

// ── оснастка проекта: 2 слоя по 12 витков, жила 25 мм² (шаг 6,5 мм), ⌀катушки ~100 мм ──
const FIX = {
  pitch: 0.0065,
  layers: [{ R: 0.050, n: 12 }, { R: 0.0568, n: 12 }],
  get turns() { return this.layers.reduce((s, l) => s + l.n, 0); },
  get len() { return Math.max(...this.layers.map(l => l.n)) * this.pitch; },
  get L() { return Lwind(this.layers.map(l => ({ R: l.R, n: l.n, pitch: this.pitch }))); },
};
const MAG = { rIn: 0.025, rOut: 0.040, t: 0.016, HcJ: 1.2e6, k: 3 };   // NdFeB OD80/ID50×16

function variant(layersN, pitch = FIX.pitch, r0 = 0.050, step = 0.0068) {
  const layers = layersN.map((n, i) => ({ R: r0 + i * step, n, pitch }));
  return { layers, n: layersN.reduce((a, b) => a + b, 0), len: Math.max(...layersN) * pitch, L: Lwind(layers) };
}

if (require.main === module) {
  console.log('Оснастка проекта:', FIX.turns, 'витков (2 слоя по 12), длина намотки', (FIX.len * 1000).toFixed(0), 'мм');
  console.log('L (без детали) =', (FIX.L * 1e6).toFixed(1), 'мкГн;  с деталью/ярмом — мерить, для оценки ×1,2…×5');
  const I = 1e3;
  console.log('η оснастки (воздушная) =', etaEff(FIX.layers.map(l => ({ R: l.R, n: l.n, pitch: FIX.pitch })), MAG, FIX.turns * I).toFixed(3),
    ' при N·I =', FIX.turns, 'кА·витков;  H в кольце 16 мм =', Math.round(HmagAvg(FIX.layers.map(l => ({ R: l.R, n: l.n, pitch: FIX.pitch })), MAG, FIX.turns * I) / 1000), 'кА/м');
  console.log('\nДругие варианты намотки (жила 25 мм², шаг 6,5 мм):');
  for (const [name, cfg] of Object.entries({
    '1 слой × 12': [12], '1 слой × 24': [24], '2 слоя 12+12 (проект)': [12, 12],
    '3 слоя 8+8+8': [8, 8, 8], '2 слоя 18+18': [18, 18], '1 слой × 36': [36],
  })) {
    const v = variant(cfg);
    console.log(`  ${name.padEnd(24)} N=${String(v.n).padStart(2)}  ℓ=${(v.len * 1000).toFixed(0).padStart(3)} мм  L=${(v.L * 1e6).toFixed(1).padStart(6)} мкГн`);
  }
}
module.exports = { KE, Mloop, Lwind, HzLoop, Hpoint, HmagAvg, etaEff, variant, FIX, MAG, MU0 };
