// MASTER: все цифры проекта. Банк 47 мФ (10 × EPCOS B43560-S9478-M1 4700 мкФ/400 В, б/у, приёмка каждой),
// оснастка 2 слоя × 12 витков (ℓ=78 мм, L из EM.Lwind — не «200 мкГн»), контур: обмотка + шины/тиристор + ESR банка,
// тиристор Т253-1250-16, VD6 = 2× ВЛ200.
const EM = require('./em.js');
const { sim, split, T253, VL200, Rs } = require('./rlc.js');   // та же модель, что и для оснасток под динамики (calc/coils)
const C0 = 47e-3, N = 24, L24 = EM.FIX.L;
// R контура рабочего выстрела — полный, как в КЗ: обмотка 25 мм² (8.5 мОм на 24 витка) + шины и тиристор 3.5 мОм.
// ESR банка (4 мОм) — Rs в rlc.js, он не масштабируется числом витков.
const RW = 0.0085, RBUS = 0.0035, Rf24 = RW + RBUS;

const f = (x, d = 1) => x.toLocaleString('ru-RU', { maximumFractionDigits: d, minimumFractionDigits: d });

// ---------- рабочая точка ----------
for (const U0 of [300, 320, 350]) {
  const r = sim(C0, U0, L24, Rf24, N), sp = split(r.ipk);
  const lay = EM.FIX.layers.map(l => ({ R: l.R, n: l.n, pitch: EM.FIX.pitch }));
  const Hm = EM.HmagAvg(lay, EM.MAG, N * r.ipk), eta = EM.etaEff(lay, EM.MAG, N * r.ipk);
  console.log(`\n### 47 мФ (10×4700 EPCOS) / ${U0} В / 24 витка (2 слоя × 12, ℓ=${(EM.FIX.len * 1e3).toFixed(0)} мм, L=${f(L24 * 1e6, 1)} мкГн, R=обмотка 8.5+шины/тиристор 3.5, +ESR банка ${f(Rs * 1e3, 1)} мОм)`);
  console.log(`ПОЛЕ в кольце ⌀80×16 (без ярма): H=${f(Hm / 1e3, 0)} кА/м = ${f(Hm / (EM.MAG.HcJ * EM.MAG.k) * 100, 0)}% насыщения NdFeB; η оснастки=${f(eta, 3)}`);
  for (const kL of [2, 3, 5]) {                       // ярмо: L растёт → ток падает, но МДС работает на изделие
    const ry = sim(C0, U0, L24 * kL, Rf24, N);
    const Hy = (N * ry.ipk - EM.MAG.HcJ * EM.MAG.k * 0.4 * 0.001) / EM.MAG.t;
    console.log(`   с ярмом (L×${kL}=${f(L24 * kL * 1e6, 0)} мкГн): I=${f(ry.ipk / 1e3, 2)} кА, N·I=${f(N * ry.ipk / 1e3, 0)} кА·вит → H в изделии ${f(Hy / 1e3, 0)} кА/м = ${f(Hy / (EM.MAG.HcJ * EM.MAG.k) * 100, 0)}% насыщения; i²t VD6=${f(ry.i2tD / 1e3, 0)} кА²с (${f(ry.i2tD / 2 / VL200.i2t * 100, 0)}% на диод)`);
  }
  console.log(`E=${f(r.E / 1e3, 2)} кДж  Q=${f(r.Q, 1)} Кл  T/2=${f(r.Thalf * 1e3, 1)} мс  фронт=${f(r.tpk * 1e3, 1)} мс  τ хвост=${f(r.tau * 1e3, 0)} мс`);
  console.log(`I_pk=${f(r.ipk / 1e3, 2)} кА  N·I=${f(N * r.ipk / 1e3, 0)} кА·вит  di/dt max=${f(r.dmx/1e6, 2)} А/мкс`);
  console.log(`коммутация VT1=${f(r.tc * 1e3, 2)} мс (диод открылся на ${f(r.tdi * 1e3, 2)} мс), энергия в L1 при гашении ${f(r.ELc / 1e3, 2)} кДж`);
  console.log(`VT1: i²t=${f(r.i2tS / 1e3, 0)} кА²с = ${f(r.i2tS / T253.i2t * 100, 1)}% паспорта, пик ${f(r.ipkS / T253.itsm * 100, 0)}% Itsm, di/dt ${f(r.dmx / 1e6 / T253.dit * 100, 1)}% (di/dt)cr, джоуль=${f(T253.u0 * r.Q + T253.rt * r.i2tS, 1)} Дж`);
  console.log(`VD6: i²t=${f(r.i2tD / 1e3, 0)} кА²с → 2×ВЛ200: ${f(r.i2tD / 2 / VL200.i2t * 100, 0)}% на диод; 3×: ${f(r.i2tD / 3 / VL200.i2t * 100, 0)}%; средний ток VD6=${f(r.i2tD / 1e3 / 1e3, 2)} А (Qд=${f(r.Q, 1)} Кл за ${f(r.tc * 1e3, 1)} мс → ${f(r.Q / 30, 2)} А при 1 выстр/30с)`);
  console.log(`ток на банку: ${sp.map(s => `${s.uf}мкФ×${s.n}: ${f(s.I, 0)} А`).join(', ')} (однотипный банк — ровно ${f(r.ipk / 10, 0)} А на банку)`);
  console.log(`bank min=${f(r.umin, 0)} В; без VD6: I_pk=${f(r.B.ipk / 1e3, 2)} кА, коммутация ${f(r.B.tc * 1e3, 1)} мс, bank min=${f(r.B.umin, 0)} В, обратная энергия ${f(0.5 * C0 * r.B.umin * r.B.umin / 1e3, 2)} кДж, i²t контура ${f(r.B.i2t / 1e3, 0)} кА²с`);
  console.log(`экспозиция ∫N·I dt: с VD6 ${f(N * r.ni, 0)} А·виток·с, без VD6 ${f(N * r.B.ni, 0)} (×${f(r.ni / r.B.ni, 1)})`);
  console.log(`нагрев обмотки ${f(0.9 * r.E / (3.2 * 385), 1)} °C/выстрел; средний ток при 1 выстр/30с = ${f(r.Q / 30, 2)} А`);
  const EL = 0.5 * L24 * r.ipk * r.ipk;
  console.log(`выброс при принудительном срезе ${f(r.ipk / 1e3, 2)} кА: в L1 ${f(EL / 1e3, 2)} кДж → 100 нФ = ${f(Math.sqrt(2 * EL / 100e-9) / 1e3, 0)} кВ`);
}

