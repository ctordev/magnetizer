// Решатель режима разряда банка на оснастку: RLC с тиристором VT1 и диодом свободного хода VD6.
// Общий модуль для master.js (оснастка проекта) и calc/coils/ (оснастки под динамики 10ГД-34/10ГД-30Е) —
// одна модель на все документы, чтобы цифры не разъезжались.
// Пуск напрямую: node calc/src/rlc.js — прогон оснастки проекта для контроля, что вынос ничего не изменил.
// Банк (23.11.2026): 10 × EPCOS B43560-S9478-M1 (4700 мкФ / 400 В, б/у), ESRmax 40 мОм/шт по каталогу
// B43560/B43580 ⇒ суммарно 4 мОм. Замеренные ESR б/у заменить здесь после приёмки (чувствительность:
// ×3 к ESR ⇒ −14% к I_pk, см. §3.2). Если банка другая — пересчитать Rs = ESRшт / n.
const Rs = 0.0040, VF = 1.2, VSCR = 1.5, IH = 0.5, dt = 2e-6;   // ESR банка, падения VD6/VT1, ток удержания, шаг

// отечественные компоненты установки (см. BOM в magnetizer.html)
const T253 = { itsm: 28e3, i2t: 3920e3, dit: 200, u0: 0.95, rt: 0.2e-3, igt: 0.2 };   // VT1 Т253-1250-16
const VL200 = { i2t: 180e3, itsm: 6e3 };                                              // VD6 = 2× ВЛ200
// VT1 упрощённой версии (calc/coils/simple.js, magnetizer-simple.html) — Т160/Т161-160, паспорт:
// Itsm = 4000 А (полуволна 10 мс, Тп = 125 °C, неповторяющийся) ⇒ i²t = 4000²·(10/2) мс = 80 кА²·с;
// (di/dt)кр = 80 А/мкс; tвыкл ≤ 250 мкс; Uпр ≤ 1,75 В при 3,14·160 = 502 А и r_д = 1,4 мОм
// ⇒ U0 = 1,75 − 1,4·0,502 = 1,05 В; Iу.от = 0,2 А (25 °C); класс 6 = 600 В, максимально допустимое
// постоянное Uзс = 0,75·600 = 450 В. Теплоёмкость кристалла выводим из условия Itsm (см. simple.js).
const T160 = { itsm: 4000, i2t: 80e3, dit: 80, tq: 250e-6, u0: 1.05, rt: 1.4e-3, igt: 0.2, cls: 600 };

