// УПРОЩЁННАЯ ВЕРСИЯ установки: тиристор Т160, заряд банка напрямую от сети через лампу накаливания,
// без T1 и без фазового регулирования. Числа основного документа (magnetizer.html) не меняются —
// там остаётся Т253-1250 и банк 47 мФ.
//
// Пуск: node calc/coils/simple.js          (таблицы в консоль + calc/src/simple_data.json для графиков)
// Его же использует генератор ../../magnetizer-simple.html (calc/coils/doc_simple.js) — своих чисел
// в документе нет.
//
// Два режима:
//   A — банк 1×4700 мкФ заряжен до ПИКА СЕТИ (311…358 В). Ток 2,1…2,5 кА, T/2 = 1,8 мс.
//       Короткий импульс: годится ферритовым МС, у которых катушка надевается на магнит (поле идёт
//       в феррит напрямую, вихревых экранов на пути нет).
//   B — 33 мФ / 150 В. Ток 2,2 кА, T/2 = 4,8 мс — длинный импульс для альнико и для головок, у
//       которых поле идёт через сталь. От сети не заряжается (пик сети 311 В), нужен понижающий узел.
//
// Почему ёмкость режем, а напряжение поднимаем: I_pk ≈ U·√(C/L), т.е. ограничение Т160 по пику
// фиксирует C·U² ≈ 2·I²·L (энергию). Растя U в 1,7 раза, ёмкость режем в 2,8 раза при том же токе.
// Плата за это — длительность: T/2 = π√(LC) укорачивается как 1/U.

const fs = require('fs');
const EM = require('../src/em.js');
const { sim, split, scrStress, T160, VL200, Rs, VSCR } = require('../src/rlc.js');
const { SYS, circuit, boreMin } = require('./motors.js');
const { W, f, wind, shot, cov, Radd } = require('./winding.js');

// ── сеть и зарядный узел ──
const MAINS = [220, 230, 253];                       // 220 номинал, 230 паспорт ЕС, 253 = +10 %
const peak = (U) => Math.round(U * Math.SQRT2);      // 311 / 325 / 358 В — куда реально зарядится банк
const LAMP = { P: 100, U: 220 };                     // балласт: лампа 100 Вт, R в горячем состоянии
const Rlamp = LAMP.U * LAMP.U / LAMP.P;              // 484 Ом
const Rcold = Rlamp / 10;                            // холодная спираль ≈ в 10 раз меньше
const BLEED = 47e3;                                  // разрядник банка: 47 кОм, 5 Вт (диод в заряде
                                                     // обратный ток не пускает — без резистора банк
                                                     // после вырывания вилки остаётся под напряжением)
const VD = 1.0;                                      // падение на зарядном диоде

// Принятая оснастка — та же, что в основной установке и в katushki-10gd.html: ⌀95, 2 слоя × 14.
const MAIN = { bore: boreMin(SYS.gd34).bore, per: 14, nL: 2 };
const wMain = wind(MAIN.bore, MAIN.per, MAIN.nL);

// ── режимы ──
const CAP_A = 4.7e-3;                                // 1 × EPCOS B43560-S9478-M1 4700 мкФ/400 В
const CAP_A2 = 9.4e-3;                               // 2 × 4700 — сравнение (на него 70…84 % Itsm)
const MODE_B = { C: 32.9e-3, U: 150 };               // 7 × 4700 / 150 В — заряд от сети диммером (α ≈ 28°)
const MODE_B_LS = [[23.5e-3, 150], [32.9e-3, 150], [47.0e-3, 150], [32.9e-3, 180]];

function point(C, U, w = wMain) {
  const r = sim(C, U, w.L, w.R + Radd, w.N), s = scrStress(r, T160);
  const B = EM.MU0 * EM.Hpoint(w.layers, w.bore / 2e3, 0, r.ipk * w.N);
  return { C, U, w, r, s, NI: r.ipk * w.N, B, press: B * B / (2 * EM.MU0),
           dTcu: 0.9 * r.E / (w.mass * 385), sp: split(r.ipk) };
}