// ---------- КЗ в оснастке: плавкой вставки (FU3) и crowbar'а в конструкции нет ----------
// Ток и i²t задаёт только индуктивность петли; R контура — шины + тиристор, обмотка в КЗ замкнута накоротко.
const { rlc } = require('./charge.js');
const spW = split(sim(C0, 300, L24, Rf24, N).ipk);       // рабочий выстрел: сколько берёт банка в норме
console.log(`\n### КЗ в оснастке, 47 мФ (10×4700) / 300 В, R контура шины+тиристор 3.5 + ESR банка ${f(Rs * 1e3, 1)} мОм — защитной вставки нет, считает rlc() из charge.js`);
for (const Lu of [2, 5, 10, 20]) {
  const k = rlc(0.0035 + Rs, Lu * 1e-6, 300, C0), sp = split(k.Ipk_A);
  console.log(`петля ${Lu} мкГн: I_pk=${f(k.Ipk_A / 1e3, 1)} кА (${f(k.Ipk_A / T253.itsm * 100, 0)}% Itsm Т253), i²t=${f(k.It2_kA2s, 0)} кА²с (${f(k.It2_kA2s * 1e3 / T253.i2t * 100, 0)}% паспорта), длительность ${f(k.dur_ms, 0)} мс, энергия ${f(k.E_kJ, 2)} кДж → на банку: ${sp.map((s, i) => `${s.uf}мкФ: ${f(s.I, 0)} А (${f(s.I / spW[i].I, 1)}× рабочего выстрела)`).join(', ')}`);
}

