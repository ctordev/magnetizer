// Оснастки (катушки) под 10ГД-34 и 10ГД-30Е: мотаем из того, что есть — медь ⌀3,3 мм в тряпочной изоляции.
// L и поле — из ../src/em.js (геометрия намотки), режим — из ../src/rlc.js (та же модель, что и в magnetizer.html).
//
// Пуск: node calc/coils/coils.js
// Главное: МДС нужна ~25 кА·витков (считает motors.js), потому режим берём мягкий — не 300 В, а 120…180 В:
// ток 1.5…2.5 кА, в 4…6 раз меньше силы, давящие на намотку и на диффузор, а запаса всё равно трёхкратный.

const EM = require('../src/em.js');
const { sim, split, T253, VL200 } = require('../src/rlc.js');
const { SYS, MAT, circuit, voiceCoil, B_POLE, boreMin } = require('./motors.js');

const { W, C0, f, wind, magOf, shot, pullToCenter, boreScan, basketEffect, cov, recommend } = require('./winding.js');   // то же, что использует генератор документа

// bore считается от наибольшего диаметра пакета + 10 мм (по 5 мм на сторону).
// 10ГД-34: по замеру пользователя фланцы на 1…2 мм МЕНЬШЕ магнита ⇒ пакет ⌀85 это само кольцо, bore ⌀95.
// 10ГД-30Е: фланцы больше керна, но не измерены ⇒ bore пока берём с запасом.
const BM = { gd34: boreMin(SYS.gd34), gd30e: boreMin(SYS.gd30e) };
const MAIN = { bore: BM.gd34.bore, per: 14, nL: 2 };        // принятая конструкция
const DESIGNS = [
  { sys: 'gd34', bore: BM.gd34.bore, per: [12, 14], nL: [1, 2] },
  { sys: 'gd30e', bore: 120, per: [12, 14], nL: [1, 2] },
];
const US = [120, 150, 180, 300], KLS = [1, 2.5];

for (const d of DESIGNS) {
  const sys = SYS[d.sys], mat = MAT[sys.mat], c = circuit(sys);
  const NI_need = c.sum, NI_work = c.sum * 2.5;
  console.log(`\n════════ ${sys.name} ════════`);
  console.log(`по магнитной цепи нужно ${f(NI_need / 1e3, 0)} кА·витков, в работу берём ${f(NI_work / 1e3, 0)} (×2.5)`);
  const all = [];
  for (const per of d.per) for (const nL of d.nL) {
    const w = wind(d.bore, per, nL);
    const HperNI = EM.HmagAvg(w.layers, magOf(sys), 1);            // H в объёме магнита на 1 А·виток (без стали)
    if (w.h > sys.stackH + 15) console.log(`\n── катушка ⌀${w.bore} мм, ${nL} слой × ${per} = ${w.N} витков, высота ${f(w.h, 0)} мм` +
      ` — выше пакета мотора (${sys.stackH} мм): верхние витки работают плохо`);
    else console.log(`\n── катушка ⌀${w.bore} мм, ${nL} слой × ${per} = ${w.N} витков, высота ${f(w.h, 0)} мм, ⌀внешн ${f(w.od, 0)} мм`);
    console.log(`   L=${f(w.L * 1e6, 0)} мкГн (возд.)  R=${f(w.R * 1e3, 1)} мОм  провод ${w.len.toFixed(1)} м, ${w.mass.toFixed(2)} кг`);
    console.log(`   той же катушкой без стали в bore: H в магните ${f(HperNI * NI_work / 1e3, 0)} кА/м при ${f(NI_work / 1e3, 0)} кА·вит;` +
      ` воздушной катушкой пришлось бы давать ${f(mat.Hsat / HperNI / 1e3, 0)} кА·витков`);
    for (const U of US) for (const kL of KLS) {
      const s = shot(w, U, kL);
      all.push({ w, U, kL, s });
      console.log(`   ${String(U).padStart(3)} В L×${String(kL).padEnd(3)}: I_pk=${f(s.r.ipk / 1e3, 2).padStart(5)} кА` +
        `  N·I=${f(s.NI / 1e3, 0).padStart(4)} кА·вит (${f(s.NI / NI_need, 1)}× нужно)` +
        `  T/2=${f(s.r.Thalf * 1e3, 1)} мс  на банку ${s.sp.map(x => f(x.I, 0)).join('/')} А` +
        `  i²t VT1 ${f(s.r.i2tS / T253.i2t * 100, 1)}% VD6 ${f(s.r.i2tD / 2 / VL200.i2t * 100, 1)}% на диод` +
        `  +${f(s.dT, 1)} °C  B у bore ${f(s.B, 1)} Тл → ${f(s.press / 1e6, 1)} МПа`);
    }
  }
  // режим по умолчанию: минимальный ток, при котором МДС с запасом покрывает цепь и намотку не распирает
  const ok = all.filter(x => x.kL === 1 && x.s.NI >= NI_work && x.s.press < 1.6e6 && x.w.h <= sys.stackH + 20);
  ok.sort((a, b) => a.s.r.ipk - b.s.r.ipk);
  const b = ok[0];
  if (b) {
    F = pullToCenter(b.w, b.U);   // отсюда «катушку центровать, динамик фиксировать»
    console.log(`\n  ⇒ режим по умолчанию: ⌀${b.w.bore}, ${b.w.nL}×${b.w.per}, ${b.U} В → I=${f(b.s.r.ipk / 1e3, 2)} кА, ` +
    `N·I=${f(b.s.NI / 1e3, 0)} кА·вит (${f(b.s.NI / NI_need, 1)}×), T/2=${f(b.s.r.Thalf * 1e3, 1)} мс, ` +
    `на банку ${b.s.sp.map(x => f(x.I, 0)).join('/')} А, +${f(b.s.dT, 1)} °C, давление ${f(b.s.press / 1e6, 1)} МПа, ` +
    `тяга к центру при смещении на 1 см ~${f(F / 1e3, 0)} кН — катушку центровать, динамик фиксировать`);
  }
}