// Заряд банка от сети через диммер US1, лампу и диод (полуволновой): считаем настоящий процесс,
// а не τ = R·C, потому что диод пропускает только положительные полуволны и у пика банк
// дозаряжается «лесенкой» — последние проценты идут в разы дольше, чем τ. Umain — действующее
// напряжение сети; alpha — угол открытия диммера (π/2 = полностью), банк заряжается до пика
// срезанной синусоиды Up·sin α (так диммер и задаёт напряжение: U = √2·Uсети·sin α − U_диода).
function charge(C, Umain, P = LAMP.P, alpha = Math.PI / 2) {
  const R = LAMP.U * LAMP.U / P, Up = Math.SQRT2 * Umain, dt = 1e-4, w = 2 * Math.PI * 50;
  const Upk = Up * Math.sin(alpha);                   // пик срезанной полуволны — куда зарядится банк
  let u = 0, t = 0, i0 = 0, t90 = null, t95 = null;
  const tgt = (k) => k * (Upk - VD);
  for (; t < 3600; t += dt) {
    const th = (w * t) % Math.PI;                      // фаза внутри полуволны (диммер режет обе)
    const um = th >= alpha ? Up * Math.sin(th) : 0;
    if (um > u + VD) { const i = (um - VD - u) / R; i0 = Math.max(i0, i); u += i / C * dt; }
    if (t90 === null && u >= tgt(0.90)) t90 = t;
    if (t95 === null && u >= tgt(0.95)) t95 = t;
    if (u >= tgt(0.99)) break;
  }
  return { R, Up, Upk, alpha, t90, t95, t99: t, i0, i0cold: (Upk - VD) / (R / 10), tau: R * C,
           bleedTau: BLEED * C, bleed50: BLEED * C * Math.log((Upk - VD) / 50),
           bleedP: (Upk - VD) ** 2 / BLEED };
}

// Угол диммера, при котором банк встаёт на U: sin α = (U + U_диода) / пик сети.
const alphaFor = (U, Umain) => Math.asin(Math.min(1, (U + VD) / (Math.SQRT2 * Umain)));

// ── покрытие головок: чем берём в каждом режиме ──
function cover(p) {
  return Object.entries(SYS).map(([k, sys]) => {
    const need = circuit(sys).sum;
    return { key: k, name: sys.name, mat: sys.mat, magnet: sys.magnet, need, NI: p.NI,
             x: p.NI / need, cov: cov(p.w, sys, p.NI),
             short: sys.mat === 'ferrite' ? 'короткий импульс годится' : 'нужен длинный импульс' };
  });
}

// ── данные для осциллограмм документа (фиги рисует calc/src/fig_d2.js / fig_vd6.js) ──
function figData(C, U, tag, title, sub) {
  const r = sim(C, U, wMain.L, wMain.R + Radd, wMain.N);
  return { A: r.hist, B: r.B.hist,
    meta: { C, U0: U, N: wMain.N, L: wMain.L, R: wMain.R + Radd, ipkA: r.ipk, ipkB: r.B.ipk,
            tcommA: r.tc, tcommB: r.B.tc, tdiA: r.tdi, uminA: r.umin, uminB: r.B.umin,
            i2tD: r.i2tD, i2tS: r.i2tS, tau: r.tau, niA: r.ni, niB: r.B.ni, E: r.E, Q: r.Q,
            thy: 'Т160', thyI2t: T160.i2t, dio: '2× ВЛ200', dioI2t: VL200.i2t,
            cap: { title, sub }, tag } };
}

// Два файла в формате fig_d2/fig_vd6 (A/B — гистограммы «с VD6» и «без», meta — числа и подписи):
// режим A (пик сети) и режим B (длинный импульс). Генератор документа берёт из них же и рисунки.
const FIGS = { A: __dirname + '/../src/simple_A_data.json', B: __dirname + '/../src/simple_B_data.json' };
function writeData() {
  fs.writeFileSync(FIGS.A, JSON.stringify(figData(CAP_A, peak(230), 'A',
    `Упрощённая версия, режим A: банк ${(CAP_A * 1e3).toFixed(1)} мФ (1 × EPCOS 4700 мкФ/400 В), ` +
    `${peak(230)} В (пик сети 230 В), оснастка 2 слоя × 14 / ${(wMain.L * 1e6).toFixed(0)} мкГн / контур ${((wMain.R + Radd + Rs) * 1e3).toFixed(1)} мОм`,
    `модель: C→VT1(Т160)→(L, r) с VD6 на клеммах оснастки; VD6 = 2× ВЛ200; заряд от сети диммером US1 (полный угол) через лампу 100 Вт и диод`)));
  fs.writeFileSync(FIGS.B, JSON.stringify(figData(MODE_B.C, MODE_B.U, 'B',
    `Упрощённая версия, режим B: банк ${(MODE_B.C * 1e3).toFixed(1)} мФ (7 × EPCOS 4700 мкФ), ${MODE_B.U} В, ` +
    `оснастка 2 слоя × 14 / ${(wMain.L * 1e6).toFixed(0)} мкГн / контур ${((wMain.R + Radd + Rs) * 1e3).toFixed(1)} мОм`,
    `модель та же: C→VT1(Т160)→(L, r) с VD6 на клеммах оснастки; заряд — от сети диммером US1 (α ≈ ${f(alphaFor(MODE_B.U, 230) * 180 / Math.PI, 0)}°)`)));
}

