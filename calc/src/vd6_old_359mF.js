// ИСТОРИЧЕСКАЯ модель (35.9 мФ / 350 В). Актуальная: master.js. Не перезаписывает vd6_data.json.
// A: с VD6 (диод свободным ходом, включён антипараллельно L1).  B: без VD6 (последовательный RLC).
const C = 35.9e-3, U0 = 350, L = 200e-6;
const Rf = 0.0085;      // обмотка оснастки: L/Rf = 23.5 мс — хвост затухания
const Rs = 0.0015;      // ESR банка + шины + тиристор  (полный контур 10 мОм → I_pk ~4.2 кА)
const VF = 1.2;         // падение на VD6
const VSCR = 1.5;       // прямое падение VT1 (импульсный тиристор)
const IH = 0.5;         // ток удержания тиристора, А
const dt = 2e-6, T = 0.12;

function modelA() {
  let u = U0, iL = 0, i = 0, iD = 0, diode = false, scr = true;
  let ipk = 0, tcomm = null, tdiode = null, i2tD = 0, i2tSCR = 0, umin = 1e9, urev = 0, ni = 0, ELc = 0, ipkSCR = 0, tdecay = null;
  const hist = [];
  for (let n = 0; n < T / dt; n++) {
    const t = n * dt;
    if (scr) {
      // режим «диод закрыт»: последовательный контур банк→VT1→оснастка
      let diL = (u - VSCR - (Rs + Rf) * iL) / L;
      const vfix = u - VSCR - Rs * iL;                // напряжение на выводах оснастки (A относит. «−»)
      let i2 = iL, dio = false;
      if (vfix < -VF) {                               // ЭДС самоиндукции развернулась → диод открывается
        dio = true;
        i2 = (u - VSCR + VF) / Rs;                    // напряжение оснастки зафиксировано в −VF
        diL = (-VF - Rf * iL) / L;
        if (iL - i2 < 0) { dio = false; i2 = iL; diL = (u - VSCR - (Rs + Rf) * iL) / L; }
      }
      if (dio && tdiode === null) tdiode = t;
      if (i2 <= 0 && iL > 0) {                        // тиристор выключился
        scr = false; tcomm = t; tdecay = t; dio = true; i2 = 0; diL = (-VF - Rf * iL) / L;
      }
      iL += diL * dt; i = i2; diode = dio; iD = dio ? iL - i : 0;
      if (tcomm === null && diode && i < IH) { tcomm = t; ELc = 0.5 * L * iL * iL; }   // ток ниже тока удержания — тиристор погас
      ipkSCR = Math.max(ipkSCR, i);
    } else {
      i = 0; iD = iL; iL += (-VF - Rf * iL) / L * dt;
    }
    u -= i * dt / C;
    ipk = Math.max(ipk, iL); umin = Math.min(umin, u); urev = Math.max(urev, -(u + VF));
    i2tD += iD * iD * dt; i2tSCR += i * i * dt; ni += iL * dt;
    if (n % 50 === 0) hist.push([+t.toFixed(5), iL, u, iD, i]);
  }
  return { hist, ipk, ipkSCR, tcomm, tdiode, tdecay, i2tD, i2tSCR, umin, urev, ni, ELc };
}

function modelB() {
  let u = U0, i = 0, scr = true, ipk = 0, tcomm = null, umin = 1e9, urev = 0, ni = 0, i2t = 0;
  const hist = [];
  for (let n = 0; n < T / dt; n++) {
    const t = n * dt;
    if (scr) {
      const R = Rs + Rf;
      i += (u - VSCR - R * i) / L * dt; u += -i / C * dt; i2t += i * i * dt;
      if (i <= 0) { scr = false; tcomm = t; i = 0; }
      ipk = Math.max(ipk, i); ni += i * dt;
    }
    umin = Math.min(umin, u); urev = Math.max(urev, -u);
    if (n % 50 === 0) hist.push([+t.toFixed(5), i, u, 0, i]);
  }
  return { hist, ipk, tcomm, umin, urev, ni, i2t, Eret: 0.5 * C * umin * umin };
}