// ── цена зазора между намоткой и магнитом: та же намотка, разный bore ──
console.log('\n════════ bore: почему его ставят вплотную к магниту ════════');
console.log('намотка во всех строках одна и та же — 2 слоя × 14. «охват» — поле в объёме магнита без стали, в % от нужного H_sat;');
console.log('он показывает, во сколько раз хуже связь, когда витки раздвигают.');
for (const key of ['gd34', 'gd30e']) {
  const sys = SYS[key], bm = boreMin(sys), NI_need = circuit(sys).sum;
  const bores = sys.flangeMeasured ? [bm.stackMax + 5, bm.bore, bm.bore + 15, bm.bore + 25, 140] : [110, 120, 140, 150];
  console.log(`\n  ${sys.name}: наибольший диаметр пакета ⌀${bm.stackMax}` +
    (sys.flangeMeasured ? ' (замер пользователя)' : ' ⚠ НЕ ИЗМЕРЕН') + ` → расчётный bore ⌀${bm.bore}`);
  for (const { w, by } of boreScan(sys, bores)) {
    const a1 = by[150], a2 = by[180];
    console.log(`   bore ⌀${String(w.bore).padStart(3)}: ⌀внешн ${f(w.od, 0).padStart(3)} мм  L=${f(w.L * 1e6, 0).padStart(3)} мкГн  ` +
      `провод ${w.len.toFixed(1).padStart(4)} м (${w.mass.toFixed(2)} кг) │ 150 В: I=${f(a1.r.ipk / 1e3, 2)} кА, N·I=${f(a1.NI / 1e3, 0).padStart(3)} кА·вит ` +
      `(${f(a1.NI / NI_need, 1)}×), охват ${f(a1.cov * 100, 0)}%, на банку ${a1.sp.map(x => f(x.I, 0)).join('/')}, +${f(a1.dT, 1)} °C │ ` +
      `180 В: N·I=${f(a2.NI / 1e3, 0).padStart(3)} (${f(a2.NI / NI_need, 1)}×), охват ${f(a2.cov * 100, 0)}%, давление ${f(a2.press / 1e6, 2)} МПа`);
  }
}

