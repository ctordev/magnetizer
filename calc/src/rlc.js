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

module.exports = { sim, split, splitParts, BANK_PARTS, T253, VL200, Rs, VF, VSCR, IH, dt };

if (require.main === module) {
  const EM = require('./em.js');
  const r = sim(47.0e-3, 300, EM.FIX.L, 0.012, 24);   // R: обмотка 8.5 + шины/тиристор 3.5 (ESR банка — Rs)
  console.log('контроль после выноса: 47 мФ (10×4700 EPCOS) / 300 В / оснастка проекта → I_pk=' + (r.ipk / 1e3).toFixed(2) +
    ' кА, N·I=' + (24 * r.ipk / 1e3).toFixed(0) + ' кА·вит, T/2=' + (r.Thalf * 1e3).toFixed(1) + ' мс');
}