function sim(C, U0, L, Rf, N) {            // A: с VD6, B: без VD6
  const T = 0.25;
  let u = U0, iL = 0, i = 0, iD = 0, scr = true, dio = false, tdi = null, tc = null, tpk = 0;
  let ipk = 0, i2tD = 0, i2tS = 0, umin = 1e9, ni = 0, ELc = 0, ipkS = 0, dmx = 0, hist = [];
  for (let n = 0; n < T / dt; n++) {
    const t = n * dt;
    if (scr) {
      let diL = (u - VSCR - (Rs + Rf) * iL) / L;
      const vfix = u - VSCR - Rs * iL;
      let i2 = iL, d = false;
      if (vfix < -VF) { d = true; i2 = (u - VSCR + VF) / Rs; diL = (-VF - Rf * iL) / L; if (iL - i2 < 0) { d = false; i2 = iL; diL = (u - VSCR - (Rs + Rf) * iL) / L; } }
      if (d && tdi === null) tdi = t;
      if (i2 <= 0 && iL > 0) { scr = false; tc = t; d = true; i2 = 0; diL = (-VF - Rf * iL) / L; ELc = 0.5 * L * iL * iL; }
      iL += diL * dt; i = i2; iD = d ? iL - i : 0;
      if (tc === null && d && i < IH) { tc = t; ELc = 0.5 * L * iL * iL; }
      ipkS = Math.max(ipkS, i);
    } else { i = 0; iD = iL; iL += (-VF - Rf * iL) / L * dt; }
    u -= i * dt / C; ipk = Math.max(ipk, iL);

    i2tD += iD * iD * dt; i2tS += i * i * dt; ni += iL * dt; umin = Math.min(umin, u);
    if (n % 20 === 0 && t < 0.09) {
      // шаг истории — 20 шагов интегрирования, поэтому и производная по 20*dt (100*dt занижала di/dt в 5 раз)
      if (hist.length > 1) { const d = (iL - hist[hist.length - 1][1]) / (20 * dt); if (d > dmx) { dmx = d; } }
      hist.push([+t.toFixed(5), iL, u, iD, i]);
    }
  }
  let u2 = U0, i2 = 0, ipk2 = 0, tc2 = null, umin2 = 1e9, ni2 = 0, i2t2 = 0, hist2 = [];
  for (let n = 0; n < T / dt; n++) {
    if (tc2 === null) { i2 += (u2 - VSCR - (Rs + Rf) * i2) / L * dt; u2 += -i2 / C * dt; i2t2 += i2 * i2 * dt; if (i2 <= 0) { tc2 = n * dt; i2 = 0; } ipk2 = Math.max(ipk2, i2); ni2 += i2 * dt; }
    umin2 = Math.min(umin2, u2);
    if (n % 20 === 0 && n * dt < 0.09) hist2.push([+(n * dt).toFixed(5), i2, u2, 0, i2]);
  }
  const imax = hist.reduce((m, p) => Math.max(m, p[1]), 0);
  const tpk2 = hist.find(p => p[1] >= imax * 0.9995)[0];
  return { C, U0, L, Rf, N, ipk, tpk: tpk2, tc, tdi, i2tD, i2tS, umin, ni, ELc, ipkS, dmx, tau: L / (Rf + Rs), Thalf: Math.PI * Math.sqrt(L * C),
           E: 0.5 * C * U0 * U0, Q: C * U0, B: { ipk: ipk2, tc: tc2, umin: umin2, ni: ni2, i2t: i2t2, hist: hist2 }, hist };
}
// Состав рабочего банка: однотипный 10×EPCOS — ESL на деление не влияет (ровно I/n), но boost-составы считают по частам
const BANK_PARTS = [[4700, 10, 30]];
function splitParts(Ipk, parts) {          // деление по Z=sqrt(ESL/C)
  const z = parts.map(([uf, n, esl]) => ({ uf, n, z: Math.sqrt(esl * 1e-9 / (uf * 1e-6)) }));
  const k = Ipk / z.reduce((s, x) => s + x.n / x.z, 0);
  return z.map(x => ({ uf: x.uf, n: x.n, I: k / x.z }));
}
function split(Ipk) { return splitParts(Ipk, BANK_PARTS); }

// Оценка режима тиристора в импульсе — общая для всех скриптов, чтобы оценка была одна и та же
// и в консоли, и в документах: пик и i²t против паспорта + ΔTj кристалла за выстрел.
// Теплоёмкость кристалла выводим из условия Itsm: полуволна 10 мс с пиком itsm даёт на переходе
// E = U0·Q + r_t·i²t и поднимает его на 125 К (паспортный Itsm задан при Тп = 125 °C) ⇒ Cth = E/125.
// Q_тир и i²t берём из истории sim() по току тиристора (он несёт только передний фронт импульса).
function scrStress(r, scr) {
  const Qs10 = 2 / Math.PI * scr.itsm * 0.01, i2t10 = scr.itsm ** 2 * 0.005;
  const Cth = (scr.u0 * Qs10 + scr.rt * i2t10) / 125;
  const h = r.hist;
  const QS = h.reduce((s, p, n) => n ? s + (p[4] + h[n - 1][4]) / 2 * (p[0] - h[n - 1][0]) : s, 0);
  const ES = VSCR * QS + scr.rt * r.i2tS;
  let iLtc = 0;                                                 // ток катушки в момент гашения тиристора
  for (const p of h) if (p[0] <= r.tc) iLtc = p[1];
  return { Cth, QS, ES, dTj: ES / Cth, pctItsm: r.ipk / scr.itsm, pctI2t: r.i2tS / scr.i2t,
           dit: r.dmx / 1e6, ditPct: r.dmx / 1e6 / scr.dit, tRev: r.Thalf - r.tc, tq: scr.tq,
           dVdt: iLtc / r.C / 1e6, iLtc };
}

module.exports = { sim, split, splitParts, scrStress, BANK_PARTS, T253, T160, VL200, Rs, VF, VSCR, IH, dt };

if (require.main === module) {
  const EM = require('./em.js');
  const r = sim(47.0e-3, 300, EM.FIX.L, 0.012, 24);   // R: обмотка 8.5 + шины/тиристор 3.5 (ESR банка — Rs)
  console.log('контроль после выноса: 47 мФ (10×4700 EPCOS) / 300 В / оснастка проекта → I_pk=' + (r.ipk / 1e3).toFixed(2) +
    ' кА, N·I=' + (24 * r.ipk / 1e3).toFixed(0) + ' кА·вит, T/2=' + (r.Thalf * 1e3).toFixed(1) + ' мс');
}