// ── принятая конструкция ──
console.log(`\n════════ принята: bore ⌀${MAIN.bore} мм, ${MAIN.nL} слоя × ${MAIN.per} витков ════════`);
console.log(`  bore = наибольший диаметр пакета (магнит ⌀${BM.gd34.stackMax}) + 10 мм; фланцы ⌀${SYS.gd34.flangeOD}…${SYS.gd34.flangeOD + 1} по замеру — они меньше, не мешают`);
for (const pitch of [W.dIns, 4.2]) {
  const w = wind(MAIN.bore, MAIN.per, MAIN.nL, pitch);
  console.log(`\n  шаг ${pitch.toFixed(1)} мм (= диаметр с оплёткой): высота ${f(w.h, 0)} мм, ⌀внешн ${f(w.od, 0)} мм, ` +
    `L=${f(w.L * 1e6, 0)} мкГн, R=${f(w.R * 1e3, 1)} мОм, провод ${w.len.toFixed(1)} м, ${w.mass.toFixed(2)} кг`);
  for (const U of [120, 150, 180]) {
    const s = shot(w, U, 1);
    const need = Object.values(SYS).map(sys => `${sys.name.split(' ')[0]} ${f(circuit(sys).sum / 1e3, 0)} → ${f(s.NI / circuit(sys).sum, 1)}×`);
    const cov = Object.values(SYS).map(sys => `${sys.name.split(' ')[0]} охват ${f(EM.HmagAvg(w.layers, magOf(sys), s.NI) / MAT[sys.mat].Hsat * 100, 0)}%`);
    console.log(`  ${U} В: I=${f(s.r.ipk / 1e3, 2)} кА, N·I=${f(s.NI / 1e3, 0)} кА·вит (${need.join(', ')}, ${cov.join(', ')})` +
      `, T/2=${f(s.r.Thalf * 1e3, 1)} мс, на банку ${s.sp.map(x => f(x.I, 0)).join('/')} А, ` +
      `i²t VT1 ${f(s.r.i2tS / T253.i2t * 100, 1)}%, VD6 ${f(s.r.i2tD / 2 / VL200.i2t * 100, 1)}% на диод, ` +
      `+${f(s.dT, 1)} °C, давление ${f(s.press / 1e6, 2)} МПа, тяга к центру ~${f(pullToCenter(w, U) / 1e3, 0)} кН`);
  }
}

console.log(`\n  ⚠ единственное, что может помешать ⌀${MAIN.bore}, — внутренний диаметр стакана корзины (не промерян).` +
  ` Если он меньше, bore берут по нему или каркас делают разрезным; документ с таблицами — ../../katushki-10gd.html (генератор doc10gd.js).\n`);

// принятая катушка установки — чтобы показать, чем она накрывает остальные головки
const wMain = wind(MAIN.bore, MAIN.per, MAIN.nL);

