// Точная модель заряда банка от сети через фазовый регулятор и балласт: каждый
// полупериод, окно проводимости [α, π−α]. Второй раздел — выбор вторички T1 под
// схему §5.1 (числа таблиц «верх диапазона → вторичка» и «режим заряда»).
const w = 2 * Math.PI * 50, f = (x, d = 1) => x.toLocaleString('ru-RU', { maximumFractionDigits: d, minimumFractionDigits: d });

// Заряд банки C до Utarget: источник с пиком Vm через балласт R. Считает время,
// токи вторички и ВА — на этом стоят строки §5.1.
function charge(C, R, Vm, Utarget, Usec = 275, label = '', quiet = true) {
  let U = 0, t = 0, n = 0, I2 = 0, IrmsMax = 0, VAmax = 0, rec = [];
  while (U < Utarget && n < 200000) {
    const a = Math.min(Math.asin(Math.min(1, U / Vm)), Math.PI / 2);
    const q = (2 * Vm * Math.cos(a) - U * (Math.PI - 2 * a)) / R;      // ∫ i dx over the window
    // ∫ i² dx по окну — аналитически (i = (Vm·sin x − U)/R), чтобы прогон был мгновенным
    const s2 = (Vm * Vm * ((Math.PI - 2 * a) / 2 + Math.sin(2 * a) / 2) - 4 * Vm * U * Math.cos(a) + U * U * (Math.PI - 2 * a)) / (R * R);
    const irms = Math.sqrt(s2 / Math.PI);
    IrmsMax = Math.max(IrmsMax, irms); VAmax = Math.max(VAmax, irms * Usec);
    if (n % 500 === 0 || U > Utarget - 1) rec.push({ U: +U.toFixed(0), t: +t.toFixed(0), irms: +irms.toFixed(2), a: +(a * 180 / Math.PI).toFixed(0), win_ms: +((Math.PI - 2 * a) / w * 1e3).toFixed(1) });
    U += q / (w * C); t += 0.01; I2 += s2 / Math.PI; n++;
  }
  const tau = R * C, texpl = -tau * Math.log((Vm - Utarget) / Vm);
  if (!quiet) {
    console.log(`\n${label} C=${f(C * 1e3, 0)} мкФ, R=${R} Ом (балласт), пик=${Vm} В → ${Utarget} В`);
    console.log(`  точная модель: ${f(t, 0)} с; экспоненциальная оценка τ=RC: ${f(texpl, 0)} с;  I ср = ${f(C * Utarget / t, 2)} А`);
    console.log(`  вторичка: Irms max ${f(IrmsMax, 2)} А (старт), по заряду ${f(Math.sqrt(I2 / n), 2)} А → VA max ${f(VAmax, 0)} ВА`);
    console.log('  трек: ' + rec.filter((r, i) => i % 3 === 0).slice(0, 9).map(r => `${r.U}В@${r.t}с(α${r.a}°, Irms ${r.irms})`).join('  '));
  }
  return { full: U >= Utarget, t, texpl, irmsMax: IrmsMax, irmsAvg: Math.sqrt(I2 / Math.max(n, 1)), vaMax: VAmax, Iavg: C * Utarget / t, rec };
}

// ── Параметры, которые задаёт конструкция (числа §5.1) ─────────────────────────
const BANK = 47e-3;    // 10 × EPCOS B43560-S9478-M1 (4700 мкФ/400 В), Ф
const UMAX = 400;       // рабочее напряжение конденсаторов, В
const RBALL = 242;      // балласт: 2 лампы 100 Вт / 220 В параллельно (горячие), Ом
const RLOAD = 0.02;     // медь вторички + мост + банка, Ом
const LLEAK = 0.006;    // поток рассеяния обмотки, Гн (оценка; §8 п. 11 — перемерить)
const UDROP = 5;        // 2 диода моста (2 В) + вилка и колодка при большом токе (3 В), В
const TMAX = 60;        // разумное время заряда до верха диапазона, с
const FU_STD = [4, 5, 6.3, 10, 16, 20];   // ряд плавких вставок, А
const FU_K = 5;         // вставка не меньше 5× рабочего тока: маленькая «стекляшка» греется и уплывает уже на 3×
const U_RANGE = [220, 230, 253];     // сеть, В
const K_LOW = 127.5 / 230;   // режим «127 В»: половины катушек по отводам a и b, 2×63,75 В (127,5 В)
const K_MAIN = 255 / 230;    // принятая вторичка целиком: 255 В (режим «255 В»)
const TOP = 300;        // верх рабочего диапазона, В     // сеть, В: просадка, номинал, верх разброса

