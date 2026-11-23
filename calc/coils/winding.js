// Общие строительные блоки оснасток под готовые головки: провод, намотка, режим.
// Используют их оба: прогон `calc/coils/coils.js` (таблицы в консоли) и генератор
// `calc/coils/doc10gd.js` (HTML-документ) — чтобы числа в документе и в консоли были из одного расчёта.
const EM = require('../src/em.js');
const { sim, split } = require('../src/rlc.js');
const { MAT } = require('./motors.js');                 // только H_sat материала — для показателя «охвата»

const W = { dCu: 3.3, dIns: 3.9, rho: 1.75e-8, g: 8960 };    // ⌀по меди / ⌀с тряпочной оплёткой, ρ Cu, кг/м³
const C0 = 47e-3;                                          // банк установки: 10 × EPCOS B43560-S9478-M1 (4700 мкФ/400 В), как в magnetizer.html
const Radd = 0.0035;                                       // шины + тиристор: добавка к R обмотки в контуре разряда (ESR банка — Rs в rlc.js)
const f = (x, d = 1) => x.toLocaleString('ru-RU', { maximumFractionDigits: d, minimumFractionDigits: d });

// намотка: bore внутри, per витков в слое, nL слоёв, шаг = диаметр с оплёткой, dCu — по меди.
// dCu/pitch параметром — чтобы калькулятор в документе крутил провод, не заводя свою модель.
function wind(boreMm, per, nL, pitch = W.dIns, dCu = W.dCu) {
  const p = pitch / 1e3, R0 = boreMm / 2e3;
  const layers = Array.from({ length: nL }, (_, i) => ({ R: R0 + i * p, n: per, pitch: p }));
  const N = per * nL;
  const len = layers.reduce((s, l) => s + l.n * 2 * Math.PI * l.R, 0);
  const Acu = Math.PI / 4 * (dCu / 1e3) ** 2;
  return {
    bore: boreMm, per, nL, pitch, dCu, N, layers,
    L: EM.Lwind(layers, dCu / 2e3),
    R: W.rho * len / Acu,
    len, mass: len * Acu * W.g,
    h: per * pitch,                                        // высота намотки = сколько витков влезло по оси
    od: boreMm + 2 * nL * pitch,
  };
}

// сечение магнита (или альнико-стержня) — чтобы посчитать, что дала бы та же катушка БЕЗ стали в bore
function magOf(sys) {
  return sys.mat === 'ferrite'
    ? { rIn: sys.ring.id / 2e3, rOut: sys.ring.od / 2e3, t: sys.ring.t / 1e3 }
    : { rIn: 0, rOut: sys.coreOD / 2e3, t: (sys.lAlnico || 40) / 1e3 };
}

// kL — во сколько раз сталь мотора поднимает L (по замерам на imlab: стальной корпус ×1,41, корректное ярмо ×2…5)
function shot(w, U, kL = 1, C = C0) {
  const L = w.L * kL, R = w.R + Radd;
  const r = sim(C, U, L, R, w.N), sp = split(r.ipk);
  const NI = r.ipk * w.N;
  const B = EM.MU0 * EM.Hpoint(w.layers, w.bore / 2e3, 0, NI);   // поле у стенки bore — для давления на намотку
  return { r, sp, L, NI, B, press: B * B / (2 * EM.MU0), dT: 0.9 * r.E / (w.mass * 385) };
}

// тяга к центру при смещении катушки от мотора: dL/dz ≈ (L_с_мотором − L_возд.)/Δz, сила ½I²·dL/dz
function pullToCenter(w, U, dz = 0.01, kL = 2.5) {
  return (kL - 1) * 0.5 * w.L * shot(w, U, kL).r.ipk ** 2 / dz;
}

// «воздушный охват»: поле в объёме магнита БЕЗ стали в долях от нужного H_sat — показатель того,
// насколько хорошо витки связаны с магнитом (не вердикт намагничивания: он только по B в зазоре).
function cov(w, sys, NI) { return EM.HmagAvg(w.layers, magOf(sys), NI) / MAT[sys.mat].Hsat; }

