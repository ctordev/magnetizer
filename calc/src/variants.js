// Сравнение вариантов намотки при одном и том же банке: 2×12 (проект), 2×18, 2×24, 3×8, 1×24.
// Нужно для §3.2 (импульсный ток на банку — лимит) и §4 (больше витков почти бесплатно, но поле падает).
// Модель разряда та же, что в master.js: sim/split берутся из него, геометрия — из em.variant().
// Пуск: node calc/src/variants.js
const EM = require('./em.js');
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/master.js', 'utf8');
const head = src.slice(0, src.indexOf('// ---------- рабочая точка'));
const sc = {};
new Function('require', 'module', head + '\n;this.sim=sim;this.split=split;').call(sc, require, sc);

const C = 47e-3, U = 300, UF = 0.0085 / 24;      // R обмотки: то же сечение жилы → Ом на виток; шины/тиристор +3.5 мОм ко всем строкам
const RBUS = 0.0035;
const CASES = [
  ['1 слой × 12', [12]],
  ['1 слой × 24', [24]],
  ['2 слоя 12+12 ← проект', [12, 12]],
  ['3 слоя 8+8+8', [8, 8, 8]],
  ['2 слоя 18+18', [18, 18]],
  ['2 слоя 24+24', [24, 24]],
];

console.log(`### варианты намотки, один банк ${C * 1e3} мФ (10×4700 EPCOS) / ${U} В, bore ⌀100 мм, жила 25 мм², шаг 6,5 мм`);
console.log('вариант                  N    ℓ мм   L мкГн  R мОм   I кА  N·I кА·вит  H кА/м  %насыщ η      i²tVD6 кА²с  %на диод  на банку А  T/2 мс  %Itsm');
for (const [name, cfg] of CASES) {
  const v = EM.variant(cfg);
  const Rf = UF * v.n + RBUS;
  const r = sc.sim(C, U, v.L, Rf, v.n);
  const sp = sc.split(r.ipk);
  const NI = v.n * r.ipk;
  const H = EM.HmagAvg(v.layers, EM.MAG, NI);
  const at = uf => { const c = sp.find(c => c.uf === uf); return c ? c.I : 0; };
  console.log(
    name.padEnd(24), String(v.n).padStart(2), (v.len * 1e3).toFixed(0).padStart(6), (v.L * 1e6).toFixed(1).padStart(7),
    (Rf * 1e3).toFixed(1).padStart(6), (r.ipk / 1e3).toFixed(2).padStart(6), (NI / 1e3).toFixed(0).padStart(10),
    (H / 1e3).toFixed(0).padStart(7), (H / (EM.MAG.HcJ * EM.MAG.k) * 100).toFixed(0).padStart(5),
    EM.etaEff(v.layers, EM.MAG, NI).toFixed(3).padStart(6), (r.i2tD / 1e3).toFixed(0).padStart(11),
    (r.i2tD / 2 / 180e3 * 100).toFixed(0).padStart(9), at(4700).toFixed(0).padStart(11),
    (r.Thalf * 1e3).toFixed(1).padStart(7), (r.ipk / 28e3 * 100).toFixed(0).padStart(6));
}
// %нас — доля насыщения NdFeB 16 мм (3,6 МА/м = k·Hcj, см. §3); η — «КПД оснастки» из §4.1.
console.log('\nОриентир: импульсный ток на банку — для однотипного банка EPCOS B43560 это ровно I/n; лимит не паспортный, а нагрев выводков и ресурс (см. §3.2 документа).');
console.log('Поле без ярма: H = η·N·I / l_изделия; ярмо поднимает H в 1.6…2.5 раза и L в 2…5 раз — см. yoke3d.js / §9.');
