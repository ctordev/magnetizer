// Генератор документа «Катушки под 10ГД-34 и 10ГД-30Е» → ../../katushki-10gd.html
// Все числа — из тех же модулей, что и консольный прогон: ./motors.js (магнитная цепь), ./winding.js
// (намотка и режим). Правки цифр в HTML вручную не делаются: меняется генератор, файл перегенерируется.
//
// Пуск: node calc/coils/doc10gd.js
const fs = require('fs'), path = require('path');
const WEBCALC = fs.readFileSync(path.join(__dirname, 'webcalc.js'), 'utf-8');   // вшивается в документ как есть
const EM = require('../src/em.js');
const { SYS, MAT, circuit, voiceCoil, B_POLE, boreMin } = require('./motors.js');
const WND = require('./winding.js');                                  // их исходники выкладываем в браузер
const RLC = require('../src/rlc.js');
const { W, C0, f, wind, magOf, shot, pullToCenter, boreScan, basketEffect, BASKET, cov, recommend } = WND;

const US = [120, 150, 180, 200, 300];
// bore = наибольший диаметр пакета + 10 мм (по 5 мм на сторону). У 10ГД-34 по замеру пользователя
// фланцы на 1…2 мм меньше магнита, поэтому пакет ⌀85 — это само кольцо феррита, а не фланец.
const BM = {}; for (const k of Object.keys(SYS)) BM[k] = boreMin(SYS[k]);   // bore каждой головки — от её пакета
const short = (k) => SYS[k].name.split(' (')[0];                             // «10ГД-34» без второго индекса
const num = (x) => (+x).toLocaleString('ru-RU', { maximumFractionDigits: 2, minimumFractionDigits: 0 });  // размеры — как в паспорте: 24,45 / 0,85
const MAIN = { bore: BM.gd34.bore, per: 14, nL: 2 };    // принятая катушка
const TIGHT = BM.gd34.stackMax + 5;                     // вплотную к магниту (2,5 мм на сторону)
const PREV_BORE = 120;                              // прежняя ревизия: bore закладывали «на фланцы» ⌀100/110
const OVER = [110, 120, 140, 150];                      // если плотный bore не проходит в проём корзины
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const tbl = (head, rows, cls) => {
  const t = `<table${cls ? ` class="${cls}"` : ''}><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${
    rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;
  return cls === 'dense' ? `<div class="tscroll">${t}</div>` : t;   // широкие таблицы — со скроллем, если экран узкий
};
const nbsp = s => String(s).replace(/ /g, '&nbsp;');

// ── расчёты, из которых потом собираются таблицы ──
const need = {}; for (const k of Object.keys(SYS)) need[k] = circuit(SYS[k]);
const wMain = wind(MAIN.bore, MAIN.per, MAIN.nL);
const sh = {}; for (const U of US) { sh[U] = { one: shot(wMain, U, 1), load: shot(wMain, U, 2.5) }; }

// ── живой калькулятор в документе: в страницу выкладываем ТЕ ЖЕ функции, что считает node, ──
// ── «своей» модели в HTML нет; совпадение проверяет calcCheck() на контрольных точках ниже. ──
const BUNDLE = [
  'const MU0 = 4 * Math.PI * 1e-7, PI = Math.PI;',
  '/* ── calc/src/em.js — исходник как есть ── */',
  ['KE', 'Mloop', 'HzLoop', 'Lwind', 'Hpoint', 'HmagAvg'].map(n => EM[n].toString()).join('\n'),
  'const EM = { MU0, Lwind, Hpoint, HmagAvg };',
  '/* ── calc/src/rlc.js — исходник как есть ── */',
  `const Rs = ${RLC.Rs}, VF = ${RLC.VF}, VSCR = ${RLC.VSCR}, IH = ${RLC.IH}, dt = ${RLC.dt};`,
  `const T253 = ${JSON.stringify(RLC.T253)}, VL200 = ${JSON.stringify(RLC.VL200)};`,
  `const BANK_PARTS = ${JSON.stringify(RLC.BANK_PARTS)};`,
  RLC.sim.toString(), RLC.splitParts.toString(), RLC.split.toString(),
  '/* ── calc/coils/winding.js — исходник как есть ── */',
  `const W = ${JSON.stringify(W)}, C0 = ${C0}, Radd = ${WND.Radd}, BASKET = ${JSON.stringify(BASKET)}, MAT = ${JSON.stringify(MAT)};`,
  ['wind', 'magOf', 'shot', 'cov', 'recommend', 'pullToCenter', 'basketEffect'].map(n => WND[n].toString()).join('\n'),
].join('\n\n');

// контрольные точки: их считает node, страница обязана повторить (calcCheck)
const SELFTEST = [[MAIN.bore, 14, 2, W.dIns, W.dCu, 120, 1], [MAIN.bore, 14, 2, W.dIns, W.dCu, 180, 2.5],
  [90, 12, 1, 3.1, 2.5, 150, 1], [110, 14, 3, 4.2, 4.0, 250, 1.5], [140, 20, 2, 5.0, 5.0, 90, 1]].map(([bore, per, nL, pitch, dCu, U, kL]) => {
  const w = wind(bore, per, nL, pitch, dCu), s = shot(w, U, kL, 0.0262);
  return [bore, per, nL, pitch, dCu, U, kL, 26.2, +(w.L * 1e6).toFixed(3), +s.r.ipk.toFixed(1), +s.NI.toFixed(0)];
});
// стартовые значения калькулятора = рекомендованная намотка (тот же recommend)
const PREFILL = {}, REC = {};
for (const k of Object.keys(SYS)) {
  const r = recommend(SYS[k], { bore: BM[k].bore, U: 150, NIwork: need[k].sum * 2.5 });
  REC[k] = r;
  PREFILL[k] = { bore: BM[k].bore, per: r.per, nl: r.nL, pitch: W.dIns, dcu: W.dCu, u: 150, c: +(C0 * 1e3).toFixed(1), kl: 1 };
}
const BORES = [TIGHT, MAIN.bore, ...OVER];
// пресеты диаметра в калькуляторе: свой bore каждой головки (впритык и с запасом) плюс лесенка из §4
function presetOptions() {
  const byValue = new Map();
  const add = (v, label) => byValue.set(v, (byValue.get(v) ? byValue.get(v) + ' / ' : '') + label);
  for (const k of Object.keys(SYS)) {
    add(BM[k].stackMax + 5, `${short(k)} — впритык`);
    add(BM[k].bore, `${short(k)} — пакет + 5 мм на сторону`);
  }
  for (const b of OVER) add(b, `из §4`);
  return [...byValue.entries()].sort((a, b) => a[0] - b[0])
    .map(([v, label]) => `      <option value="${v}">⌀${v} — ${label}${v === MAIN.bore ? ' (принято)' : ''}</option>`).join('\n');
}

// ── разрез: мотор + катушка. Ось — вертикальная, показана правая половина (зеркало — scale(-1,1)) ──
function section(sys, w) {
  const S = 3.2, PAD = 6, PBOT = 12;                       // мм → px; PAD сверху, PBOT снизу (под подписи)
  const z0 = 0, parts = [];
  const r = mm => mm / 2;
  const rect = (r0, r1, z1, z2, fill, note = '') =>
    `<rect x="${(r0 * S).toFixed(1)}" y="${((z1 + PAD) * S).toFixed(1)}" width="${((r1 - r0) * S).toFixed(1)}" height="${((z2 - z1) * S).toFixed(1)}" fill="${fill}" stroke="#0b0f14" stroke-width=".7">${note ? `<title>${esc(note)}</title>` : ''}</rect>`;
  let gapZ, magZ;
  if (sys.mat === 'ferrite') {
    const fl = r(sys.flangeOD), t = 6;
    parts.push(rect(0, fl, z0, z0 + t, '#4a5568', 'нижний фланец (сталь)'));
    magZ = [z0 + t, z0 + t + sys.ring.t];
    parts.push(rect(r(sys.ring.id), r(sys.ring.od), magZ[0], magZ[1], '#8a5a3c', sys.magnet));
    parts.push(rect(0, fl, magZ[1], magZ[1] + t, '#4a5568', 'верхний фланец с отверстием ⌀' + num(sys.flangeHole) + ' мм'));
    gapZ = [magZ[1] + t, magZ[1] + t + sys.gap.h];
    parts.push(rect(0, r(sys.coreOD), gapZ[0], gapZ[1], '#6b7688', 'керн ⌀' + num(sys.coreOD) + ' мм'));
    parts.push(rect(r(sys.coreOD), r(sys.coreOD) + sys.gap.w, gapZ[0], gapZ[1], '#e8edf4', `рабочий зазор ${num(sys.gap.h)} × ${num(sys.gap.w)} мм`));
  } else {
    const fl = r(sys.flangeOD), t = 6, l = sys.lAlnico;
    parts.push(rect(0, fl, z0, z0 + t, '#4a5568', 'нижний фланец (сталь)'));
    magZ = [z0 + t, z0 + t + l];
    parts.push(rect(0, r(sys.coreOD), magZ[0], magZ[1], '#9c6b2f', 'альнико ЮНДК-24 — он же керн'));
    parts.push(rect(0, r(sys.coreOD), magZ[1], magZ[1] + sys.gap.h, '#6b7688', 'стальной наконечник в зазоре'));
    gapZ = [magZ[1], magZ[1] + sys.gap.h];
    parts.push(rect(sys.flangeHole / 2, fl, gapZ[0], gapZ[1], '#4a5568', 'верхний фланец с отверстием ⌀' + sys.flangeHole + ' мм'));
    parts.push(rect(r(sys.coreOD), sys.flangeHole / 2, gapZ[0], gapZ[1], '#e8edf4', `рабочий зазор ${num(sys.gap.h)} × ${num(sys.gap.w)} мм`));
  }
  // обмотка: центр на середине магнита
  const zc = (magZ[0] + magZ[1]) / 2, z1 = zc - w.h / 2, z2 = zc + w.h / 2;
  const wr0 = w.bore / 2, wr1 = wr0 + w.nL * (w.pitch / 1e3) * 1e3;
  parts.push(rect(wr0, wr1, z1, z2, '#c0504d', `обмотка: ${w.nL} слоя × ${w.per} витков, bore ⌀${w.bore}`));

  // подписи — в одну колонку справа от чертежа, с выносками; по вертикали расходятся автоматически
  const maxR = Math.max(sys.flangeOD / 2, wr1);
  const colX = maxR + 10;                                   // мм, куда ставят выноски
  let marks = [
    { z: zc, x: wr1, fill: '#f0b0ac', txt: `намотка ${w.nL}×${w.per}: bore ⌀${w.bore}, ⌀внешн. ${w.od.toFixed(0)}, высота ${w.h.toFixed(0)} мм` },
    { z: z0 + 3, x: sys.flangeOD / 2, fill: sys.flangeMeasured ? '#9fb0c8' : '#ffb060',
      txt: sys.flangeMeasured ? `фланцы ⌀${sys.flangeOD}…${sys.flangeOD + 1} (замер — меньше магнита)` : `фланцы ⌀${sys.flangeOD} — ⚠ промерить` },
    { z: (magZ[0] + magZ[1]) / 2 + 6, x: (sys.mat === 'ferrite' ? sys.ring.od : sys.coreOD) / 2, fill: '#ffd9a0',
      txt: sys.mat === 'ferrite' ? `феррит К${num(sys.ring.od)}×${num(sys.ring.id)}×${num(sys.ring.t)}` : `альнико, длина ⚠ ${sys.lAlnico} мм` },
    { z: gapZ[1] + 3, x: r(sys.coreOD) + sys.gap.w, fill: '#e8edf4', txt: `рабочий зазор ${num(sys.gap.h)} × ${num(sys.gap.w)} мм` },
    { z: gapZ[0] - 6, x: sys.mat === 'ferrite' ? r(sys.coreOD) : r(sys.coreOD), fill: '#9fb0c8', txt: `керн ⌀${num(sys.coreOD)}` },
  ].sort((a, b) => a.z - b.z);
  const step = 17 / S;                                     // минимальный шаг подписей, мм (17px ≥ bbox 15px + зазор)
  let prev = -1e9;                                         // раздвигаем подписи по вертикали, чтобы не сливались
  marks = marks.map(m => { const zl = Math.max(m.z, prev + step); prev = zl; return { ...m, zl }; });
  const labels = marks.map(m =>
    `<line x1="${(m.x * S).toFixed(0)}" y1="${((m.z + PAD) * S).toFixed(0)}" x2="${(colX * S).toFixed(0)}" y2="${((m.zl + PAD) * S).toFixed(0)}" stroke="${m.fill}" stroke-width=".7" opacity=".7"/>` +
    `<text x="${((colX + 2) * S).toFixed(0)}" y="${((m.zl + PAD) * S + 3.5).toFixed(0)}" fill="${m.fill}" font-size="11">${esc(m.txt)}</text>`).join('');
  const zmaxPx = (Math.max(gapZ[1], z2, marks[marks.length - 1].zl) + PAD + PBOT) * S;
  const wpx = (colX + 2) * S + 300;
  return `<svg class="cut" viewBox="0 0 ${wpx.toFixed(0)} ${zmaxPx.toFixed(0)}" role="img" aria-label="Осевой полуразрез: ${esc(sys.name)} с намоткой ⌀${w.bore}">
<line x1="0" y1="0" x2="0" y2="${zmaxPx.toFixed(0)}" stroke="#9fb0c8" stroke-dasharray="5 4"/>${parts.join('')}<text x="4" y="${(zmaxPx - PBOT * S).toFixed(0)}" fill="#9fb0c8" font-size="10">ось</text>${labels}</svg>`;
}

// ── таблицы ──
const srcData = tbl(['параметр', '10ГД‑34 (25ГДН‑1‑4)', '10ГД‑30Е (20ГДН‑1‑8)'], [
  ['магнит', `кольцевой феррит М25РА170 К${SYS.gd34.ring.od}×${SYS.gd34.ring.id}×${SYS.gd34.ring.t}, намагничен осевo`, 'керновый альнико ЮНДК‑24: керн и есть магнит, в зазоре стальной наконечник'],
  ['керн', `⌀${SYS.gd34.coreOD} мм (паспорт; по замерам 27,3)`, `⌀${SYS.gd30e.coreOD} мм`],
  ['верхний фланец', `отверстие ⌀${SYS.gd34.flangeHole} мм`, `⌀${SYS.gd30e.flangeHole} мм`],
  ['наружный диаметр фланцев', `<b>⌀${SYS.gd34.flangeOD}…${SYS.gd34.flangeOD + 1} мм — замер</b>: на 1…2 мм меньше ⌀ магнита, то есть фланцы НЕ задают габарит пакета`,
   `⚠ не измерен — у этой системы фланец заведомо больше керна (зазор между ⌀${SYS.gd30e.coreOD} и ⌀${SYS.gd30e.flangeHole}), в расчёт пока взят ⌀${SYS.gd30e.flangeOD}`],
  ['наибольший диаметр пакета ⇒ bore катушки', `<b>⌀${BM.gd34.stackMax}</b> — это кольцо магнита ⇒ bore ≥ ⌀${BM.gd34.bore}`,
   `⚠ ⌀${BM.gd30e.stackMax} (по принятому фланцу) ⇒ bore ≥ ⌀${BM.gd30e.bore}`],
  ['рабочий зазор', `${SYS.gd34.gap.h} × ${SYS.gd34.gap.w} мм (замер; паспорт 8 × 1,1)`, `${SYS.gd30e.gap.h} × ${SYS.gd30e.gap.w} мм`],
  ['B в зазоре по паспорту', `<b>${f(SYS.gd34.BgapNom, 2)} Тл</b>`, `<b>${f(SYS.gd30e.BgapNom, 2)} Тл</b>`],
  ['корзина', 'литьё из алюминиевого сплава', 'литьё из алюминиевого сплава'],
  ['звуковая катушка', `ПЭЛ ⌀${SYS.gd34.vc.dWire}, ${SYS.gd34.vc.turns} витков, высота намотки ${SYS.gd34.vc.hWind} мм`, `каркас ⌀${SYS.gd30e.vc.id}, высота намотки ${SYS.gd30e.vc.hWind} мм (провода в паспорте нет)`],
  ['требуемое поле намагничивания', `${f(MAT.ferrite.Hsat / 1e6, 2)} МА/м (4·HcJ)`, `${f(MAT.alnico.Hsat / 1e6, 2)} МА/м (у альнико мягкое «колено», правило 3·Hc оптимистично)`],
  ['<b>неизвестно — промерять</b>', `<b>внутренний диаметр проёма корзины</b>, через который катушка надевается на пакет (⚠ при ⌀${BM.gd34.bore} он должен быть не меньше)`,
   `<b>⌀ фланцев</b> и <b>длина альнико‑стержня</b> (принято ${SYS.gd30e.lAlnico} мм, МДС растёт с ней линейно)`],
]);

function mmfTable(k) {
  const c = need[k];
  return tbl(['участок магнитной цепи', 'длина', 'H, кА/м', 'МДС, кА·витков'],
    c.rows.map(([n, H, l, F]) => [n, l ? f(l * 1e3, 0) + ' мм' : '—', H ? f(H / 1e3, 0) : '—', f(F / 1e3, 1)])
      .concat([[`<b>итого по цепи</b>`, '', '', `<b>${f(c.sum / 1e3, 0)}</b>`]]));
}

const BASKET_SHORT = { 'cast-al': 'литой Al', 'steel-stamped': 'штамп. сталь', 'al-cover': 'алюм. кожух', plastic: 'пластмасса' };

function listTable() {
  return tbl(['головка (второй индекс)', 'магнит по паспорту', 'керн ⌀ / ⌀ отверстия / зазор', 'B в зазоре',
    'корзина ⇒ короткий виток', 'габарит пакета ⇒ bore', 'окно намотки', 'МДС по цепи ⇒ цель ×2,5',
    'оснастка, которую подберёт §10 (при 150 В)', 'что не измерено'],
    Object.keys(SYS).map(k => {
      const sys = SYS[k], bm = BM[k], r = REC[k], c = need[k];
      return [`${short(k)}<br><span class="hint">${(sys.name.match(/\(([^)]*)\)/) || [])[1] || ''}</span>`,
        sys.magnet,
        `⌀${num(sys.coreOD)} / ⌀${num(sys.flangeHole)} / ${num(sys.gap.h)}×${num(sys.gap.w)} мм`,
        `${f(sys.BgapNom, 2)} Тл`,
        `${BASKET_SHORT[sys.basket.kind] || sys.basket.kind} ⇒ <b>${sys.basket.kind === 'plastic' ? 'нет' : 'есть'}</b>`,
        `⌀${bm.stackMax}${sys.flangeMeasured ? ' (замер)' : ' ⚠'} ⇒ <b>bore ≥ ⌀${bm.bore}</b>`,
        `${sys.stackH} мм${sys.flangeMeasured ? '' : ' ⚠'}`,
        `${f(c.sum / 1e3, 0)} ⇒ <b>${f(c.sum * 2.5 / 1e3, 0)}</b> кА·вит`,
        `${r.nL} × ${r.per} = ${r.w.N} витков, ⌀внешн. ${f(r.w.od, 0)} мм, L ${f(r.w.L * 1e6, 0)} мкГн → ` +
          `<b>${f(r.s.NI / 1e3, 0)} кА·вит</b> (${f(r.s.NI / (c.sum * 2.5), 2)} цели), ${f(r.s.r.ipk / 1e3, 2)} кА`,
        sys.flangeMeasured ? 'внутренний ⌀ проёма корзины' : '⚠ ⌀ фланцев, высота пакета, проём корзины'];
    }), 'dense');
}

// принятая катушка установки против каждой головки из списка: наденется, хватит ли МДС, каков охват
function fitTable() {
  return tbl(['головка', 'bore нужен ≥', `принятая катушка ⌀${wMain.bore} (${wMain.nL}×${wMain.per}) на неё`,
    'цель ×2,5, кА·вит', 'МДС при 120 В', 'при 150 В', 'при 180 В', 'охват поля при 150 В, %', 'что делать'],
    Object.keys(SYS).map(k => {
      const sys = SYS[k], bm = BM[k], work = need[k].sum * 2.5;
      const s = [120, 150, 180].map(U => shot(wMain, U, 1));
      const fits = wMain.bore >= bm.bore, cv = cov(wMain, sys, s[1].NI) * 100;
      return [`<b>${short(k)}</b>`, `⌀${bm.bore}`, fits
          ? `надевается: ${num((wMain.bore - bm.stackMax) / 2)} мм на сторону`
          : '<span class="bad">не надевается</span> — нужна отдельная оснастка',
        f(work / 1e3, 0),
        ...s.map(x => `${f(x.NI / 1e3, 0)} (${f(x.NI / work, 1)}×)`),
        f(cv, 0),
        !fits ? `мотать ⌀${bm.bore} × ${REC[k].nL}×${REC[k].per} (см. §10)`
          : bm.bore < wMain.bore - 5 ? `своя оснастка ⌀${bm.bore} × ${REC[k].nL}×${REC[k].per}: охват ` +
            `${f(cov(wind(bm.bore, REC[k].per, REC[k].nL), sys, shot(wind(bm.bore, REC[k].per, REC[k].nL), 150, 1).NI) * 100, 0)} %, меньше ток и медь`
          : cv < 60 ? 'bore велик для этого пакета — уменьшать, а не доматывать'
          : 'работает на штатном режиме 120…180 В'];
    }), 'dense');
}

function coilTable(list) {
  return tbl(['bore, мм', 'слоёв × витков', 'витков', 'высота, мм', '⌀ внешн., мм', 'L, мкГн', 'R, мОм', 'провод, м', 'масса, кг'],
    list.map(([bore, per, nL]) => { const w = wind(bore, per, nL);
      return [bore, `${nL} × ${per}`, w.N, f(w.h, 0), f(w.od, 0), f(w.L * 1e6, 0), f(w.R * 1e3, 1), f(w.len, 1), f(w.mass, 2)]; }));
}

function modeTable(w, kL) {
  return tbl(['U, В', 'I&nbsp;пик, кА', 'N·I, кА·витков', 'запас к требуемой МДС', 'T/2, мс', 'ток на банку (однотипный банк ÷10), А', 'i²t VT1, % паспорта', 'i²t VD6, % на диод', 'нагрев обмотки, °C'],
    US.map(U => { const s = shot(w, U, kL);
      const zap = Object.keys(SYS).map(k => f(s.NI / need[k].sum, 1) + '×').join(' / ');
      return [U, f(s.r.ipk / 1e3, 2), f(s.NI / 1e3, 0), zap, f(s.r.Thalf * 1e3, 1),
        s.sp.map(x => f(x.I, 0)).join(' / '), f(s.r.i2tS / 3920e3 * 100, 1), f(s.r.i2tD / 2 / 180e3 * 100, 1), '+' + f(s.dT, 1)]; }));
}

function airCompare(w) {
  const NI = need.gd34.sum * 2.5;                       // одна и та же МДС для обеих строк — рабочая цель
  return tbl(['вариант', `H в объёме магнита без стали при N·I = ${f(NI / 1e3, 0)} кА·витков`, 'сколько кА·витков пришлось бы дать воздушной катушкой'],
    Object.entries(SYS).map(([k, sys]) => {
      const H1 = EM.HmagAvg(w.layers, magOf(sys), 1);
      return [sys.name, `${f(H1 * NI / 1e3, 0)} кА/м из ${f(MAT[sys.mat].Hsat / 1e3, 0)} нужных (${f(H1 * NI / MAT[sys.mat].Hsat * 100, 0)}%)`, `<b>${f(MAT[sys.mat].Hsat / H1 / 1e3, 0)}</b>`];
    }));
}

function boreTable(k) {
  const sys = SYS[k], bm = boreMin(sys);
  const bores = sys.flangeMeasured ? [bm.stackMax + 5, bm.bore, bm.bore + 15, bm.bore + 25, 140] : [110, 120, 140, 150];
  return tbl(['bore, мм', 'зазор витки→пакет, мм на сторону', '⌀ внешн. намотки, мм', 'L, мкГн', 'провод, м / масса, кг',
    'N·I при 150 В, кА·витков', 'запас к МДС', 'охват поля в магните, %', 'то же при 180 В'],
    boreScan(sys, bores).map(({ w, by }) => {
      const a = by[150], b = by[180];
      return [w.bore, f((w.bore - bm.stackMax) / 2, 1), f(w.od, 0), f(w.L * 1e6, 0), `${f(w.len, 1)} / ${f(w.mass, 2)}`,
        f(a.NI / 1e3, 0), f(a.NI / need[k].sum, 1) + '×', f(a.cov * 100, 0), `${f(b.NI / 1e3, 0)} кА·вит, ${f(b.cov * 100, 0)}%`];
    }));
}

function wireTable() {
  return tbl(['режим', 'плотность в пике, А/мм²', 'нагрев, °C/выстрел', 'во сколько раз должен вырасти ток, чтобы обмотка прогрелась на +110 °C', 'давление соседних витков, Н/м', 'напряжение между витками, В'],
    [150, 180, 300].map(U => { const s = shot(wMain, U, 1);
      const A = Math.PI / 4 * (W.dCu / 1e3) ** 2;
      const wl = EM.MU0 * s.r.ipk ** 2 / (2 * Math.PI * (wMain.pitch / 1e3));
      return [`${U} В (I = ${f(s.r.ipk / 1e3, 2)} кА)`, f(s.r.ipk / (A * 1e6), 0), '+' + f(s.dT, 1),
        `${f(Math.sqrt(110 / s.dT), 1)}× (до ${f(s.r.ipk * Math.sqrt(110 / s.dT) / 1e3, 0)} кА)`, f(wl, 0),
        f(wMain.L * (s.r.ipk / s.r.tpk) / wMain.N, 1)]; }));
}

function sideEffects() {
  const rows = [];
  for (const k of Object.keys(SYS)) {
    const sys = SYS[k], v = voiceCoil(sys, B_POLE / 3e-3);
    rows.push([`${sys.name}: звуковая катушка замкнута (вывводы или фильтр остались подключены)`,
      `ЭДС ${f(v.emf, 0)} В, R = ${f(v.R, 1)} Ом`, `ток ${f(v.I, 1)} А, сила на диффузор ~${f(v.F, 0)} Н`,
      'выводы разомкнуть, фильтры отключить']);
  }
  for (const k of Object.keys(SYS)) {
    const sys = SYS[k], w = wind(BM[k].bore, REC[k].per, REC[k].nL), s = shot(w, 150, 1);
    const bk = basketEffect(w, sys, s.NI, s.r.tpk);
    if (!bk) {
      rows.push([`${short(k)} — вокруг магнита металла нет`, sys.basket.note,
        'короткозамкнутого витка нет: ни тока в корзине, ни сил, ни потерь энергии',
        sys.basket.alt ? `⚠ ${sys.basket.altNote}: см. строку ниже` : 'оснастка обычная, экранировать нечего']);
    } else {
      rows.push([`${short(k)} — ${bk.name}: один короткозамкнутый виток вокруг мотора`,
        `кольцо у фланца r = ${f(bk.r * 1e3, 0)} мм, R ≈ ${f(bk.R * 1e3, 2)} мОм (ρ ${BASKET[bk.kind].rho.toExponential(1)} Ом·м), L ≈ ${f(bk.L2 * 1e6, 2)} мкГн, M с нашей обмоткой ≈ ${f(bk.M * 1e6, 2)} мкГн, поле в его плоскости ${f(bk.B, 2)} Тл`,
        `ЭДС ≈ ${f(bk.emf, 1)} В, ток ≈ ${f(bk.I, 0)} А, сила ≈ ${f(bk.F, 0)} Н, сгорает ≈ ${f(bk.E, 0)} Дж = ${f(bk.E / (0.5 * C0 * 150 ** 2) * 100, 0)}% энергии банка; в цепи разряда — добавка ${f(bk.Rref * 1e3, 1)} мОм к ${f(w.R * 1e3, 1)} мОм обмотки`,
        'фиксировать за раму; диффузор не держать; при недоборе B проверить, не экранирует ли рама поле']);
    }
    if (sys.basket.alt) {
      const ba = basketEffect(w, sys, s.NI, s.r.tpk, { kind: sys.basket.alt });
      rows.push([`${short(k)} — ${BASKET[sys.basket.alt].name} (ранняя версия этой головки)`,
        `то же кольцо, но ρ алюминия и стенка ~${f(BASKET[sys.basket.alt].a * 1e3, 1)} мм: R ≈ ${f(ba.R * 1e3, 2)} мОм`,
        `ЭДС ≈ ${f(ba.emf, 1)} В, ток ≈ ${f(ba.I, 0)} А, сила ≈ ${f(ba.F, 0)} Н, сгорает ≈ ${f(ba.E, 0)} Дж; добавка ${f(ba.Rref * 1e3, 1)} мОм к цепи — вот это уже короткий виток`,
        'если кожух есть — снимать его на время выстрела или считать ухудшение связи']);
    }
  }
  rows.push([`катушка ⌀${wMain.bore} смещена относительно мотора на 1 см`,
    `dL/dz ≈ ${f((2.5 - 1) * wMain.L * 1e6 / 10, 1)} мкГн/см при L = ${f(wMain.L * 1e6, 0)} мкГн`,
    `тяга ≈ ${f(pullToCenter(wMain, 180) / 1e3, 0)} кН`, 'центровать по магниту, прижимать']);
  rows.push(['альнико (10ГД‑30Е) без диода свободного хода', 'обратная полуволна тока', 'обратное поле размагнитит керн: HcB ≈ 48 кА/м',
    'VD6 обязателен, полярность импульса не менять']);
  return tbl(['эффект', 'почему', 'сколько', 'что делать'], rows);
}

const CSS = `
:root{color-scheme:dark;--bg:#111418;--fg:#e8edf4;--mut:#9fb0c8;--ac:#41a6ff;--warn:#ffb060;--ok:#7ee0a0;--line:#26303c}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,"Segoe UI",Roboto,sans-serif}
header{padding:26px 20px 10px;max-width:1320px;margin:0 auto}h1{font-size:26px;margin:0 0 6px}h2{font-size:20px;margin:28px 0 8px}
main{max-width:1320px;margin:0 auto;padding:0 24px 60px}
p,ul,ol,.note,.warn,.ok,.hint{max-width:1000px}
.card{background:#171c24;border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:14px 0}
.note{background:rgba(65,166,255,.08);border-left:3px solid var(--ac);padding:10px 14px;border-radius:8px;margin:12px 0}
.warn{background:rgba(255,176,96,.08);border-left:3px solid var(--warn);padding:10px 14px;border-radius:8px;margin:12px 0}
.ok{background:rgba(94,201,148,.07);border-left:3px solid var(--ok);padding:10px 14px;border-radius:8px;margin:12px 0}
.hint{font-size:13px;color:#9fb0c8;margin:4px 0 10px}
ul.rules{padding-left:20px}ul.rules li{margin:6px 0;font-size:14.5px}
table{border-collapse:collapse;width:100%;font-size:14px;margin:12px 0}th,td{border:1px solid var(--line);padding:7px 9px;text-align:left;vertical-align:top}th{background:#1b2230}
table.dense{font-size:13.5px;min-width:900px}table.dense th{font-size:13px;padding:6px 7px}table.dense td{padding:6px 7px}
.tscroll{overflow-x:auto}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:900px){.two{grid-template-columns:1fr}}
.cut{display:block;width:100%;height:auto;background:#161a20;border-radius:10px;border:1px solid var(--line)}
a{color:var(--ac)}code{background:#1b2230;padding:1px 5px;border-radius:4px;font-size:.92em}
.calc{display:grid;grid-template-columns:1fr 1fr;gap:14px 18px}@media(max-width:900px){.calc{grid-template-columns:1fr}}
label{display:block;font-size:13px;color:#9fb0c8;margin:10px 0 3px}
input,select{background:#1b2230;border:1px solid #2b3646;color:#e8edf4;padding:6px 8px;border-radius:7px;font:inherit;font-size:14px;width:100%}
input:focus,select:focus{outline:none;border-color:var(--ac)}
input[type=range]{background:transparent;border:0;padding:0;accent-color:var(--ac)}
.row{display:flex;gap:8px;align-items:center}.row input[type=range]{flex:1}.row input[type=number]{width:96px}
.out{display:grid;grid-template-columns:1fr 1fr;gap:2px 18px;margin:14px 0}
@media(max-width:900px){.out{grid-template-columns:1fr}}
.out>div{display:flex;justify-content:space-between;gap:12px;border-bottom:1px dashed var(--line);padding:5px 0;font-size:14px}
.out .k{color:#9fb0c8;flex:none}.out b{text-align:right}
.btn{background:#243244;border:1px solid #3d5a78;color:#e8edf4;padding:5px 11px;border-radius:8px;cursor:pointer;font:inherit;font-size:13px}
.btn:hover{border-color:var(--ac)}
.badge{display:inline-block;padding:2px 9px;border-radius:11px;font-size:12.5px}
.badge.kb-ok{background:rgba(94,201,148,.16);color:#7ee0a0}.badge.kb-warn{background:rgba(255,154,154,.16);color:#ff9a9a;border:0}
.bad{color:#ff9a9a}
svg.chart{display:block;width:100%;height:auto;margin:6px 0 14px;background:#161a20;border-radius:10px;border:1px solid var(--line)}
`;

const doc = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Катушки для намагничивания готовых динамиков: 10ГД‑34, 10ГД‑30Е и ещё четыре МС</title>
<style>${CSS}</style></head><body>
<header><h1>Катушки для намагничивания готовых динамиков</h1>
<p>Это список МС — магнитных систем, для которых считается установка: <b>10ГД‑34</b> (25ГДН‑1‑4, феррит),
<b>10ГД‑30Е</b> (20ГДН‑1‑8, альнико), <b>4ГД‑35</b> (8ГДШ‑1‑4), <b>3ГД‑2</b> (6ГДВ‑1‑16), <b>10ГД‑35</b> (10ГДВ‑2‑16)
и <b>15ГД‑14</b> (25ГДН‑3‑4). Сводка по ним в <a href="#list">§2</a>; <a href="#calc">§10</a> считает каждую своей
оснасткой. Две первые разобраны детально: они уже в работе. Намагничиваем <b>не разбирать</b>: головка остаётся
в корзине. Её собственные стальные фланцы и керн работают ярмом. Мотаем медным проводом
<b>⌀${W.dCu} мм в тряпочной изоляции</b> (${'⌀'} с оплёткой ≈ ${W.dIns}…4,2 мм). Это приложение к той же установке,
что описана в <a href="magnetizer.html">magnetizer.html</a>. Банк тот же: ${f(C0 * 1e3, 0)}&nbsp;мФ (10 × EPCOS B43560 4700 мкФ/400 В).
Тиристор и диоды тоже те же. Только напряжение <b>не 300&nbsp;В, а 120…180&nbsp;В</b> — и вот почему.</p>
<p class="hint">Документ генерирует <code>calc/coils/doc10gd.js</code>. Числа считает <code>calc/coils/</code>:
<code>motors.js</code> — магнитная цепь, <code>winding.js</code> — намотка и режим через общий
<code>calc/src/rlc.js</code>. Прогон таблиц в консоли: <code>node calc/coils/coils.js</code>. Ручные правки цифр
в этом файле не делаются — правится генератор. В <a href="#calc">§10</a> — живой калькулятор: свои диаметры, свой
провод, своё число витков, своя ёмкость и напряжение. Кривые импульса пересчитываются теми же функциями, что и
таблицы ниже. Страница сама сверяет себя с <code>calc/coils</code> и пишет результат в бейддже.</p></header>
<main>

<div class="note"><b>Вывод в одну строку.</b> Собранной головке из списка нужно <b>${f(Math.min(...Object.keys(SYS).map(k => need[k].sum)) / 1e3, 0)}…${f(Math.max(...Object.keys(SYS).map(k => need[k].sum)) / 1e3, 0)} кА·витков</b>,
а не сотни: её собственная магнитная цепь забирает поле на себя. Принятая катушка — <b>bore ⌀${wMain.bore} мм,
${wMain.nL} слоя × ${wMain.per} витков</b>. Здесь bore — внутренний диаметр намотки оснастки. У неё L = ${f(wMain.L * 1e6, 0)} мкГн,
⌀внешн. ${f(wMain.od, 0)} мм, ${f(wMain.len, 1)} м меди.
Режим — <b>120…180 В</b>: N·I = ${f(sh[120].one.NI / 1e3, 0)}…${f(sh[180].one.NI / 1e3, 0)} кА·витков,
запас ×${f(sh[120].one.NI / need.gd34.sum, 1)}…${f(sh[180].one.NI / need.gd34.sum, 1)}. Ток на самую нагруженную
банку ${f(sh[120].one.sp[0].I, 0)}…${f(sh[180].one.sp[0].I, 0)} А. Нагрев обмотки +${f(sh[120].one.dT, 1)}…+${f(sh[180].one.dT, 1)} °C
на выстрел, давление на витки ${f(sh[120].one.press / 1e6, 2)}…${f(sh[180].one.press / 1e6, 2)} МПа.
Приёмка — <b>B в рабочем зазоре не ниже паспортного</b> (${Object.keys(SYS).map(k => `${short(k)} ≥ ${f(SYS[k].BgapNom, 2)}`).join(', ')} Тл).</div>

<div class="card"><h2 id="cut" style="margin-top:0">1. Как это выглядит: разрез и место катушки</h2>
<p class="hint">Здесь показано, как оснастка стоит на головке: осевой полуразрез и место катушки. Слева пунктиром дана ось, показана одна половина. Оранжевым помечено то, чего нет в паспортах. Это надо померять образцом. Катушка надевается со стороны магнита, её ось — ось динамика.</p>
<p class="hint">Серое — сталь: фланцы и керн. Коричневое — магнит. Белое — рабочий зазор. Красное — наша намотка. Пунктир слева — ось. Оранжевым по‑прежнему помечено то, что не измерено.</p>
<div class="two"><div>${section(SYS.gd34, wMain)}<p class="hint">10ГД‑34: магнит К${SYS.gd34.ring.od}×${SYS.gd34.ring.id}×${SYS.gd34.ring.t}, фланцы ⌀${SYS.gd34.flangeOD}…${SYS.gd34.flangeOD + 1} (замер), керн ⌀${SYS.gd34.coreOD}, зазор ${SYS.gd34.gap.h}×${SYS.gd34.gap.w} мм. Намотка ⌀${wMain.bore} × ${wMain.nL}×${wMain.per}. Между витками и ферритом ${f((wMain.bore - SYS.gd34.ring.od) / 2, 1)} мм.</p></div>
<div>${section(SYS.gd30e, wMain)}<p class="hint">10ГД‑30Е: альнико‑стержень и есть керн, наконечник в зазоре. Намотка ⌀${wMain.bore} × ${wMain.nL}×${wMain.per}.</p></div></div>
<h3>Остальные четыре МС из списка — оснастка каждой своя</h3>
<p class="hint">Разрезы построены по паспортам. Где паспорт наружный диаметр фланцев не даёт, он принят равным диаметру кольца магнита. Такие места помечены оранжевым. Оснастку для каждой головки считает та же функция, что и калькулятор в <a href="#calc">§10</a>.</p>
<div class="two">${['gd4_35', 'gd3_2', 'gd10_35', 'gd15_14'].map(k => {
  const sys = SYS[k], w = wind(BM[k].bore, REC[k].per, REC[k].nL);
  return `<div>${section(sys, w)}<p class="hint"><b>${short(k)}</b>: ${sys.magnet}. Оснастка ⌀${BM[k].bore},
    ${REC[k].nL} × ${REC[k].per}. Окно ${sys.stackH} мм${sys.flangeMeasured ? '' : ' — ⚠ высота пакета и ⌀ фланцев не измерены'}.
    Кольцо вокруг магнита: ${sys.basket.note}.</p></div>`;
}).join('')}</div></div>

<div class="card"><h2 style="margin-top:0">2. Исходные данные</h2>
<p class="hint">Здесь исходные данные: что взято из паспортов и что измерено руками. Паспортные таблицы — 25ГДН‑1‑4 и 20ГДН‑1‑8 (ldsound.info, audioart.ru). Зазоры 10ГД‑34 — по замеру владельца. Характеристики материалов — ГОСТ 17809‑72 (ЮНДК) и ОСТ на ферриты. Чужих цен здесь нет.</p>
${srcData}
<h3 id="list">Весь список МС</h3>
<p class="hint">В список добавлены четыре головки, которые в планах: 4ГД‑35, 3ГД‑2, 10ГД‑35, 15ГД‑14. Паспорта — ldsound.info, страницы 8ГДШ‑1‑4, 6ГДВ‑1‑16, 10ГДВ‑2‑16, 25ГДН‑3‑4. В паспортах нет наружного диаметра фланцев и высоты пакета. Для них это принято равным диаметру кольца магнита и помечено ⚠ — промерять образцом. От этого напрямую зависит bore. МДС — магнитодвижущая сила, ампер‑витки — считает та же цепь, что и §3. Оснастку считает тот же <code>recommend()</code>, что и §10. Марки феррита разные (М16БА…М28РА180), но все это бариевые ферриты. Поле намагничивания в модели оставлено общим: ${f(MAT.ferrite.Hsat / 1e6, 1)} МА/м. Для более мягких марок это запас.</p>
${listTable()}
<div class="warn"><b>Что меняется от появления новых МС.</b> Двух универсальных катушек на список не хватит. Пакет 3ГД‑2 — ⌀${BM.gd3_2.stackMax} мм, пакет 15ГД‑14 — ⌀${BM.gd15_14.stackMax} мм. Разница по bore — ${f(BM.gd15_14.bore - BM.gd3_2.bore, 0)} мм. Принятая катушка ⌀${wMain.bore} на 15ГД‑14 просто не наденется (см. §5). Короткозамкнутый виток есть не везде. У 3ГД‑2 и 10ГД‑35 фланец и линза пластмассовые. У 4ГД‑35 корзина штампованная сталь, и её «виток» в разы слабее алюминиевого: ρ стали ≈ 1,5·10⁻⁷ Ом·м против 2,8·10⁻⁸ у сплава. См. §7.</div>
<div class="ok"><b>Что дал промер фланцев 10ГД‑34.</b> Фланцы оказались <b>меньше</b> магнита: ⌀${SYS.gd34.flangeOD}…${SYS.gd34.flangeOD + 1} против ⌀${SYS.gd34.ring.od}. Значит габарит пакета задаёт кольцо магнита, а фланцы нигде не мешают. Катушку можно ставить вплотную — bore ⌀${wMain.bore} вместо ⌀${PREV_BORE} прежней ревизии, которые закладывали «на фланцы». Это даёт
${f(shot(wMain, 150, 1).NI / shot(wind(PREV_BORE, 14, 2), 150, 1).NI, 2)}× ампер‑витков тем же числом витков. Охват поля — в ${f(cov(wMain, SYS.gd34, shot(wMain, 150, 1).NI) / cov(wind(PREV_BORE, 14, 2), SYS.gd34, shot(wind(PREV_BORE, 14, 2), 150, 1).NI), 1)} раза
лучше. Меди меньше, результат лучше (см. §4).</div>
<div class="warn"><b>Два промера, которые ещё нужны.</b> (1) <b>внутренний диаметр проёма корзины</b>: это стакан, в который садится пакет. Через него катушка надевается на магнит. Если он меньше ⌀${wMain.bore}, bore берут по нему либо делают каркас разрезным. Наружный диаметр нашей намотки (⌀${wMain.od.toFixed(0)} мм) роли не играет, если она встаёт внутри проёма. (2) Для 10ГД‑30Е — ⌀фланцев и <b>длина альнико‑стержня</b>. МДС растёт с длиной линейно:
${f(MAT.alnico.Hsat * 0.04 / 1e3, 0)} кА·витков на 40 мм и ${f(MAT.alnico.Hsat * 0.06 / 1e3, 0)} кА·витков на 60 мм.</div></div>

<div class="card"><h2 style="margin-top:0">3. Сколько нужно ампер‑витков</h2>
<p>Здесь считается, сколько ампер‑витков нужно каждой головке. Это сумма H·l по участкам той цепи, которую соберёт импульс: магнит → фланец → керн → рабочий зазор → обратно. Поле намагничивания принято так: феррит ${f(MAT.ferrite.Hsat / 1e6, 1)} МА/м, это 4·HcJ. То же правило, что в <a href="magnetizer.html#calc">magnetizer.html §3</a>. Для альнико — ${f(MAT.alnico.Hsat / 1e6, 1)} МА/м.</p>
${Object.keys(SYS).map(k => `<h3>${short(k)}</h3>${mmfTable(k)}`).join('\n')}
<div class="note"><b>Рабочая цель — ×2,5 от расчёта цепи: по списку от ${f(Math.min(...Object.keys(SYS).map(k => need[k].sum)) * 2.5 / 1e3, 0)} до ${f(Math.max(...Object.keys(SYS).map(k => need[k].sum)) * 2.5 / 1e3, 0)} кА·витков.</b>
Запас нужен на то, чего модель не видит: реальные зазоры и клей, краску, утечки через торец фланца, разброс
старения. У 10ГД‑34 ${f(need.gd34.rows[0][3] / need.gd34.sum * 100, 0)}% МДС уходит на сам магнит. Это ${f(need.gd34.rows[0][3] / 1e3, 1)} кА·витков на 15 мм феррита. У альнико — ${f(need.gd30e.rows[0][3] / need.gd30e.sum * 100, 0)}%: там 40 мм длины даже при 0,4 МА/м.</div>
<h3>Цена того, что головка намагничена собранной</h3>
<p class="hint">Сколько стоит то, что головка намагничена собранной? Та же самая катушка, но без стали в bore. То есть намагничиваем магнит «в воздухе». Поле считается по объёму магнита из <code>em.js</code>, не «на глаз».</p>
${airCompare(wMain)}
<p class="hint">У альнико «охват» легко превышает 100 %: H_sat ЮНДК всего ${f(MAT.alnico.Hsat / 1e6, 2)} МА/м против ${f(MAT.ferrite.Hsat / 1e6, 1)} у феррита. «Охват» — это показатель связи катушки с магнитом, а не вердикт намагничивания. Вердикт даёт только B в зазоре (§8).</p></div>

<div class="card"><h2 style="margin-top:0">4. Катушка: bore вплотную к магниту</h2>
<p>Принята катушка с <b>bore ⌀${wMain.bore} мм, ${wMain.nL} слоя × ${wMain.per} витков</b>. Bore — это наибольший диаметр пакета (⌀${BM.gd34.stackMax}) плюс ${f((wMain.bore - BM.gd34.stackMax) / 2, 1)} мм на сторону. Сам пакет: магнит ⌀${SYS.gd34.ring.od}, фланцы по замеру ⌀${SYS.gd34.flangeOD}…${SYS.gd34.flangeOD + 1}, то есть меньше. Дальше уменьшать некуда: ⌀${TIGHT} уже не оставляет хода на центровку и на скол феррита. Медь и масса только выигрывают: ${f(wMain.len, 1)}&nbsp;м и ${f(wMain.mass, 2)}&nbsp;кг против ${f(wind(PREV_BORE, 14, 2).len, 1)}&nbsp;м и ${f(wind(PREV_BORE, 14, 2).mass, 2)}&nbsp;кг у ⌀${PREV_BORE}.</p>
${coilTable([[TIGHT, MAIN.per, MAIN.nL], [MAIN.bore, MAIN.per, MAIN.nL], ...OVER.map(b => [b, MAIN.per, MAIN.nL])])}
<h3>Зачем это нужно: цена зазора между намоткой и магнитом</h3>
<p class="hint">Везде одна и та же намотка ${MAIN.nL}×${MAIN.per}, меняется только bore. «Охват» — поле в объёме магнита <b>без стали</b>, в долях от нужного H_sat. Это показатель связи, а не вердикт намагничивания. Строки 10ГД‑30Е считаются при bore, который по фланцам ещё не проверен.</p>
${boreTable('gd34')}
${boreTable('gd30e')}
<p>Разница между ⌀${wMain.bore} и ⌀${PREV_BORE} прежней ревизии — это ${f(shot(wMain, 150, 1).NI / shot(wind(PREV_BORE, 14, 2), 150, 1).NI, 2)}× ампер‑витков теми же витками и тем же проводом. По охату поля — ${f(cov(wMain, SYS.gd34, shot(wMain, 150, 1).NI) / cov(wind(PREV_BORE, 14, 2), SYS.gd34, shot(wind(PREV_BORE, 14, 2), 150, 1).NI), 1)}×. Обратная сторона: ток и давление на намотку растут. На 180 В это ${f(shot(wMain, 180, 1).r.ipk / 1e3, 2)} кА и ${f(shot(wMain, 180, 1).press / 1e6, 2)} МПа. Поэтому напряжение всё равно начинаем с нижнего значения (§5).</p>
<div class="ok"><b>Конструкция.</b> Каркас ⌀${wMain.bore} мм в свету: текстолит или ПКВ 3…4 мм. Намотка впритык в ${wMain.nL} слоя, между слоями прокладка 0,5 мм. Дальше пропитка, сверху бандаж — стальная лента или стеклоскотч в 3 слоя: давление на намотку ${f(sh[180].one.press / 1e6, 2)} МПа. Между каркасом и ферритом зазор ${f((wMain.bore - SYS.gd34.ring.od) / 2, 1)} мм. Надевать без удара и без усилия: феррит хрупкий, и скол по кромке обычно и убивает кольцо. Выводы — тем же проводом, в косичке, с запасом на перегиб. Ориентацию импульса проверять компасом по керну. Если пара головок — метить полярность одинаково.</div>
<h3>Если ⌀${wMain.bore} не проходит сквозь проём корзины</h3>
<p>Единственная реальная преграда — внутренний диаметр стакана корзины. Через него катушка надевается на пакет, а его не мерили. Если он меньше ⌀${wMain.bore}, есть два пути. Первый — мотать bore по фактическому проёму: строки ⌀110…⌀150 в таблице выше, МДС падает в ${f(shot(wMain, 150, 1).NI / shot(wind(140, 14, 2), 150, 1).NI, 1)} раза, недобор снимается напряжением. Второй — сделать каркас разрезным из двух половинок и стянуть его бандажом. Тогда bore остаётся ⌀${wMain.bore}.</p>
${tbl(['bore, мм', 'L, мкГн', 'N·I на 150 В, кА·витков (запас)', 'охват при 150 В, %', 'N·I на 250 В, кА·витков', 'охват при 250 В, %', 'что это значит'],
  OVER.map(bore => { const w = wind(bore, MAIN.per, MAIN.nL), a = shot(w, 150, 1), c = shot(w, 250, 1);
    const cv = s => cov(w, SYS.gd34, s.NI) * 100;
    return [bore, f(w.L * 1e6, 0), `${f(a.NI / 1e3, 0)} (${f(a.NI / need.gd34.sum, 1)}×)`, f(cv(a), 0),
      `${f(c.NI / 1e3, 0)} (${f(c.NI / need.gd34.sum, 1)}×)`, f(cv(c), 0),
      bore <= 120 ? 'работает на том же режиме, просто хуже связь' : 'ставить поверх рамы; подтверждать B в зазоре, недобор — напряжением']; }))}</div>

<div class="card"><h2 style="margin-top:0">5. Режим: почему 120…180 В, а не 300 В</h2>
<p class="hint">Здесь объяснение режима: почему напряжение ниже, чем в основной установке. Банк ${f(C0 * 1e3, 0)} мФ (10 × EPCOS B43560 4700 мкФ/400 В, б/у), тиристор Т253‑1250‑16, VD6 = 2× ВЛ200 — всё как в <a href="magnetizer.html#topo">magnetizer.html §1</a>. Первая таблица — L без детали: худший случай по МДС. Вторая — L ×2,5 с вставленной головкой, как будет на самом деле. Точный коэффициент даёт только замер T/2 — времени от начала импульса до пика тока. О том, что корзина головки — короткий виток и он добавит к разряду ещё ≈${f(basketEffect(wMain, SYS.gd34, sh[150].one.NI, sh[150].one.r.tpk).Rref * 1e3, 0)}&nbsp;мОм (§7), эти таблицы не знают. Реальный ток будет ниже расчётного, а не выше.</p>
${modeTable(wMain, 1)}
${modeTable(wMain, 2.5)}
<h3>Принятая катушка против каждой головки из списка</h3>
<p class="hint">Те же ${wMain.N} витков и тот же провод, меняется только головка. «Надевается» — проходит ли катушка над пакетом. «Охват» — доля поля насыщения в объёме магнита при 150 В. Оснастку под каждую головку считает <a href="#calc">§10</a>: там свой bore и свои витки.</p>
${fitTable()}
<div class="warn"><b>Зачем снижать напряжение.</b> У плотной катушки даже ${US[0]} В дают ${f(sh[120].one.NI / need.gd34.sum, 1)}× от требуемой МДС. Этого достаточно. Дальше прироста намагничения уже не будет: феррит насыщен, когда поле в его объёме перекрыло ${f(MAT.ferrite.Hsat / 1e3, 0)} кА/м. На 300 В будет ${f(sh[300].one.NI / need.gd34.sum, 1)}×. Силы, действующие на намотку, диффузор и сам мотор, а также нагрев вырастут в разы. Нагрев обмотки: +${f(sh[180].one.dT, 1)} °C против +${f(sh[300].one.dT, 1)} °C. Давление на витки: ${f(sh[300].one.press / 1e6, 2)} МПа против ${f(sh[180].one.press / 1e6, 2)}. Зарядка на 120…160 В — это режим «127 В» переключателя SA3: половины катушек вторички T1 по отводам a и b. 120 В — 32 с, 150 В — 68 с, 160 В — 99 с. Лампы балласта тут холоднее, чем в конце заряда до 300 В. <b>Потолок режима «127 В» — пик 175 В</b>, поэтому 180 В берут в режиме «255 В». Там обе катушки последовательно, и весь ход ручки закрывается на 300 В.</div>
<div class="note"><b>Что реально даёт ×3, а не ×1.</b> Модель считает МДС, а не намагничение. Сколько поля дойдёт до феррита, зависит от утечек, реальных зазоров и клея. Поэтому порядок такой: выстрел на ${US[0]} В, замер B в зазоре, и только по недобору — поднимать напряжение ступенью 30 В. Доматывать витки при недоборе бессмысленно: с ${wMain.N} витками мы и так в ${f(sh[120].one.NI / need.gd34.sum, 1)}× от расчётной цели. Решает исход связь катушки с магнитом — зазор до него и проём корзины.</div>
<p class="hint">Этот же режим можно покрутить живьём — <a href="#calc">§10</a>. Там меняются bore, провод, витки, ёмкость и напряжение. Сразу видно, как едет форма импульса и где кончается запас.</p></div>

<div class="card"><h2 style="margin-top:0">6. Хватает ли провода ⌀${W.dCu} мм</h2>
<p>Проверяем, хватает ли такого провода. Сечение меди — ${f(Math.PI / 4 * W.dCu ** 2, 2)} мм². По нагреву и по напряжению запас большой. Ограничивает эту намотку не электрика, а механика.</p>
${wireTable()}
<div class="note"><b>Что из этого следует для сборки.</b> До предела по изоляции току расти в ${f(Math.sqrt(110 / sh[180].one.dT), 1)} раза, но раньше кончатся i²t диодов VD6 и импульсный ток банок. Здесь i²t — интеграл нагрева: мера того, как сильно импульс разогревает полупроводник. Провод нигде не лимитирует. Лимит — силы между витками, ${f(EM.MU0 * sh[180].one.r.ipk ** 2 / (2 * Math.PI * (wMain.pitch / 1e3)), 0)} Н/м на 180 В: они мнут оплётку. Поэтому мотать впритык, пропитывать, держать в бандаже. Для сравнения: у основной оснастки (жила 25 мм², 8 кА, шаг 6,5 мм) то же число — ≈1970 Н/м. Там условие жёстче.</div></div>

<div class="card"><h2 style="margin-top:0">7. Побочные эффекты: что импульс делает с динамиком</h2>
${sideEffects()}
<p class="hint">Здесь перечислено, что импульс делает с динамиком, и что с этим делать. Оценка для корзины — верхняя. Сечение кольца принято 6×8 мм. Поле взято от нашей намотки по <code>em.js</code>, без учёта стали и без реакции самого витка. Реакция гасит dI/dt, поэтому ток и сила будут меньше. Порядок величин такой: килоамперы, килоньютоны и десятые доли энергии банка. Реальность мягче: такой виток возвратно действует на цепь. В таблице это показано как добавка к сопротивлению разряда. Ток будет меньше, но само явление никуда не девается: корзина работает короткозамкнутым витком. Отсюда две практики. Динамик прижимать за раму. А L и ток считать только по осциллограмме с головкой внутри (§8), а не по воздушной формуле.</p></div>

<div class="card"><h2 style="margin-top:0">8. Порядок запуска и приёмка</h2>
<ul class="rules">
<li>Разомкнуть выводы звуковой катушки. Отключить фильтр. Головку положить на немагнитную подставку и прижать за раму, а не за диффузор.</li>
<li>Проверить, проходит ли каркас ⌀${wMain.bore} через проём корзины. И только потом мотать. Не проходит — брать bore по проёму (§4) или делать каркас разрезной.</li>
<li>Намотку надеть со стороны магнита и отцентрировать по магниту. Смещение на 1 см — это тяга ≈
${f(pullToCenter(wMain, 180) / 1e3, 0)} кН.</li>
<li>Ориентацию проверить компасом по керну. Начать с <b>${US[0]} В</b> при полном банке ${f(C0 * 1e3, 0)} мФ. Это уже ${f(sh[120].one.NI / need.gd34.sum, 1)}× от требуемой МДС. Дальше поднимать ступенью 30 В и только по замеру B.</li>
<li>Первый выстрел — с осциллографом. По фронту и T/2 измерить ток и индуктивность:
<code>L = (T/2 / π)² / C</code>. Ожидание: L вырастет примерно вдвое относительно ${f(wMain.L * 1e6, 0)} мкГн. Это
подтверждение, что сталь головки работает ярмом. Почему нельзя мерить L LC-метром — в
<a href="yarmo.html">yarmo.html</a>.</li>
<li>Приёмка намагничения: <b>B в рабочем зазоре не ниже паспортного</b> —
${Object.keys(SYS).map(k => `${short(k)} ≥ ${f(SYS[k].BgapNom, 2)} Тл`).join(', ')} (датчик Холла в зазоре). Нет тесламетра — сравнить чувствительность
с заведомо исправной головкой: 84 дБ и 86 дБ по паспорту.</li>
<li>Если B недобран — <b>поднимать напряжение ступенями до 250 В</b>, а не доматывать витки. МДС у нас с запасом, а
неопределённость — в утечках, клее и реальных зазорах. Проверить и зазор витки→магнит: он в разы важнее числа витков
(см. §4).</li>
</ul></div>

<div class="card"><h2 style="margin-top:0">9. Границы модели</h2>
<p>Здесь границы модели: что она знает и где ей нельзя верить. Магнитная цепь — сосредоточенная. Утечки заданы множителем, сталь — табличной кривой H(B). ⌀фланцев и длина альнико не измерены. Точку ставят два замера: L с головкой в bore, из T/2, и B в зазоре. Нужен и замер тока. Короткозамкнутый виток из алюминиевой корзины (§7) добавляет к цепи ≈${f(basketEffect(wMain, SYS.gd34, sh[150].one.NI, sh[150].one.r.tpk).Rref * 1e3, 0)} мОм отражённого сопротивления. В воздушной модели его нет, поэтому расчётный пик тока надо считать верхним. L нигде не подставлена «с потолка»: она считается из геометрии намотки (<code>calc/src/em.js</code>, Neumann + эллиптические интегралы). Коэффициент роста от стали — тоже не допущение. Это диапазон, измеренный на чужих оснастках: ×1,41 стальной корпус … ×10 стержень в bore. См. <a href="imlab-magnetizery.html">разбор копии imlab.narod.ru</a>, §4–§5.</p>
<p class="hint">Рядом: <a href="magnetizer.html">magnetizer.html</a> — установка, схема, калькулятор;
<a href="yarmo.html">yarmo.html</a> — 8 конструкций ярма и чужие измеренные числа;
<a href="katushki-promyshlennye.html">katushki-promyshlennye.html</a> — как устроена промышленная оснастка;
исходники расчёта — <code>calc/coils/README.md</code>.</p></div>

<div class="card"><h2 id="calc" style="margin-top:0">10. Калькулятор: витки, провод, напряжение → импульс</h2>
<p class="hint">Здесь калькулятор: свои витки, свой провод, своё напряжение — и сразу импульс. Модель та же, что в разделах 3–7. В страницу вшиты <b>те же функции</b>, что считает <code>node calc/coils/coils.js</code>: генератор выкладывает исходники <code>calc/src/em.js</code>, <code>calc/src/rlc.js</code> и <code>calc/coils/winding.js</code> как есть. Совпадение проверяется на контрольных точках: <span id="k-check" class="badge kb-ok">проверяю…</span></p>

<div class="calc">
 <div>
  <label>Головка (задаёт нужную МДС и габарит пакета)</label>
  <select id="k-sys" onchange="kSys()">
${Object.keys(SYS).map(k => `    <option value="${k}"${k === 'gd34' ? ' selected' : ''}>${short(k)} — ${SYS[k].mat === 'alnico' ? 'альнико' : 'феррит'}, пакет ⌀${BM[k].stackMax}${BM[k].stackMax !== SYS[k].flangeOD || SYS[k].flangeMeasured ? '' : ' ⚠ не измерен'}</option>`).join('\n')}
  </select>
  <label>Каркас, внутренний ⌀, мм <span id="k-borehint" style="color:#ffb060">ориентир ⌀${BM.gd34.bore} = пакет + 5 мм на сторону</span></label>
  <div class="row">
    <input id="k-bore" type="number" min="50" max="220" step="1" value="${PREFILL.gd34.bore}" oninput="kRecalc()">
    <select id="k-borepreset" onchange="kBore()" style="max-width:210px">
      <option value="">⌀ из §2 и §4…</option>
${presetOptions()}
    </select>
  </div>
  <label>Провод: ⌀ по меди, мм</label>
  <input id="k-dcu" type="number" min="1" max="6" step="0.1" value="${W.dCu}" oninput="kRecalc()">
  <label>Шаг намотки = ⌀ провода с оплёткой, мм</label>
  <input id="k-pitch" type="number" min="1.5" max="9" step="0.1" value="${W.dIns}" oninput="kRecalc()">
  <label>Слоёв</label>
  <select id="k-nl" onchange="kRecalc()"><option value="1">1 слой</option><option value="2" selected>2 слоя</option><option value="3">3 слоя</option></select>
  <label>Витков в слое — рекомендованное подставлено, правьте сами</label>
  <input id="k-per" type="number" min="1" max="40" step="1" value="${PREFILL.gd34.per}" oninput="kRecalc()">
 </div>
 <div>
  <label>Напряжение банка, В</label>
  <div class="row"><input type="range" min="60" max="350" step="5" value="${PREFILL.gd34.u}" oninput="kSet('k-u',this.value)">
    <input id="k-u" type="number" min="20" max="400" step="5" value="${PREFILL.gd34.u}" oninput="kRecalc()"></div>
  <label>Ёмкость банка, мФ <span style="color:#ffb060">штатный банк установки — 47 мФ (10 × EPCOS B43560 4700 мкФ/400 В)</span></label>
  <div class="row"><input type="range" min="5" max="80" step="0.5" value="${+(C0 * 1e3).toFixed(1)}" oninput="kSet('k-c',this.value)">
    <input id="k-c" type="number" min="1" max="120" step="0.1" value="${+(C0 * 1e3).toFixed(1)}" oninput="kRecalc()"></div>
  <label>Во сколько раз L вырастет из‑за стали мотора (×2…5 по замеру T/2; 1 = воздушная)</label>
  <div class="row"><input type="range" min="1" max="5" step="0.1" value="1" oninput="kSet('k-kl',this.value)">
    <input id="k-kl" type="number" min="1" max="6" step="0.1" value="1" oninput="kRecalc()"></div>
  <div id="k-reco" class="note" style="margin-top:14px"></div>
 </div>
</div>

<div class="out">
  <div><span class="k">намотка</span><b id="o-geo">—</b></div>
  <div><span class="k">L воздушная / с деталью</span><b id="o-L">—</b></div>
  <div><span class="k">медь</span><b id="o-wire">—</b></div>
  <div><span class="k">сопротивление контура</span><b id="o-R">—</b></div>
  <div><span class="k">I пик</span><b id="o-ipk">—</b></div>
  <div><span class="k">N·I</span><b id="o-ni">—</b></div>
  <div><span class="k">запас к нужной МДС</span><b id="o-zap">—</b></div>
  <div><span class="k">связь с магнитом («охват»)</span><b id="o-cov">—</b></div>
  <div><span class="k">длительность импульса</span><b id="o-t">—</b></div>
  <div><span class="k">ток на банки</span><b id="o-bank">—</b></div>
  <div><span class="k">i²t VT1 / VD6</span><b id="o-it">—</b></div>
  <div><span class="k">нагрев и межвитковое</span><b id="o-heat">—</b></div>
  <div><span class="k">силы в оснастке</span><b id="o-force">—</b></div>
  <div><span class="k">корзина как виток</span><b id="o-basket">—</b></div>
</div>
<div id="k-verdict"></div>

<h3>Форма импульса при другом напряжении</h3>
<p class="hint">Яркая кривая — выбранное напряжение. Тусклые — соседние, в 0,5…1,5 раза от него. Зелёная пунктирная — ток, нужный по магнитной цепи с запасом ×2,5 при данном числе витков. Если пик выше неё, ампер‑витков хватает. Форма считается тем же решателем, что и таблицы §5: с диодом свободного хода VD6, падениями на тиристоре и ESR банка.</p>
<div id="k-i-chart"></div>

<h3>Ампер‑витки против напряжения</h3>
<p class="hint">Синяя кривая на левой шкале, в кА·витков — что даёт эта намотка при данном напряжении. Красная и зелёная — сколько нужно: по магнитной цепи и рабочая цель ×2,5. Фиолетовая пунктирная на правой шкале, в % — «охват» поля в объёме магнита. Это доля нужного поля насыщения. По ней видно, где катушка стоит слишком далеко и число витков уже не помогает. Фиолетовая горизонтальная линия — 100 %. Выше неё поле в магните больше насыщающего, и дальше растут только силы и нагрев, а не намагничение. Точка на графике — текущий режим. Диапазон напряжения подстраивается под выбранное.</p>
<div id="k-ni-chart"></div>

<p class="hint">Чего калькулятор не знает. Реальной магнитной цепи головки: он считает МДС и поле, а не B в зазоре. Экранирования полем алюминиевой корзины — строка «корзина как виток» даёт оценку сверху. И того, что с вставленной головкой L вырастет, а её стальные детали сместят форму импульса. Порядок такой: здесь выбрать геометрию и напряжение, а режим довести по первой осциллограмме (§8).</p>
</div>

</main>
<script>
/* ─── модель: те же функции, что в calc/src и calc/coils (выложены генератором как есть) ─── */
${BUNDLE}

/* ─── данные страницы: габариты головок, нужная МДС, рекомендованные настройки ─── */
const DATA = ${JSON.stringify({ SYS, NEED: Object.fromEntries(Object.keys(SYS).map(k => [k, need[k].sum])), BM, PREFILL, SELFTEST })};

/* ─── интерфейс калькулятора: calc/coils/webcalc.js ─── */
${WEBCALC}
</script>
</body></html>`;

const out = path.join(__dirname, '..', '..', 'katushki-10gd.html');
fs.writeFileSync(out, doc);
console.log(`katushki-10gd.html: ${f(doc.length / 1024, 1)} КБ, вариантов катушек ${2 + OVER.length}, строк режима ${(US.length) * 2}, ссылок на другие документы ${(doc.match(/href="(?!#)/g) || []).length}`);
