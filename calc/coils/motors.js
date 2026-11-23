// Магнитные системы собранных головок: сколько ампер-витков нужно, чтобы намагнитить их СОБРАННЫМИ.
// Собранный мотор — это уже готовая магнитная цепь: свои фланцы и керн работают ярмом, поэтому МДС
// нужна в разы меньше, чем воздушной катушкой. Считаем по магнитной цепи: Σ H·l по участкам.
//
// Пуск: node calc/coils/motors.js
// Список: 10ГД-34 и 10ГД-30Е — по замерам пользователя и паспортам (ldsound/audioart);
// 4ГД-35, 3ГД-2, 10ГД-35, 15ГД-14 — по паспортам ldsound.info (размеры фланцев и высота пакета
// в паспортах не приведены ⇒ ⚠ приняты по геометрии магнита, промерять).
// ⚠ Фланцы 10ГД-34 по замеру пользователя на 1…2 мм МЕНЬШЕ диаметра магнита — значит самый большой
//   диаметр в пакете это само кольцо магнита, и катушка ставится вплотную к нему (см. boreMin).
// ⚠ Фланцы 10ГД-30Е и длина альнико-стержня — по-прежнему промерять.

const MU0 = 4 * Math.PI * 1e-7, PI = Math.PI;
const mm = x => x / 1e3;

const MAT = {
  ferrite: {
    name: 'феррит бария М25РА170', HcB: 170e3, Hsat: 1.0e6, mur: 1.05,
    note: 'H_sat = 4·HcJ — то же правило, что принято в magnetizer.html §2 (феррит ≈ 1.0 МА/м)',
  },
  alnico: {
    name: 'ЮНДК-24 (ЮН14ДК24, Alnico)', HcB: 48e3, Hsat: 4.0e5, mur: 2.5,
    note: 'по ГОСТ 17809-72 HcB ≈ 48 кА/м, но у альнико «колено» мягкое: в практике намагничивания берут 0.4…0.48 МА/м',
  },
};

// Ст3 / электротехническая сталь фланцев: H(B), А/м (интерполяция по точкам)
const STEEL = [[0.3, 60], [0.6, 150], [1.0, 420], [1.3, 850], [1.5, 1600], [1.7, 3300], [1.9, 7500], [2.0, 13000]];
function Hsteel(B) {
  if (B <= 0) return 0;
  for (let i = 1; i < STEEL.length; i++) if (B <= STEEL[i][0]) {
    const [b0, h0] = STEEL[i - 1], [b1, h1] = STEEL[i];
    return h0 + (h1 - h0) * (B - b0) / (b1 - b0);
  }
  return STEEL[STEEL.length - 1][1] * (1 + 30 * (B - 2.0));   // круто за 2 Тл
}