module.exports = { MAINS, peak, LAMP, Rlamp, Rcold, BLEED, VD, MAIN, wMain, CAP_A, CAP_A2, MODE_B,
  MODE_B_LS, alphaFor, point, charge, cover, figData, FIGS, writeData, T160 };

// ══════════════════════════ прогон в консоль ══════════════════════════
if (require.main === module) {
  console.log(`Оснастка: bore ⌀${wMain.bore}, ${wMain.nL} слоя × ${wMain.per} = ${wMain.N} витков, ` +
    `L=${f(wMain.L * 1e6, 0)} мкГн, R=${f(wMain.R * 1e3, 1)} мОм (+шины ${f(Radd * 1e3, 1)}, +ESR ${f(Rs * 1e3, 1)}), ` +
    `меди ${wMain.mass.toFixed(2)} кг`);
  console.log(`Т160: Itsm=${T160.itsm} А (10 мс), i²t=${f(T160.i2t / 1e3, 0)} кА²·с, (di/dt)кр=${T160.dit} А/мкс, ` +
    `tвыкл=${f(T160.tq * 1e6, 0)} мкс, Iу.от=${T160.igt} А, класс ${T160.cls} В (макс. пост. Uзс = ${f(T160.cls * 0.75, 0)} В)`);

  console.log('\n── РЕЖИМ A: банк 1×4700 мкФ, заряд до пика сети ──');
  for (const U of MAINS) {
    const p = point(CAP_A, peak(U)), c = charge(CAP_A, U);
    console.log(`сеть ${U} В → ${peak(U)} В: I_pk=${f(p.r.ipk / 1e3, 2)} кА (${f(p.s.pctItsm * 100, 0)}% Itsm) ` +
      `i²t=${f(p.r.i2tS / 1e3, 1)} кА²с (${f(p.s.pctI2t * 100, 0)}%) ΔTj=+${f(p.s.dTj, 0)} К (пик ${f(40 + p.s.dTj, 0)} °C) ` +
      `T/2=${f(p.r.Thalf * 1e3, 2)} мс N·I=${f(p.NI / 1e3, 0)} кА·вит E=${f(p.r.E, 0)} Дж +${f(p.dTcu, 1)} °C меди`);
    console.log(`        di/dt=${f(p.s.dit, 1)} А/мкс (${f(p.s.ditPct * 100, 0)}% от 80) · обратное время ${f(p.s.tRev * 1e3, 1)} мс (tвыкл 0,25) · ` +
      `dV/dt=${f(p.s.dVdt, 2)} В/мкс · класс нужен ≥ ${Math.ceil(peak(U) / 0.75 / 100) * 100} В · ` +
      `заряд: ${f(c.t90, 0)} с до 90 %, ${f(c.t95, 0)} с до 95 %, ${f(c.t99, 0)} с до 99 % (τ=${f(c.tau, 1)} с), ток заряда ≤${f(c.i0, 1)} А`);
  }
  console.log('  сравнение: банк 2×4700 мкФ на том же пике сети');
  for (const U of [220, 253]) {
    const p = point(CAP_A2, peak(U));
    console.log(`    ${peak(U)} В: I_pk=${f(p.r.ipk / 1e3, 2)} кА (${f(p.s.pctItsm * 100, 0)}% Itsm) i²t=${f(p.r.i2tS / 1e3, 1)} кА²с ` +
      `ΔTj=+${f(p.s.dTj, 0)} К T/2=${f(p.r.Thalf * 1e3, 2)} мс N·I=${f(p.NI / 1e3, 0)} — тиристор уже на пределе по пику`);
  }

  console.log('\n── РЕЖИМ B: длинный импульс, заряд от сети диммером (α от руки, контроль PV1) ──');
  for (const [C, U] of MODE_B_LS) {
    const p = point(C, U), a = alphaFor(U, 230), c = charge(C, 230, LAMP.P, a);
    console.log(`${f(C * 1e3, 1)} мФ / ${U} В: I_pk=${f(p.r.ipk / 1e3, 2)} кА (${f(p.s.pctItsm * 100, 0)}% Itsm) ` +
      `i²t=${f(p.r.i2tS / 1e3, 1)} кА²с (${f(p.s.pctI2t * 100, 0)}%) ΔTj=+${f(p.s.dTj, 0)} К T/2=${f(p.r.Thalf * 1e3, 1)} мс ` +
      `N·I=${f(p.NI / 1e3, 0)} кА·вит E=${f(p.r.E, 0)} Дж +${f(p.dTcu, 1)} °C меди · диммер α=${f(a * 180 / Math.PI, 0)}° (пик ${f(c.Upk, 0)} В): ` +
      `${f(c.t95, 0)} с до 95 %, ${f(c.t99, 0)} с до 99 %, ток ≤${f(c.i0, 2)} А`);
  }

  console.log('\n── запрет: тот же Т160 с банком основной установки ──');
  for (const [C, U] of [[47e-3, 300], [47e-3, 358], [23.5e-3, 358], [7e-3, 358]]) {
    const p = point(C, U);
    const verdict = p.s.pctItsm > 0.8 ? 'нельзя' : p.s.pctItsm > 0.6 ? 'на пределе — не режим' : 'годится';
    console.log(`${f(C * 1e3, 1)} мФ / ${U} В: I_pk=${f(p.r.ipk / 1e3, 2)} кА (${f(p.s.pctItsm * 100, 0)}% Itsm) ` +
      `i²t=${f(p.r.i2tS / 1e3, 1)} кА²с (${f(p.s.pctI2t * 100, 0)}%) ΔTj=+${f(p.s.dTj, 0)} К → ${verdict}`);
  }

  console.log('\n── покрытие головок ──');
  const pa = point(CAP_A, peak(230)), pb = point(MODE_B.C, MODE_B.U);
  console.log(`режим A (${peak(230)} В, 4,7 мФ, T/2=${f(pa.r.Thalf * 1e3, 2)} мс, N·I=${f(pa.NI / 1e3, 0)} кА·вит):`);
  for (const c of cover(pa)) console.log(`   ${c.name}: нужно ${f(c.need / 1e3, 0)} → ${f(c.x, 1)}×, охват ${f(c.cov * 100, 0)}% — ${c.short}`);
  console.log(`режим B (${MODE_B.U} В, ${f(MODE_B.C * 1e3, 1)} мФ, T/2=${f(pb.r.Thalf * 1e3, 1)} мс, N·I=${f(pb.NI / 1e3, 0)} кА·вит):`);
  for (const c of cover(pb)) console.log(`   ${c.name}: нужно ${f(c.need / 1e3, 0)} → ${f(c.x, 1)}×, охват ${f(c.cov * 100, 0)}% — ${c.short}`);

  console.log('\n── зарядный узел: диммер US1 + лампа 100 Вт (сеть 230 В) ──');
  console.log('  напряжение задаётся углом: U = √2·230·sin α − 1 В; контроль PV1, верх ручки — упор на 360 В');
  for (const U of [358, 325, 300, 250, 200, 150]) {
    const a = alphaFor(U, 230), cA = charge(CAP_A, 230, LAMP.P, a), cB = charge(MODE_B.C, 230, LAMP.P, a);
    console.log(`  ${U} В: α=${f(a * 180 / Math.PI, 1)}°, ток ≤${f(cA.i0, 2)} А · банк 4,7 мФ: ${f(cA.t90, 0)}/${f(cA.t95, 0)} с (90/95 %)` +
      ` · банк ${f(MODE_B.C * 1e3, 1)} мФ: ${f(cB.t90, 0)}/${f(cB.t95, 0)} с`);
  }
  for (const P of [75, 100, 150, 200]) {
    const c = charge(CAP_A, 230, P);
    console.log(`  (на полном угле) лампа ${P} Вт (R=${f(c.R, 0)} Ом): ${f(c.t90, 0)} с до 90 %, ${f(c.t95, 0)} с до 95 %, ${f(c.t99, 0)} с до 99 % пика ${f(c.Up, 0)} В; ` +
      `ток заряда ≤${f(c.i0, 1)} А (холодная спираль ≤${f(c.i0cold, 0)} А)`);
  }
  const cA = charge(CAP_A, 253), cB = charge(MODE_B.C, 230, LAMP.P, alphaFor(MODE_B.U, 230));
  console.log(`  разрядник ${f(BLEED / 1e3, 0)} кОм: τ=${f(cA.bleedTau, 0)} с, до 50 В за ${f(cA.bleed50, 0)} с, на нём ${f(cA.bleedP, 1)} Вт (банк 4,7 мФ / ${peak(253)} В)`);
  console.log(`  режим B (${f(MODE_B.C * 1e3, 1)} мФ, диммер α=${f(cB.alpha * 180 / Math.PI, 0)}°, пик ${f(cB.Upk, 0)} В): до 95 % за ${f(cB.t95, 0)} с, ` +
    `до 99 % за ${f(cB.t99, 0)} с; τ разрядника ${f(cB.bleedTau, 0)} с, до 50 В за ${f(cB.bleed50, 0)} с`);

  writeData();
  console.log('\nsimple_A_data.json и simple_B_data.json перезаписаны: режим A (4,7 мФ / ' + peak(230) +
    ' В) и режим B (' + f(MODE_B.C * 1e3, 1) + ' мФ / ' + MODE_B.U + ' В)');
}