// Пик на полностью открытом регуляторе. Банка добирается до него короткими
// импульсами, поэтому из пика вычитаются только падения (мост + контакт), а
// сопротивление обмотки влияет на скорость набора, не на потолок.
const vpeak = (u, k) => Math.max(0, u * k * Math.SQRT2 - UDROP);
const angle = (U, Vm) => (U > Vm ? NaN : (Math.asin(U / Vm) * 180) / Math.PI);
const kminFor = (Utop, tmax = TMAX) => {                          // нижняя граница: успеть зарядиться
  for (let k = 0.6; k < 1.6; k += 0.005) if (charge(BANK, RBALL, vpeak(230, k), Utop, 230 * k).t <= tmax) return Math.round(k * 200) / 200;
  return NaN;
};
const kmaxFor = (u = U_RANGE[2]) => Math.round(((UMAX + UDROP) / (u * Math.SQRT2)) * 200) / 200;  // верхняя: полное КЗ диммера ≤ UMAX

// Верх диапазона → окно вторичек и что берёт полное КЗ регулятора на границе окна.
function windTop(Utop) {
  const kmin = kminFor(Utop), kmax = kmaxFor();
  return { Utop, kmin, kmax, ok: kmin <= kmax, secMin: kmin * 230, secMax: kmax * 230,
    pkAtKmax: vpeak(U_RANGE[2], kmax), pkAtKmin: vpeak(U_RANGE[2], kmin) };
}

// Полная сводка по выбранной вторичке (top — верх рабочего диапазона).
function row(k, top) {
  const { rlc } = require('./charge.js');
  const pk = {}; for (const u of U_RANGE) pk[u] = vpeak(u, k);
  const q = (u, target) => charge(BANK, RBALL, vpeak(u, k), target, u * k, '', true);
  const nom = q(230, top), hi = q(253, top), lo = q(220, top), q300 = q(230, 300), q180 = q(230, 180);
  const d = rlc(RLOAD, LLEAK, pk[253], BANK), dMin = rlc(RLOAD, LLEAK, pk[220], BANK);
  const i1 = Math.max(hi.vaMax / 253, lo.vaMax / 220, nom.vaMax / 230);
  return {
    k, sec: 230 * k, pk, top, aTop: angle(top, pk[230]), a300: angle(300, pk[230]), a180: angle(180, pk[230]),
    tTop: nom.t, tTopHi: hi.t, tTopLo: lo.t, t300: q300.t, t180: q180.t,
    irms: nom.irmsMax, irmsAvg: nom.irmsAvg, va: nom.vaMax, irmsHi: hi.irmsMax, irmsLo: lo.irmsMax,
    i1, fuse: FU_STD.find((x) => x >= FU_K * i1) || '>20', shortHi: d, shortLo: dMin,
  };
}

// Строка режима вторички (обе катушки целиком или половины по отводам): вершина, углы, время и токи.
function tapRow(k, targets) {
  const { rlc } = require('./charge.js');
  const pk = {}; for (const u of U_RANGE) pk[u] = vpeak(u, k);
  const d = rlc(RLOAD, LLEAK, pk[253], BANK);
  const per = targets.map((U) => {
    const q = charge(BANK, RBALL, pk[230], U, 230 * k, '', true);
    const lo = charge(BANK, RBALL, pk[220], U, 220 * k, '', true);
    return { U, t: q.t, tLo: lo.t, a: angle(U, pk[230]), irms: q.irmsMax, va: q.vaMax };
  });
  const i1 = Math.max(...per.map((x) => x.va / 230), ...per.map((x) => x.va / 220));
  return { k, sec: 230 * k, pk, per, short: d, i1, fuse: FU_STD.find((x) => x >= FU_K * i1) || '>20' };
}