// ---------- таблица витков при 300 В ----------
console.log('\n### Таблица витков, 47 мФ (10×4700), 300 В');
for (const [name, cfg] of Object.entries({ '12 (1 слой)': [12], '24 (1 слой, ℓ=156)': [24], '24 (2 слоя × 12) ← проект': [12, 12], '24 (3 слоя × 8)': [8, 8, 8], '36 (2 слоя × 18)': [18, 18] })) {
  const v = EM.variant(cfg), n = v.n, L = v.L;
  const lay = v.layers;
  const Rf = RW * n / 24 + RBUS, r = sim(C0, 300, L, Rf, n), sp = split(r.ipk);
  const Hm2 = EM.HmagAvg(lay, EM.MAG, n * r.ipk);
  console.log(`${name}: N=${n}, ℓ=${(v.len * 1e3).toFixed(0)} мм, L=${f(L * 1e6, 0)} мкГн Rобм=${f(Rf * 1e3, 1)} мОм, H_кольцо=${f(Hm2 / 1e3, 0)} кА/м (${f(Hm2 / (EM.MAG.HcJ * EM.MAG.k) * 100, 0)}%), η=${f(EM.etaEff(lay, EM.MAG, n * r.ipk), 3)} → I_pk=${f(r.ipk / 1e3, 2)} кА  N·I=${f(n * r.ipk / 1e3, 0)} кА·вит  фронт=${f(r.tpk * 1e3, 1)} мс  T/2=${f(r.Thalf * 1e3, 1)} мс  τ=${f(r.tau * 1e3, 0)} мс  i²t VT1=${f(r.i2tS / 1e3, 0)} кА²с (${f(r.i2tS / T253.i2t * 100, 1)}%)  i²t VD6=${f(r.i2tD / 1e3, 0)} кА²с (${f(r.i2tD / 2 / VL200.i2t * 100, 0)}% на диод)  на банку: ${sp.map(s => f(s.I, 0)).join('/')} А  VT1 пик ${f(r.ipk / T253.itsm * 100, 0)}% Itsm  di/dt ${f(r.dmx/1e3, 2)} А/мс = ${f(r.dmx/1e6, 2)} А/мкс`);
}

// ---------- смежные составы того же типа банок (для §3.2) ----------
for (const [tag, Cn] of [['5×4700 (что есть сегодня)', 23.5e-3], ['11×4700 (если найдётся ещё)', 51.7e-3]]) {
  const rX = sim(Cn, 300, L24, Rf24, 24);
  console.log(`\n### ${tag} / 300 В: I_pk=${f(rX.ipk / 1e3, 2)} кА, N·I=${f(24 * rX.ipk / 1e3, 0)} кА·вит, E=${f(rX.E / 1e3, 2)} кДж, i²t VD6=${f(rX.i2tD / 1e3, 0)} кА²с (${f(rX.i2tD / 2 / VL200.i2t * 100, 0)}%), i²t VT1=${f(rX.i2tS / 1e3, 0)} кА²с, Q=${f(rX.Q, 1)} Кл`);
}

// ---------- данные для осциллограммы §2 ----------
const rA = sim(C0, 300, L24, Rf24, 24);
require('fs').writeFileSync(__dirname+'/vd6_data.json', JSON.stringify({
  A: rA.hist, B: rA.B.hist,
  meta: { C: C0, U0: 300, N, L: L24, ipkA: rA.ipk, ipkB: rA.B.ipk, tcommA: rA.tc, tcommB: rA.B.tc, tdiA: rA.tdi,
          uminA: rA.umin, uminB: rA.B.umin, i2tD: rA.i2tD, i2tS: rA.i2tS, tau: rA.tau, niA: rA.ni, niB: rA.B.ni, E: rA.E, Q: rA.Q }
}));
console.log('\nvd6_data.json перезаписан: 47 мФ (10×4700) / 300 В');
