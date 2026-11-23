// Высота (длина) намотки: L, ток, поле в изделии. Точная индуктивность — по Неumann/эллиптическим
// интегралам (сумма взаимных индукций нитей), поле соленоида — тоже по эллиптическим.
// Пуск: node calc/src/coil_len.js
const MU0 = 4 * Math.PI * 1e-7, PI = Math.PI;
const C = 47e-3, U = 300, N = 24;   // банк 10 × EPCOS B43560-S9478-M1
const MAG = { rIn: 0.025, rOut: 0.040, t: 0.016, HcJ: 1.2e6, k: 3 };   // NdFeB кольцо OD80/ID50×16
const REQ = MAG.HcJ * MAG.k;                                           // 3,6 МА/м до насыщения
const WIRE_R = 0.0026;                                                 // жила 25 мм² ≈ ⌀5,7 мм

function KE(k) {                              // K(k), E(k) через AGM (DLMF 19.8)
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
function Mloop(a, c, d) {                       // взаимная индукция двух круглых нитей
  const k2 = 4 * a * c / ((a + c) * (a + c) + d * d);
  const [K, E] = KE(Math.sqrt(k2));
  const k = Math.sqrt(k2);
  return MU0 * Math.sqrt(a * c) * ((2 / k - k) * K - (2 / k) * E);   // CRC 27.5: M = µ0√(ac)[(2/k−k)K − (2/k)E]
}
function Lsol(R, pitch, n) {
  let L = 0;
  for (let i = 0; i < n; i++) {
    L += MU0 * R * (Math.log(8 * R / WIRE_R) - 2);                        // своя нить + внутренний
    for (let j = i + 1; j < n; j++) L += 2 * Mloop(R, R, (i - j) * pitch);
  }
  return L;
}
function HzLoop(a, r, z, I) {                    // осевая H от витка в точке (r,z)
  const d2 = (a + r) * (a + r) + z * z;
  const k2 = 4 * a * r / d2;
  if (k2 >= 1) return I / (2 * a);
  const [K, E] = KE(Math.sqrt(k2));
  return I / (2 * PI * Math.sqrt(d2)) * (K + (a * a - r * r - z * z) / ((a - r) * (a - r) + z * z) * E);
}
function Hcoil(R, l, r, z, NI) {
  const n = 600; let s = 0;
  for (let i = 0; i < n; i++) s += HzLoop(R, r, z - (-l / 2 + l * (i + .5) / n), NI / n);
  return s;
}
function HmagAvg(R, l, NI) {
  let s = 0, n = 0;
  for (const rf of [0.2, 0.5, 0.8]) for (const zf of [-0.4, 0, 0.4]) {
    s += Hcoil(R, l, MAG.rIn + (MAG.rOut - MAG.rIn) * rf, MAG.t * zf, NI); n++;
  }
  return s / n;
}
function i2t(L, R, C) {                         // действующий i²t за полуволну для RLC≈LC
  const w = 1 / Math.sqrt(L * C), Ipk = U * Math.sqrt(C / L);
  return Ipk * Ipk * PI / 2 / w;
}

const [Kt, Et] = KE(0.5);
if (Math.abs(Kt - 1.6857503548) > 1e-6 || Math.abs(Et - 1.4674622093) > 1e-6) console.log('!! KE selftest', Kt, Et);
console.log('selftest K(0.5)=' + Kt.toFixed(7) + ' E(0.5)=' + Et.toFixed(7) + ' (ожид. 1.6857504 / 1.4674622)\n');
const R = 0.050;
console.log(`А: без ярма. Банк ${(C * 1e3).toFixed(1)} мФ / ${U} В, N=${N}, Rкатушки ${R * 1000} мм, жила 25 мм².`);
console.log(`Требуемое поле: H=${REQ / 1e6} МА/м → МДС по изделию 16 мм = ${(REQ * MAG.t / 1000).toFixed(1)} кА·витков`);
console.log('l,мм | L,мкГн | I,кА | N·I,кА·вит | E,кДж | H_изделие,кА/м | %насыщ | i²t контура,кА²с');
for (const lmm of [24, 40, 60, 80, 100, 110, 150, 200]) {
  const p = lmm / 1000 / N, l = lmm / 1000;
  const L = Lsol(R, p, N);
  const I = U * Math.sqrt(C / L);
  const Hm = HmagAvg(R, l, N * I);
  console.log(`${String(lmm).padStart(4)} | ${(L * 1e6).toFixed(1).padStart(6)} | ${(I / 1e3).toFixed(2).padStart(5)} | ${(N * I / 1e3).toFixed(0).padStart(6)} | ${(0.5 * C * U * U / 1e3).toFixed(2)} | ${Math.round(Hm / 1e3)} | ${Math.round(Hm / REQ * 100)} | ${Math.round(i2t(L, 0, C) / 1e3)}`);
}
console.log('\nОптимум по аналитике: H_оси = N·I / (2·√(R²+(l/2)²)) → максимум при l ≈ 2R = 100 мм.');

console.log('\nБ: с ярмом — МДС работает как последовательная цепь, длина намотки на поле почти не влияет:');
const GAP = 2 * 0.0005;
for (const NI of [40e3, 57.6e3, 80e3, 103e3]) {
  const H = (NI - REQ * 0.4 * GAP) / MAG.t;
  console.log(`  N·I=${(NI / 1e3).toFixed(0)} кА·витков → H в изделии ${(H / 1e3).toFixed(0)} кА/м = ${Math.round(H / REQ * 100)}% насыщения`);
}
console.log('\nЧто даёт L=200 мкГн (значение, записанное в спецификации оснастки):');
for (const [Rr, lmm] of [[0.050, 150], [0.060, 150], [0.050, 110], [0.100, 150], [0.050, 60]]) {
  const L = Lsol(Rr, lmm / 1000 / N, N);
  const I = U * Math.sqrt(C / L);
  console.log(`  R=${Rr * 1000} мм, l=${lmm} мм, N=24 → L=${(L * 1e6).toFixed(1)} мкГн, I=${(I / 1e3).toFixed(1)} кА, N·I=${(N * I / 1e3).toFixed(0)} кА·вит, i²t=${Math.round(i2t(L, 0, C) / 1e3)} кА²с`);
}
let need = null;
for (let Nt = 24; Nt < 200; Nt++) {
  const L = Lsol(0.050, 0.150 / Nt, Nt);
  if (L > 180e-6) { need = [Nt, L]; break; }
}
console.log(`  чтобы получить ~200 мкГн на R=50 мм/l=150 мм нужно N≈${need[0]} витков (L=${(need[1] * 1e6).toFixed(0)} мкГн), а не 24.`);
// ── то же самое честной моделью разряда (затухание, VD6, коммутация, токи по банкам) ──
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/master.js', 'utf8');
const head = src.slice(0, src.indexOf('// ---------- рабочая точка'));
const sc = {};
new Function('require', 'module', head + '\n;this.sim=sim;this.split=split;').call(sc, require, sc);
const sim = sc.sim, splitCan = sc.split;
console.log('\nВ: та же оснастка моделью из master.js (банк 47 мФ / 10×4700 EPCOS / 300 В, R=обмотка 8,5 + шины/тиристор 3,5 + ESR банка 4,0 мОм, VD6, тиристор):');
console.log('l,мм | L,мкГн | I_pk,кА | T/2,мс | коммут.VT1,мс | i²t VD6,кА²с (на диод при 2×) | A на банку ×10 | H_изделие | %насыщ');
for (const lmm of [40, 60, 90, 110, 150, 200]) {
  const l = lmm / 1000, p = l / N;
  const L = Lsol(R, p, N);
  const r = sim(C, U, L, 0.012, N);
  const can = splitCan(r.ipk);
  const Hm = HmagAvg(R, l, N * r.ipk);
  console.log(`${String(lmm).padStart(4)} | ${(L * 1e6).toFixed(1).padStart(6)} | ${(r.ipk / 1e3).toFixed(2).padStart(6)} | ${(r.Thalf * 1e3).toFixed(1).padStart(6)} | ${(r.tc * 1e3).toFixed(1).padStart(9)} | ${Math.round(r.i2tD / 1e3)} (${Math.round(r.i2tD / 1e3 / 2)}) | ${Math.round(can[0].I)} | ${Math.round(Hm / 1e3)} | ${Math.round(Hm / REQ * 100)}%`);
}
console.log('\nИмпульсный ток на банку при однотипном банке — ровно I/10; для EPCOS B43560 (charge-discharge proof) паспортного предела нет, бережём нагрев выводков (см. §3.2).');

// ── Г: допуски по центровке и двухслойная намотка ────────────────────────────
console.log('\nГ1: поле вдоль оси (изделие должно быть в центре), % от максимального:');
for (const lmm of [40, 60, 110, 150]) {
  const l = lmm / 1000, I = U * Math.sqrt(C / Lsol(R, l / N, N));
  const row = [-20, -10, 0, 10, 20].map(z => {
    const h = Hcoil(R, l, (MAG.rIn + MAG.rOut) / 2, z / 1000, N * I);
    return z + 'мм:' + Math.round(h / Hcoil(R, l, (MAG.rIn + MAG.rOut) / 2, 0, N * I) * 100) + '%';
  });
  console.log(`  намотка ${lmm} мм → ${row.join('  ')}`);
}
console.log('\nГ2: та же МДС, но в два слоя (по 12 витков, слои R=50 и R=57 мм) — L растёт, ток падает:');
function Lmulti(layers) {          // layers: [{R, n, pitch}]
  const loops = [];
  for (const lay of layers) for (let i = 0; i < lay.n; i++) loops.push([lay.R, -lay.n * lay.pitch / 2 + (i + .5) * lay.pitch]);
  let L = 0;
  for (let i = 0; i < loops.length; i++) {
    L += MU0 * loops[i][0] * (Math.log(8 * loops[i][0] / WIRE_R) - 2);
    for (let j = 0; j < loops.length; j++) if (i !== j) L += Mloop(loops[i][0], loops[j][0], loops[i][1] - loops[j][1]);
  }
  return L;
}
for (const cfg of [
  { t: '1 слой, 24 витка, ℓ=150 мм', a: [{ R: 0.050, n: 24, pitch: 0.00625 }] },
  { t: '2 слоя по 12, ℓ=78 мм', a: [{ R: 0.050, n: 12, pitch: 0.0065 }, { R: 0.0565, n: 12, pitch: 0.0065 }] },
  { t: '3 слоя по 8, ℓ=52 мм', a: [{ R: 0.050, n: 8, pitch: 0.0065 }, { R: 0.0565, n: 8, pitch: 0.0065 }, { R: 0.063, n: 8, pitch: 0.0065 }] },
  { t: '1 слой, 12 витков шиной 7×12, ℓ=100 мм', a: [{ R: 0.050, n: 12, pitch: 0.0084 }] },
]) {
  const L = Lmulti(cfg.a);
  const r = sim(C, U, L, 0.013, 24);   // жила + шины/тиристор; ESR банка — в Rs модели
  const nTot = cfg.a.reduce((s, x) => s + x.n, 0);
  const ell = Math.max(...cfg.a.map(x => x.n * x.pitch)) * 1000;
  const Hm = HmagAvg(0.050, ell / 1000, nTot * r.ipk);
  console.log(`  ${cfg.t}: L=${(L * 1e6).toFixed(1)} мкГн → I=${(r.ipk / 1e3).toFixed(2)} кА, N·I=${(nTot * r.ipk / 1e3).toFixed(0)} кА·вит, H=${Math.round(Hm / 1e3)} кА/м (${Math.round(Hm / REQ * 100)}%), i²t VD6=${Math.round(r.i2tD / 1e3)} кА²с`);
}