const A = modelA(), B = modelB();
const f = (x, d = 1, u = 1) => (x / u).toLocaleString('ru-RU', { maximumFractionDigits: d, minimumFractionDigits: d });
const g = (m, x, k = 1) => { const p = m.hist.find(p => p[0] >= x); return p ? p[k] : 0; };
const N = 24;

console.log('=== A: с VD6 ===');
console.log('диод открывается         ', f(A.tdiode * 1000, 3), 'мс');
console.log('I_pk оснастки             ', f(A.ipk / 1000, 2), 'кА  (N·I =', f(N * A.ipk / 1000, 1), 'кА·витков)');
console.log('коммутация VT1            ', f(A.tcomm * 1000, 2), 'мс;  энергия в L1 в этот момент', f(A.ELc / 1000, 2), 'кДж');
console.log('гашение VT1: Rs·C =', f(Rs * C * 1e6, 0), 'мкс → ток VT1 спадает с', f(A.ipkSCR / 1000, 2),
            'кА до тока удержания за', f(Rs * C * Math.log(A.ipkSCR / IH) * 1000, 2), 'мс');
console.log('пик тока VT1              ', f(A.ipkSCR / 1000, 2), 'кА,  i²t VT1 =', f(A.i2tSCR / 1e3, 0), 'кА²с');
console.log('i²t VD6                   ', f(A.i2tD / 1e3, 0), 'кА²с');
console.log('u банка min               ', f(A.umin, 0), 'В;  обратное напряжение на VT1', f(A.urev, 0), 'В');
console.log('ток оснастки: 10мс', f(g(A, .01) / 1000, 2), ' 20мс', f(g(A, .02) / 1000, 2),
            ' 40мс', f(g(A, .04) / 1000, 2), ' 90мс', f(g(A, .09) / 1000, 2), 'кА');
console.log('экспозиция поля ∫N·I dt   ', f(N * A.ni, 0), 'А·виток·с');

console.log('\n=== B: без VD6 (последовательный RLC) ===');
console.log('I_pk                      ', f(B.ipk / 1000, 2), 'кА  (N·I =', f(N * B.ipk / 1000, 1), 'кА·витков)');
console.log('коммутация VT1 (ток=0)    ', f(B.tcomm * 1000, 2), 'мс — ток стал 0 только после всей обратной полуволны');
console.log('u банка в момент коммутации', f(g(B, B.tcomm, 2), 0), 'В;  min u =', f(B.umin, 0), 'В');
console.log('обратный заряд банка      ', f(0.5 * B.Eret / 1000, 2), 'кДж при', f(B.umin, 0), 'В обратной полярности');
console.log('обратное напряжение на VT1', f(B.urev, 0), 'В (тиристор должен его держать)');
console.log('ток оснастки: 6мс', f(g(B, .006) / 1000, 2), ' 8.4мс', f(g(B, .0084) / 1000, 2), 'кА, дальше 0');
console.log('экспозиция поля ∫N·I dt   ', f(N * B.ni, 0), 'А·виток·с  → в', f(A.ni / B.ni, 2), 'раза меньше');
console.log('i²t контура               ', f(B.i2t / 1e3, 0), 'кА²с');

const E = 0.5 * L * A.ipk * A.ipk;
console.log('\nесли ток', f(A.ipk / 1000, 2), 'кА срезать принудительно (crowbar VT2, dV/dt, обрыв) — в L1', f(E / 1000, 2), 'кДж:');
for (const Cp of [10e-9, 100e-9, 1e-6, 10e-6])
  console.log('  в паразитную ёмкость', f(Cp * 1e9, 0).padStart(4), 'нФ → U =', f(Math.sqrt(2 * E / Cp) / 1000, 1), 'кВ');
console.log('\nобратный банк', f(-B.umin, 0), 'В при включённом QS1: мост + вторичка (для DC — короткое), начальный ток ~', f(-B.umin / 0.06, 0), 'А');
// (запись vd6_data.json отключена: актуальные данные пишет master.js)
void ({A: A.hist, B: B.hist,
  meta: {ipkA: A.ipk, ipkB: B.ipk, tcommA: A.tcomm, tcommB: B.tcomm, uminA: A.umin, uminB: B.umin, i2tD: A.i2tD}});

