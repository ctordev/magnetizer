#!/usr/bin/env node
// Сравнение «ампер-витков» оснастки: конструкции imlab.narod.ru против нашей 2×12.
//   node calc/src/imlab_compare.js
// Смысл: у всех оснасток поле определяется одной величиной — N·I (МДС). Для
// воздушного соленоида H_центр = N·I / (2·sqrt(R² + (ℓ/2)²)); для оснастки с
// полюсами (магнитопровод вокруг изделия) H ≈ N·I / l_воздуха, где l_воздуха —
// толщина изделия плюс зазоры. Поэтому по паспорту (B, I, размеры зоны) можно
// оценить, работает конструкция как соленоид или как магнитопровод.
const fs = require('fs');
const { FIX, MAG, HmagAvg, MU0 } = require('./em.js');

const num = x => (x === null || x === undefined || x === '—' ? null : Number(x));

function solenoidNI(B, R, half) {          // Н·I, нужное для поля B в центре воздушного соленоида
  return 2 * B * Math.hypot(R, half) / MU0;
}
function poleNI(B, lAir) {                // Н·I для замкнутой оснастки: весь MMF уходит в воздух
  return (B / MU0) * lAir;
}

const file = 'refs/imlab/_notes/fixtures.json';
if (!fs.existsSync(file)) { console.error('сначала: python3 calc/src/imlab_table.py'); process.exit(1); }
const rows = JSON.parse(fs.readFileSync(file, 'utf8'));

console.log('оснастка imlab: поле из паспорта → МДС, и чем она является по физике');
console.log('конструкция'.padEnd(34) + 'zone мм      B Тл   I кА   NI факт   NI солен.   NI полюс.   вывод');
for (const r of rows) {
  const B = num(r.B_T), I = num(r.I_A), N = num(r.turns), d = num(r.bore_mm), h = num(r.zone_h_mm);
  if (!B || !I) continue;
  const name = r.page.split('/')[0].padEnd(24);
  const fact = N ? (N * I / 1e3) : null;
  let sol = null, pol = null;
  if (d && h) { sol = solenoidNI(B, d / 2000, h / 2000) / 1e3; pol = poleNI(B, h / 1000 + 0.004) / 1e3; }
  const verdict = fact && sol ? (fact / sol > 1.4 ? 'соленоид с запасом' : fact / sol < 0.7 ? 'магнитопровод (экономия МДС)' : 'соленоид') : 'не хватает витков/зоны';
  console.log(name.padEnd(34) +
    `${d && h ? `${d}×${h}`.padEnd(11) : '—'.padEnd(11)} ` +
    `${String(B).padStart(4)} ${String(I / 1000).padStart(6)}  ` +
    `${fact ? fact.toFixed(0).padStart(8) : '     —  '} ${sol ? sol.toFixed(0).padStart(10) : '        — '}   ${pol ? pol.toFixed(0).padStart(9) : '     — '}   ${verdict}`);
}

// ── наша оснастка ──────────────────────────────────────────────────────────────
const I = 6790;                                    // рабочая точка 300 В / 47 мФ (10×4700 EPCOS, контур 16 мОм)
const NI = FIX.turns * I;
const layers = FIX.layers.map(l => ({ R: l.R, n: l.n, pitch: FIX.pitch }));
const H = HmagAvg(layers, MAG, NI);
console.log('\nнаша оснастка 2×12, ⌀100 мм, жила 25 мм²:');
console.log(`  N=${FIX.turns}, ℓ=${(FIX.len * 1000).toFixed(0)} мм, I=${(I / 1000).toFixed(2)} кА, N·I=${(NI / 1e3).toFixed(0)} кА·витков`);
console.log(`  H в кольце NdFeB 16 мм (модель, без ярма) = ${(H / 1e6).toFixed(2)} МА/м, что ${(H / 3.6e6 * 100).toFixed(0)} % нужного (3.6 МА/м)`);
for (const need of [1.62e6, 3.6e6]) {
  const air = solenoidNI(need * MU0, MAG.rOut, FIX.len / 2);
  const pole = poleNI(need * MU0, MAG.t + 0.004);
  console.log(`  чтобы иметь ${ (need / 1e6).toFixed(2)} МА/м: соленоидом — ${(air / 1e3).toFixed(0)} кА·витков;` +
    ` оснасткой с полюсами (зазор 2 мм) — ${(pole / 1e3).toFixed(0)} кА·витков` +
    ` → при ${FIX.turns} витках это ${(pole / FIX.turns / 1000).toFixed(1)} кА, при 8 кА — ${Math.ceil(pole / I)} витков`);
}