const SYS = {
  gd34: {
    name: '10ГД-34 (он же 25ГДН-1-4 / 25ГДН-1-8)',
    magnet: 'кольцевой феррит М25РА170 К85×35×15, намагничен осевo',
    mat: 'ferrite',
    ring: { od: 85, id: 35, t: 15 },
    coreOD: 25,            // керн (паспорт) — по замерам иногда 27.3, см. сноску в README
    flangeHole: 27.3,
    gap: { h: 7, w: 1.38 },   // по замеру пользователя; паспорт даёт 8 мм / 1.1 мм
    BgapNom: 0.8,
    vc: { id: 25.6, turns: 91, dWire: 0.23, hWind: 12.4 },   // ПЭЛ ⌀0.23, 46+45 витков, высота намотки 12.4 мм (паспорт)
    flangeOD: 83,            // замер пользователя: на 1…2 мм меньше ⌀ магнита (85) ⇒ 83…84 мм
    flangeMeasured: true,
    basketPass: null,        // ⚠ внутренний диаметр стакана корзины, через который надевается катушка — промерить
    stackH: 32,               // высота пакета фланец+магнит+фланец, ориентир
    basket: { kind: 'cast-al', note: 'корзина — литьё из алюминиевого сплава' },
  },
  gd30e: {
    name: '10ГД-30Е (он же 20ГДН-1-8 / 10ГД-30Е-32)',
    magnet: 'керновый альнико ЮНДК-24: сам керн и есть магнит, в зазоре стальной наконечник',
    mat: 'alnico',
    coreOD: 39.8,
    flangeHole: 42.8,
    lAlnico: 40,              // ⚠ длина альнико-стержня в паспорте не указана — промерять (влияет линейно)
    gap: { h: 7, w: 1.46 },
    BgapNom: 0.95,
    vc: { id: 40.3, turns: 90, dWire: 0.22, hWind: 11.3 },   // ⚠ витков/провода в паспорте нет — принято по геометрии и 8 Ом
    flangeOD: 110,            // ⚠ промерять: у этой системы фланцы заведомо больше керна (зазор между ними)
    flangeMeasured: false,
    basketPass: null,         // ⚠ то же, что у 10ГД-34: внутренний диаметр проёма корзины
    stackH: 45,
    basket: { kind: 'cast-al', note: 'корзина — литьё из алюминиевого сплава' },
  },

  // ── остальные МС из списка. Паспорта — ldsound.info (страницы указаны в doc10gd.js, сноска §2);
  //    размеры фланцев и высота пакета в паспортах не приводятся — помечены ⚠ и приняты по геометрии
  //    магнита: фланцы считаем не больше кольца магнита, толщина фланца 6 мм (как в разрезе §3). ──
  gd4_35: {
    name: '4ГД-35 (он же 8ГДШ-1-4)',
    magnet: 'кольцевой феррит М16БА К75×28×12,5, намагничен осевo',
    mat: 'ferrite',
    ring: { od: 75, id: 28, t: 12.5 },
    coreOD: 19.9,
    flangeHole: 21.7,
    gap: { h: 3.9, w: 0.85 },
    BgapNom: 0.9,
    vc: { id: 20.3, turns: 45, dWire: 0.14, hWind: 3.9 },   // ПЭВЛ ⌀0,140, 24+21 витков (паспорт)
    flangeOD: 75,             // ⚠ не измерен: принят равным ⌀ кольца — габарит задаёт магнит, промерить
    flangeMeasured: false,
    basketPass: null,
    stackH: 25,               // ⚠ оценка: 12,5 мм магнита + два фланца по ~6 мм
    basket: { kind: 'steel-stamped', note: 'корзина — штампованная сталь' },
  },
  gd3_2: {
    name: '3ГД-2 (он же 6ГДВ-1-16 / 6ГДВ-1-25)',
    magnet: 'кольцевой феррит М16БА190 К52×23×8 (цифра в марке — HcB, кА/м)',
    mat: 'ferrite',
    ring: { od: 52, id: 23, t: 8 },
    coreOD: 20,               // по паспорту; читатель ldsound отмечает, что керн выступает над фланцем на 1,5 мм
    flangeHole: 21.2,
    gap: { h: 2.5, w: 0.6 },
    BgapNom: 1.0,
    vc: { id: 20.3, turns: 41, dWire: 0.07, hWind: 2.0 },   // ПЭВЛ ⌀0,07, 21+20 витков (паспорт)
    flangeOD: 52,             // ⚠ не измерен
    flangeMeasured: false,
    basketPass: null,
    stackH: 20,               // ⚠ оценка: 8 мм магнита + два фланца по ~6 мм
    basket: { kind: 'plastic', note: 'установочный фланец и акустическая линза — пластмасса' },
  },
  gd10_35: {
    name: '10ГД-35 (он же 10ГДВ-2-16 / 10ГД-35Б)',
    magnet: 'кольцевой феррит М22РА220 К85×35×15 — то же кольцо, что у 10ГД-34, но марка жёстче',
    mat: 'ferrite',
    ring: { od: 85, id: 35, t: 15 },
    coreOD: 24.6,
    flangeHole: 26.6,
    gap: { h: 4, w: 1.0 },
    BgapNom: 1.0,
    vc: { id: 25.4, turns: 45, dWire: 0.08, hWind: 2.5 },   // ПЭТВЛ-1 ⌀0,08, 23+22 витка (паспорт)
    flangeOD: 85,             // ⚠ не измерен
    flangeMeasured: false,
    basketPass: null,
    stackH: 27,               // ⚠ оценка: 15 мм магнита + два фланца по ~6 мм
    basket: { kind: 'plastic', alt: 'al-cover', altNote: 'у ранних 10ГД-35 магнит закрыт алюминиевым кожухом — он и есть короткий виток', note: 'фланец и линза пластмассовые' },
  },
  gd15_14: {
    name: '15ГД-14 (он же 25ГДН-3-4 / 25ГДН-3-8)',
    magnet: 'кольцевой феррит М28РА180 К110×45×16',
    mat: 'ferrite',
    ring: { od: 110, id: 45, t: 16 },
    coreOD: 24.45,
    flangeHole: 27.45,
    gap: { h: 7, w: 1.5 },
    BgapNom: 0.95,
    vc: { id: 25.4, turns: 93, dWire: 0.224, hWind: 12.3 },  // ПЭТВ-1 ⌀0,224, 47+46 витков (паспорт)
    flangeOD: 110,            // ⚠ не измерен: кольцо ⌀110 при наружном ⌀ головки 125 — фланцы промерять обязательно
    flangeMeasured: false,
    basketPass: null,
    stackH: 28,               // ⚠ оценка: 16 мм магнита + два фланца по ~6 мм
    basket: { kind: 'cast-al', note: 'корзина — литьё под давлением из алюминиевого сплава' },
  },
};