// ── весь список МС: что нужно каждой головке и чем её накрывает её собственная оснастка ──
console.log('\n════════ весь список МС ════════');
for (const [key, sys] of Object.entries(SYS)) {
  const bm = boreMin(sys), c = circuit(sys), NIwork = c.sum * 2.5;
  const rec = recommend(sys, { bore: bm.bore, U: 150, NIwork });
  console.log(`\n${sys.name} — ${sys.magnet}`);
  console.log(`  по цепи ${f(c.sum / 1e3, 0)} кА·витков, в работу ×2.5 = ${f(NIwork / 1e3, 0)}; приёмка B ≥ ${sys.BgapNom} Тл`);
  console.log(`  bore ⌀${bm.bore} (пакет ⌀${bm.stackMax}${sys.flangeMeasured ? ', фланцы по замеру' : ' — ⚠ фланцы не меряны, принят ⌀ магнита'})` +
    `, окно намотки ${sys.stackH} мм${sys.flangeMeasured ? '' : ' ⚠ оценка'}; витков в слое ≤ ${rec.perMax}`);
  console.log(`  оснастка: ${rec.nL} слоя × ${rec.per} = ${rec.w.N} витков, h=${f(rec.w.h, 0)} мм, ⌀внешн ${f(rec.w.od, 0)} мм, ` +
    `L=${f(rec.w.L * 1e6, 0)} мкГн, ${f(rec.w.mass, 2)} кг меди`);
  console.log(`  при 150 В: N·I=${f(rec.s.NI / 1e3, 0)} кА·витков (${f(rec.s.NI / NIwork, 2)} рабочей цели), I=${f(rec.s.r.ipk / 1e3, 2)} кА, ` +
    `T/2=${f(rec.s.r.Thalf * 1e3, 1)} мс, на банку ${rec.s.sp.map(x => f(x.I, 0)).join('/')}, охват поля ${f(cov(rec.w, sys, rec.s.NI) * 100, 0)}%`);
  if (!rec.reaches) console.log(`  ⚠ цели не берёт ни одна намотка из влезающих в окно: нужно ${Math.round(rec.need.U)} В или ${f(rec.need.C * 1e3, 1)} мФ`);
  if (rec.alt) console.log(`  вариант «меньше меди»: ${rec.alt.nL} × ${rec.alt.per} — ${f(rec.alt.w.mass, 2)} кг, ` +
    `N·I=${f(rec.alt.s.NI / 1e3, 0)}, но банк ${f(rec.alt.s.sp[0].I, 0)} А и T/2 ${f(rec.alt.s.r.Thalf * 1e3, 1)} мс`);
  const s150 = shot(wMain, 150, 1);
  console.log(`  принятая катушка ⌀${wMain.bore} (${wMain.nL}×${wMain.per}) на этой головке: N·I=${f(s150.NI / 1e3, 0)} кА·витков ` +
    `(${f(s150.NI / NIwork, 1)}× цели), охват ${f(cov(wMain, sys, s150.NI) * 100, 0)}%` +
    (bm.bore === wMain.bore ? ' — bore совпадает, допливать нечего'
      : bm.bore > wMain.bore ? ` — ⚠ НЕ НАДЕВАЕТСЯ: нужен bore ≥ ⌀${bm.bore}` : ` — запас ${f((wMain.bore - bm.bore) / 2, 0)} мм на сторону, связь с магнитом хуже`));
  const b = basketEffect(wMain, sys, s150.NI, s150.r.tpk);
  console.log(`  короткозамкнутый виток: ${sys.basket.note} ⇒ ` + (b
    ? `есть — R=${f(b.R * 1e3, 2)} мОм, ток ${f(b.I, 0)} А, ${f(b.E, 0)} Дж = ${f(b.E / (0.5 * C0 * 150 ** 2) * 100, 0)}% банка, +${f(b.Rref * 1e3, 1)} мОм к цепи`
    : 'нет'));
  if (sys.basket.alt) {
    const ba = basketEffect(wMain, sys, s150.NI, s150.r.tpk, { kind: sys.basket.alt });
    console.log(`  ⚠ ${sys.basket.altNote}: R=${f(ba.R * 1e3, 2)} мОм, ток ${f(ba.I, 0)} А, ${f(ba.E, 0)} Дж, ` +
      `+${f(ba.Rref * 1e3, 1)} мОм к цепи — это уже короткий виток`);
  }
}

// ── побочные эффекты: что импульс делает с самим динамиком ──
console.log('\n════════ побочные эффекты ════════');
for (const key of Object.keys(SYS)) {
  const sys = SYS[key];
  const v = voiceCoil(sys, B_POLE / 3e-3);          // dB/dt на фронте ~1.5 Тл за 3 мс
  console.log(`${sys.name.split(' ')[0]}: выводы ЗК замкнуты → ЭДС ${f(v.emf, 0)} В, R=${f(v.R, 1)} Ом, ток ${f(v.I, 1)} А, ` +
    `сила на диффузор ~${f(v.F, 0)} Н. Разомкнуть выводы (и отключить фильтр).`);
}
for (const key of Object.keys(SYS)) {      // металлическая корзина = один короткозамкнутый виток вокруг мотора
  const w = wind(MAIN.bore, MAIN.per, MAIN.nL), s = shot(w, 150, 1), b = basketEffect(w, SYS[key], s.NI, s.r.tpk);
  if (!b) { console.log(`${SYS[key].name.split(' ')[0]}: ${SYS[key].basket.note} — короткозамкнутого витка нет`); continue; }
  const Eb = 0.5 * C0 * 150 ** 2;
  console.log(`корзина ${key}: кольцо у фланца r=${f(b.r * 1e3, 0)} мм` + (b.clamped ? ' (взято у стенки bore — фланец шире катушки)' : '') +
    `, R=${f(b.R * 1e3, 2)} мОм, L=${f(b.L2 * 1e6, 2)} мкГн, M=${f(b.M * 1e6, 2)} мкГн, B в её плоскости ${f(b.B, 2)} Тл → ` +
    `ЭДС ${f(b.emf, 1)} В, ток ${f(b.I, 0)} А, сила ~${f(b.F, 0)} Н, сгорит ${f(b.E, 0)} Дж = ${f(b.E / Eb * 100, 0)}% банка`);
  console.log(`     в цепи разряда это ещё и добавка ${f(b.Rref * 1e3, 1)} мОм отражённого сопротивления к ${f(wind(MAIN.bore, MAIN.per, MAIN.nL).R * 1e3, 1)} мОм обмотки`);
}
console.log('  это ОЦЕНКА СВЕРХУ: реакция короткозамкнутого витка гасит dI/dt, поэтому ток и сила будут меньше;');
console.log('  но порядок тот же — динамик держать за раму и считать корзину витком, который отъедает энергию.');