function design() {
  const { rlc } = require('./charge.js');
  const p = (x, n = 2) => String(x).replace('.', ',');
  const s = (x, n = 0) => String(Math.round(x)).padStart(n);
  const e = (u) => (0.5 * BANK * u * u / 1000).toFixed(2);
  console.log('\nВТОРИЧКА T1 под эту схему. Ограничения, которые её определяют:');
  console.log('  1) на полностью открытом регуляторе при максимально возможной сети (253 В) пик на банке не выше');
  console.log('     рабочего напряжения конденсаторов — иначе забытый в упор регулятор стоит банка;');
  console.log(`  2) до верха рабочего диапазона банка должна заряжаться за ${TMAX} с на 230 В: ближе к пику каждого`);
  console.log('     полупериода остаётся всё меньше, и время растёт быстрее, чем напряжение.');
  console.log(`  Пик на открытом регуляторе = 1,414·U₂ − ${UDROP} В (мост + вилка). Предел конденсаторов ${UMAX} В.\n`);
  console.log('  верх диапазона | вторичка нужна, В | коэффициент k | пик при 253 В на этих границах | вывод');
  for (const Utop of [300, 330, 350, 395]) {
    const r = windTop(Utop);
    console.log(`  ${s(Utop, 3)} В, ${e(Utop)} кДж | ${f(r.secMin, 0)}…${f(r.secMax, 0)} | ${f(r.kmin, 3)}…${f(r.kmax, 3)} | ${s(r.pkAtKmin)} … ${s(r.pkAtKmax)} В | ${r.ok ? `окно ${Math.round(r.kmin * 230)}…${Math.round(r.kmax * 230)} В реально; принято ${Math.round(K_MAIN * 230)} В (k=${f(K_MAIN, 3)}): верх окна жрёт запас до предела ${UMAX} В, при 253 В у нас пик ${s(vpeak(253, K_MAIN))} В` : 'нет решения: не зарядиться за ${TMAX} с, не выходя из предела конденсаторов'.replace('${TMAX}', TMAX)}`);
  }
  console.log('\n  Одна обмотка на весь диапазон не может ни быстрого верха, ни безопасности — поэтому вторичка мотается');
  console.log('  двумя симметричными катушками по 127,5 В: последовательно (режим «255 В», 220…300 В, оснастка на');
  console.log('  якоре) и по половине каждой катушки от отводов (режим «127 В», 120…160 В, оснастки под собранные');
  console.log('  головки). Катушки соединены последовательно (выводы 2–3 на колодке T1); режим выбирает');
  console.log('  сдвоенный переключатель: «255» — выводы 1 и 4, «127» — отводы a и b, «0» — разомкнуто.\n');
  for (const [k, targets] of [[K_LOW, [120, 150, 160]], [K_MAIN, [220, 260, 300]]]) {
    const r = tapRow(k, targets);
    console.log(`  режим ${Math.round(r.sec)} В (k = ${p(r.k.toFixed(3), 3)}): вершина на банке ${Math.round(r.pk[220])} / ${Math.round(r.pk[230])} / ${Math.round(r.pk[253])} В при 220 / 230 / 253 В в сети`);
    console.log(`    весь ход регулятора 0…${Math.round(r.per[r.per.length - 1].a)}° закрыт напряжением ${Math.round(r.per[r.per.length - 1].U)} В — дальше только медленнее`);
    for (const x of r.per) console.log(`    ${s(x.U, 3)} В: диммер на ${s(x.a)}°, заряд ${s(x.t, 3)} с (при 220 В в сети — ${s(x.tLo)} с), вторичка ${f(x.irms, 2)} А, ${Math.round(x.va)} ВА`);
    console.log(`    потолок режима = пик ${Math.round(r.pk[230])} В: до ${Math.round(r.pk[230]) - 20} В доходит за ${s(charge(BANK, RBALL, r.pk[230], Math.round(r.pk[230]) - 20, 230 * k).t)} с, ${Math.round(r.pk[230]) + 5} В — ${charge(BANK, RBALL, r.pk[230], Math.round(r.pk[230]) + 5, 230 * k).full ? 'берётся' : 'не берётся'} при открытом регуляторе`);
    console.log(`    полное КЗ регулятора, балласт вытащен совсем (только поток рассеяния): удар в банк ${Math.round(r.short.Ipk_A)} А за ${Math.round(r.short.dur_ms)} мс (i²t ${p(r.short.It2_kA2s)} кА²·с); с дросселем L1 200 мГн в цепи — ${Math.round(rlc(RLOAD, 0.2, r.pk[253], BANK).Ipk_A)} А`);
    console.log(`    в сети до ${r.i1.toFixed(2)} А → FU1 ${r.fuse}`);
  }
  ballast();
}

// Сканирование балласта для принятой обмотки: время заряда, токи и что горит в самом балласте.
function ballast(k = K_MAIN, Utop = TOP) {
  const rl_ohm = (x) => x;
  const p = (x, n = 2) => String(x).replace('.', ',');
  const e = (u) => (0.5 * BANK * u * u / 1000).toFixed(2);
  console.log(`\n  Балласт при обмотке ${Math.round(230 * k)} В (пик ${Math.round(vpeak(230, k))} В, банк ${e(TOP)} кДж, ${Utop} В):`);
  console.log('  балласт, Ом | ток в начале | заряд до 300 В | вторичка max | VA вторички | мощность на балласте');
  for (const R of [75, 121, 161, 242, 330, 484]) {
    const q = charge(BANK, R, vpeak(230, k), Utop, 230 * k, '', true);
    const iPer = Math.sqrt(q.irmsMax ** 2 / 2);            // среднее действующее за период (полуволна раз в период)
    console.log(`  ${String(R).padStart(11)} | ${f(q.irmsMax, 2)} А | ${String(Math.round(q.t)).padStart(13)} с (оценка τ=RC: ${Math.round(q.texpl)} с) | ${f(q.irmsMax, 1)} А | ${String(Math.round(q.vaMax)).padStart(12)} ВА | ${Math.round(iPer * iPer * R)} Вт`);
  }
}

// Пуск без аргументов — выбор вторички; с аргументами — старый прогон сравнения моделей.
if (require.main === module) {
  if (process.argv.length > 2) {
    for (const C of [47e-3, 51.7e-3, 23.5e-3])
      for (const [R, U] of [[75, 300], [75, 320]])
        charge(C, R, 395, U, 275, C > 50e-3 ? '[11×4700]' : C > 40e-3 ? '[10×4700]' : '[5×4700]', false);
  } else design();
}

module.exports = { charge, design, row, tapRow, ballast, windTop, vpeak, angle, kminFor, kmaxFor, BANK, UMAX, RBALL, RLOAD, LLEAK, UDROP, TMAX, U_RANGE };