const B_POLE = 1.6;           // чем насыщается полюс/наконечник при жёстком намагничивании

// bore катушки = самый большой диаметр пакета + зазор на надевание ( diametral; по 5 мм на сторону).
// У 10ГД-34 пакет по замеру: магнит ⌀85, фланцы ⌀83…84 ⇒ больший диаметр — сам магнит, а не фланец.
function boreMin(sys, clr = 10) {
  const stackMax = sys.mat === 'ferrite' ? Math.max(sys.ring.od, sys.flangeOD) : sys.flangeOD;
  return { stackMax, bore: stackMax + clr };
}

// Магнитная цепь собранного мотора → требуемая МДС, кА·витков
function circuit(sys, o = {}) {
  const m = MAT[sys.mat];
  const Hs = o.Hsat || m.Hsat;
  const rows = [];

  let A_mag, l_mag;
  if (sys.mat === 'ferrite') {
    A_mag = PI / 4 * (mm(sys.ring.od) ** 2 - mm(sys.ring.id) ** 2);
    l_mag = mm(sys.ring.t);
  } else {
    A_mag = PI / 4 * mm(sys.coreOD) ** 2;
    l_mag = mm(o.lAlnico || sys.lAlnico);
  }
  rows.push(['сам магнит', Hs, mm(l_mag * 1e3), Hs * l_mag]);

  // рабочий зазор: кольцевая поверхность ⌀(керн+зазор) × высота зазора
  const A_gap = PI * (mm(sys.coreOD) + mm(sys.gap.w)) * mm(sys.gap.h);
  const Bg = o.Bpole || B_POLE;
  const Hg = Bg / MU0;
  rows.push(['рабочий зазор (B≈' + Bg + ' Тл)', Hg, mm(sys.gap.w), Hg * mm(sys.gap.w)]);

  // сталь: тот же поток через керн и радиальные участки фланцев
  const Phi = Bg * A_gap;
  const A_core = PI / 4 * mm(sys.coreOD) ** 2;
  const B_core = Phi / A_core;
  let l_steel;
  if (sys.mat === 'ferrite') l_steel = mm(2 * (sys.ring.od - sys.coreOD) / 2 + sys.coreOD);  // радиально в двух фланцах + керн
  else l_steel = mm(2 * (sys.flangeOD - sys.coreOD) / 2 + sys.coreOD * 0.5);
  const H_st = Hsteel(B_core);
  rows.push(['сталь: керн B=' + B_core.toFixed(1) + ' Тл + фланцы', H_st, l_steel, H_st * l_steel]);

  // утечка: воздушный зазор между торцом фланца и наружным диаметром магнита — часть МДС замкнётся мимо магнита
  const F_mag = Hs * l_mag;
  const kLeak = o.kLeak ?? 0.5;
  rows.push(['утечка мимо магнита (оценка ×' + kLeak + ')', 0, 0, kLeak * F_mag]);

  const sum = rows.reduce((s, r) => s + r[3], 0);
  return { rows, sum, A_mag, l_mag, A_gap, Phi, B_core };
}