// ── если плотный bore не проходит: лесенка вариантов. Та же МДС, но связь с магнитной цепью хуже:
//    индикатор «воздушный охват» — поле в объёме магнита без стали, в % от нужного H_sat. ──
console.log(`\n════════ если ⌀${MAIN.bore} не проходит сквозь корзину: bore ⌀110 / ⌀120 / ⌀140 / ⌀150 ════════`);
for (const bore of [110, 120, 140, 150]) {
  const w = wind(bore, MAIN.per, MAIN.nL);
  console.log(`\n  bore ⌀${w.bore}: высота ${f(w.h, 0)} мм, ⌀внешн ${f(w.od, 0)} мм, L=${f(w.L * 1e6, 0)} мкГн, ` +
    `R=${f(w.R * 1e3, 1)} мОм, провод ${w.len.toFixed(1)} м, ${w.mass.toFixed(2)} кг`);
  for (const U of [150, 180, 250]) {
    const s = shot(w, U, 1);
    const cover = EM.HmagAvg(w.layers, magOf(SYS.gd34), s.NI) / MAT.ferrite.Hsat;
    console.log(`  ${U} В: I=${f(s.r.ipk / 1e3, 2)} кА, N·I=${f(s.NI / 1e3, 0)} кА·вит (${f(s.NI / circuit(SYS.gd34).sum, 1)}×), ` +
      `T/2=${f(s.r.Thalf * 1e3, 1)} мс, на банку ${s.sp.map(x => f(x.I, 0)).join('/')} А, «воздушный охват» магнита ${f(cover * 100, 0)}%`);
  }
}

// ── хватает ли провода ⌀3,3 мм: нагрев, предел по изоляции, силы в намотке, межвитковое напряжение ──
console.log('\n════════ провод ⌀3,3 мм: что его ограничивает ════════');
for (const [bore, per, nL, U] of [[MAIN.bore, 14, 2, 150], [MAIN.bore, 14, 2, 180], [MAIN.bore, 14, 2, 300]]) {
  const w = wind(bore, per, nL), s = shot(w, U, 1);
  const A = Math.PI / 4 * (W.dCu / 1e3) ** 2;             // м² меди
  const J = s.r.ipk / (A * 1e6);                          // А/мм² в пике
  const Ilim = s.r.ipk * Math.sqrt(110 / s.dT);           // ток, при котором обмотка дала бы +110 °C
  const wl = EM.MU0 * s.r.ipk ** 2 / (2 * Math.PI * (w.pitch / 1e3));   // Н/м между соседними витками слоя
  const p0 = Math.sqrt(wl * 58e9 / (Math.PI * (W.dCu / 4e3)));          // контакт Херца виток-о-виток (Cu, E*≈58 ГПа)
  const dU = w.L * (s.r.ipk / s.r.tpk) / w.N;             // В на виток (L·dI/dt, делённое на витки)
  console.log(`  ⌀${bore} ${nL}×${per} при ${U} В (I=${f(s.r.ipk / 1e3, 2)} кА): J=${f(J, 0)} А/мм², +${f(s.dT, 1)} °C/выстрел →` +
    ` до +110 °C ток дорасти должен в ${f(Ilim / s.r.ipk, 1)}× (до ${f(Ilim / 1e3, 0)} кА)`);
  console.log(`     соседние витки давят друг на друга ${f(wl, 0)} Н/м (контакт ~${f(p0 / 1e6, 0)} МПа — это оценка сверху, считаю по меди: оплётка мягче, реально в разы меньше, но всё равно впритык + пропитка + бандаж),` +
    ` напряжение между витками ~${f(dU, 1)} В`);
}