// Сколько мотать слоёв и витков. Перебираем ВСЕ намотки, которые физически влезают в окно мотора
// (высота ≤ пакет + запас, до 3 слоёв), и берём ту, что проходит ограничения: цель по МДС, импульсный
// ток банок, давление на витки, колебательность разряда (ζ ≤ 0,9 — иначе пика тока не будет вовсе).
// Ограничения считает настоящий shot()/split(), поэтому ответ зависит и от bore, и от провода с шагом,
// и от ёмкости с напряжением. Цель выбора — минимальный ток (та же МДС меньшим током, §4 «больше витков
// — бесплатно»): витки в окне до двух слоёв; третий слой только если двумя цель не берётся.
// Если цель не достигается ничем — отдаём максимум МДС и то, чем её добрать: напряжением или ёмкостью.
function recommend(sys, o) {
  const pitch = o.pitch || W.dIns, dCu = o.dCu || W.dCu, C = o.C || C0, kL = o.kL || 1, U = o.U;
  const hMax = o.hMax || sys.stackH + 25;                        // окно мотора + запас на каркас
  const iBank = o.iBankMax || 500, pressMax = o.pressMax || 1.6e6, zMax = 0.9;
  const perMax = Math.max(1, Math.floor(hMax / pitch));           // витков в слое — сколько встаёт по высоте
  const cand = [];
  for (const nL of [1, 2, 3]) for (let per = 3; per <= perMax; per++) {
    const w = wind(o.bore, per, nL, pitch, dCu), s = shot(w, U, kL, C);
    const zeta = 0.5 * (w.R + Radd) * Math.sqrt(C / s.L);         // ζ = (R/2)·√(C/L): выше 1 — разряд без пика
    const why = [];
    if (s.sp[0].I > iBank) why.push('банк ' + Math.round(s.sp[0].I) + ' А');
    if (s.press > pressMax) why.push('давление ' + (s.press / 1e6).toFixed(1) + ' МПа');
    if (zeta > zMax) why.push('ζ = ' + zeta.toFixed(2));
    cand.push({ w, s, nL, per, N: w.N, zeta, reach: s.NI >= o.NIwork, hard: why.length, why });
  }
  const ok = cand.filter(c => c.reach && !c.hard);
  let pick, alt = null;
  if (ok.length) {
    // «минимум тока»: сколько витков влезают в окно при ≤2 слоях. Ток падает с ростом витков, а МДС почти
    // не меняется ⇒ это и есть минимальные силы в намотке, минимальный ток банкам и минимальный нагрев.
    // Третий слой удваивает медь и убирает витки дальше от магнита — он нужен только если двумя цель не берётся.
    const pool = ok.filter(c => c.nL <= 2);
    const use = pool.length ? pool : ok;
    use.sort((a, b) => (b.N - a.N) || (a.nL - b.nL));
    pick = use[0];
    // «минимум меди»: самая лёгкая намотка, которая ещё берёт цель и проходит ограничения. Та же МДС
    // большим током: банкам и диодам тяжелее, импульс короче. Показываем как осознанный альтернативный выбор.
    const byCopper = ok.slice().sort((a, b) => (a.w.mass - b.w.mass) || (a.nL - b.nL) || (a.N - b.N));
    alt = byCopper[0] !== pick ? byCopper[0] : null;
  } else { const soft = cand.filter(c => !c.hard); const pool = soft.length ? soft : cand;
    pick = pool.reduce((a, b) => (b.s.NI > a.s.NI ? b : a)); }
  // нижняя граница: самая маленькая намотка, которая ещё проходит ограничения, и почему меньше нельзя
  const low = cand.filter(c => !c.hard).reduce((a, b) => (!a || b.N < a.N) ? b : a, null);
  // почему нельзя меньше — у ближайшей НЕпроходящей намотки под границей (а не у самой первой в списке)
  const below = cand.filter(c => c.hard && (!low || c.N < low.N)).reduce((a, b) => (!a || b.N > a.N) ? b : a, null);
  // чем добрать МДС, если не берём: напряжением при данной ёмкости либо ёмкостью при данном U
  let need = null;
  if (!pick.reach) {
    const solve = (mode, lo, hi) => {
      const ni = (x) => shot(pick.w, mode === 'U' ? x : U, kL, mode === 'U' ? C : x).NI;
      if (ni(hi) < o.NIwork) return null;
      for (let i = 0; i < 26; i++) { const mid = (lo + hi) / 2; if (ni(mid) >= o.NIwork) hi = mid; else lo = mid; }
      return hi;
    };
    need = { U: solve('U', U, U * 10), C: solve('C', C, C * 100) };
  }
  return { w: pick.w, s: pick.s, nL: pick.nL, per: pick.per, hMax, perMax, nMax: perMax * 3, zeta: pick.zeta,
    reaches: pick.reach, why: pick.why, nMin: low ? low.N : null, nMinWhy: below ? below.why : [],
    need, alt, tried: cand.length };
}