const f = (x, d = 1) => x.toLocaleString('ru-RU', { maximumFractionDigits: d, minimumFractionDigits: d });

if (require.main === module) {
  for (const [key, sys] of Object.entries(SYS)) {
    const m = MAT[sys.mat];
    console.log(`\n### ${sys.name}`);
    console.log(`    ${sys.magnet}; зазор ${sys.gap.h} мм × ${sys.gap.w} мм, B в зазоре по паспорту ${sys.BgapNom} Тл`);
    const c = circuit(sys);
    for (const [n, H, l, F] of c.rows)
      console.log(`  ${n.padEnd(42)} ${l ? (l * 1e3).toFixed(0).padStart(4) + ' мм' : '     —'}  ${f(F / 1e3, 1).padStart(6)} кА·вит`);
    console.log(`  итого по магнитной цепи: ${f(c.sum / 1e3, 0)} кА·витков` +
      `   (магнит ${m.name}: H_sat=${f(m.Hsat / 1e6, 2)} МА/м по правилу «${m.note}»)`);
    console.log(`  ⇒ берём в работу ×2.5 = ${f(c.sum * 2.5 / 1e3, 0)} кА·витков — запас на утечки, клей, краску и разброс`);
    console.log(`  приёмка после намагничивания: B в зазоре ≥ ${sys.BgapNom} Тл (паспорт), мерить датчиком Холла в зазоре`);
    const bm = boreMin(sys);
    console.log(`  фланцы: ⌀${sys.flangeOD}` + (sys.flangeMeasured ? ' — замер, меньше магнита на 1…2 мм' : ' — ⚠ НЕ ИЗМЕРЕНЫ, приняты по ⌀ магнита') +
      `; наибольший диаметр пакета ⌀${bm.stackMax}`);
    console.log(`  bore катушки: ⌀${bm.bore} (пакет + 5 мм на сторону); высота окна ≥ ${sys.stackH} мм` +
      (sys.flangeMeasured ? '' : '  ⚠ stackH — оценка, промерять'));
    console.log(`  корзина: ${sys.basket.note}` + (sys.basket.kind === 'plastic' ? ' ⇒ короткозамкнутого витка нет' : ''));
    if (sys.basketPass === null) console.log(`  ⚠ ПРОХОД: нужен внутренний диаметр стакана корзины, через который катушка надевается на пакет` +
      ` — если он меньше ⌀${bm.bore}, bore беру по нему либо делаю каркас разрезным`);
  }
}

// звуковая катушка как короткозамкнутый виток: выводы замкнуты (или динамик остался в фильтре) —
// импульс гонит через неё ток и дёргает диффузор. Считаем по паспортной геометрии.
function voiceCoil(sys, dBdt) {
  const vc = sys.vc;
  const rCore = (sys.mat === 'ferrite' ? sys.coreOD : sys.coreOD) / 2e3;
  const A = Math.PI * rCore ** 2;
  const emf = vc.turns * A * dBdt;
  const R = 1.75e-8 * (vc.turns * Math.PI * (vc.id + vc.dWire) / 1e3) / (Math.PI / 4 * (vc.dWire / 1e3) ** 2);
  const I = emf / R;
  const leff = vc.turns * Math.min(1, sys.gap.h / vc.hWind) * Math.PI * (vc.id + vc.dWire) / 1e3;   // в зазоре только часть намотки
  return { emf, R, I, F: sys.BgapNom * leff * I };
}

module.exports = { SYS, MAT, circuit, Hsteel, B_POLE, voiceCoil, boreMin };