// цена зазора между намоткой и магнитом: одна и та же намотка при разном bore.
function boreScan(sys, bores, { per = 14, nL = 2, US = [150, 180] } = {}) {
  return bores.map(bore => {
    const w = wind(bore, per, nL), by = {};
    for (const U of US) {
      const s = shot(w, U, 1);
      by[U] = { ...s, cov: cov(w, sys, s.NI) };
    }
    return { w, by };
  });
}

// Короткозамкнутый виток вокруг мотора: поле от нашей намотки на радиусе корзины → ЭДС на фронте,
// ток, сила и доля энергии банка. Есть не у всех головок: у 3ГД-2 и 10ГД-35 установочный фланец и
// линза пластмассовые — витка нет; у 4ГД-35 корзина штампованная сталь (ρ в 5 раз выше алюминия,
// стенка тонкая ⇒ ток на порядок меньше); у 10ГД-34 и 15ГД-14 — литой алюминий, он и есть виток.
// Сечения a×b — прикидка по типовой геометрии этих корзинок, поэтому оценка ВЕРХНЯЯ: реакция витка
// (она гасит dI/dt) не учитывается, ток и сила завышены.
const BASKET = {
  'cast-al':       { rho: 2.8e-8, a: 6e-3, b: 8e-3, name: 'литая алюминиевая корзина' },
  'al-cover':      { rho: 2.8e-8, a: 0.5e-3, b: 25e-3, name: 'тонкий алюминиевый кожух над магнитом' },
  'steel-stamped': { rho: 1.5e-7, a: 1.0e-3, b: 25e-3, name: 'штампованная стальная корзина' },
  plastic:         { rho: null, a: 0, b: 0, name: 'пластмассовый фланец и линза' },
};

function basketEffect(w, sys, NI, tpk, o = {}) {
  const kind = o.kind || (sys.basket && sys.basket.kind) || 'cast-al', m = BASKET[kind];
  if (!m || m.rho === null) return null;                     // неметаллическая оснастка головки — витка нет
  const a = o.a || m.a, b = o.b || m.b;                      // сечение стенки кольца, м
  const rWant = sys.flangeOD / 2e3 + 3e-3;                   // кольцо корзины у фланца
  const r = Math.min(rWant, w.bore / 2e3 - 1e-3);            // за пределом bore поле от витков уже не то — берём у стенки
  const l = 2 * Math.PI * r, A = Math.PI * r ** 2;
  const R = (o.rho || m.rho) * l / (a * b);                  // ρ сплава/стали
  const L2 = EM.MU0 * r * (Math.log(8 * r / a) - 2);         // круговое кольцо прямоугольного сечения
  const B = EM.MU0 * EM.Hpoint(w.layers, r, 0, NI);          // Тл в пике, без учёта стали и экрана
  const emf = A * B / tpk, I = emf / R;
  const M = A * B / (NI / w.N);                              // взаимная индукция: поток через кольцо / ток витка
  const om2 = 1 / (w.L * C0);                                // ω² колебательного разряда
  return { kind, name: m.name, r, rWant, clamped: r < rWant, l, R, L2, M, B, emf, I, F: B * l * I,
    E: I * I * R * tpk, Rref: om2 * M * M / R };
}

module.exports = { W, C0, Radd, f, wind, magOf, shot, pullToCenter, boreScan, basketEffect, BASKET, cov, recommend };
