// §2, рисунок 1: осциллограмма контура — ток оснастки L1, ток VT1, ток VD6, напряжение банка,
// плюс врезка фронта. Данные — из calc/src/vd6_data.json (пишет master.js): одна модель и для
// этого рисунка, и для таблиц. Пуск: node calc/src/fig_d2.js → calc/out/fig_d2.svg (+ .frag.html
// для вшивки в magnetizer.html: то же тело, но без standalone-шапки — классы .lbl/.lblb даёт CSS
// документа; цветные подписи — inline style="fill:…", атрибут fill класс бы перебил).
// Шрифт подписей — моноширинный класс документа: метрики предсказуемы, раскладка считается
// под JetBrains Mono (строка 12px ≈ 7.2px ширины, bbox ≈ 16px).
const fs = require('fs');
const D = JSON.parse(fs.readFileSync(__dirname + '/vd6_data.json', 'utf8'));
const M = D.meta, A = D.A;                    // [t, i_оснастки, u_банка, i_VD6, i_VT1]

const IMAX = Math.ceil((M.ipkA / 1000) * 1.25 / 2) * 2;
let TEND = 0.02; for (const p of A) if (Math.abs(p[1]) > M.ipkA * 0.01) TEND = p[0];
const TMAX = Math.ceil((TEND + 0.003) / 0.01) * 0.01, TSTEP = TMAX / 8;
const INSET = Math.min(0.012, Math.ceil(M.tcommA * 1e3 * 1.8 / 2) / 1e3);
const AV = A.filter(p => p[0] <= TMAX + 1e-9);   // видимое окно: за TMAX путь обрезался бы viewBox'ом

const W = 1320, H = 560, PL = 118, PR = 1252, PT = 64, PB = 432;
const X = t => PL + (PR - PL) * t / TMAX, Y = k => PB - (PB - PT) * k / IMAX, YU = v => PB - (PB - PT) * (v / M.U0);
const line = (arr, fx, fy) => arr.map((p, n) => (n ? 'L' : 'M') + fx(p).toFixed(1) + ' ' + fy(p).toFixed(1)).join(' ');
const area = 'M' + X(0).toFixed(1) + ' ' + PB + ' ' + AV.map(p => 'L' + X(p[0]).toFixed(1) + ' ' + Y(p[1] / 1e3).toFixed(1)).join(' ') +
  ' L' + X(AV[AV.length - 1][0]).toFixed(1) + ' ' + PB + ' Z';

// сетка и шкалы основной панели (подписи — .lbl, шаг строк ≥19px по bbox моно 12px)
let g = '';
for (let q = 0; q <= 8; q++) { const ms = Math.round(TMAX * 1000 * q / 8), x = X(ms / 1e3);
  g += `<path d="M${x.toFixed(1)} ${PT} V${PB}" stroke="#2b3140" stroke-width="1"/>` +
       `<text x="${x.toFixed(1)}" y="${PB + 22}" text-anchor="middle" class="lbl">${ms}</text>`; }
for (let q = 0; q <= 5; q++) { const kA = Math.round(IMAX * q / 5), y = Y(kA);
  g += `<path d="M${PL} ${y.toFixed(1)} H${PR}" stroke="#2b3140" stroke-width="1"/>` +
       `<text x="${PL - 12}" y="${(y + 5).toFixed(1)}" text-anchor="end" class="lbl">${kA}</text>`; }
for (let v = 0; v <= M.U0; v += 100) { const y = YU(v); g += `<text x="${PR + 12}" y="${(y + 5).toFixed(1)}" class="lbl" style="fill:#6b7789">${v}</text>`; }

// врезка фронта: рамка на 68…320, заголовок внутри, верхняя метка шкалы не наезжает на него
const IL = 470, IR = 780, IT = 96, IB = 290, XT = t => IL + (IR - IL) * t / INSET, YT = k => IB - (IB - IT) * k / IMAX;
let gi = '';
for (let q = 0; q <= 4; q++) { const ms = Math.round(INSET * 1000 * q / 4), x = XT(ms / 1e3);
  gi += `<path d="M${x.toFixed(1)} ${IT} V${IB}" stroke="#2b3140" stroke-width="1"/>` +
        `<text x="${x.toFixed(1)}" y="${IB + 18}" text-anchor="middle" class="lbl">${ms}</text>`; }
for (let q = 0; q <= 4; q++) { const kA = Math.round(IMAX * q / 4), y = YT(kA);
  gi += `<text x="${IL - 8}" y="${(y + 5).toFixed(1)}" text-anchor="end" class="lbl">${kA}</text>`; }

const ELc = 0.5 * M.L * Math.pow(M.ipkA, 2) / 1e3;
const XT_ = X(M.tcommA).toFixed(1);
const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Осциллограмма тока диода VD6 и тиристора">
<text x="24" y="30" class="lblb">Осциллограмма контура: банк ${(M.C * 1e3).toFixed(1)} мФ (10 × EPCOS 4700 мкФ), ${M.U0} В, оснастка 2 слоя × 12 витков / ${(M.L * 1e6).toFixed(0)} мкГн / контур 16 мОм (обмотка 8.5 + шины 3.5 + ESR 4.0)</text>
<text x="24" y="50" class="lbl">модель: C→VT1(Т253-1250)→(L, r) с VD6 на клеммах оснастки; VD6 = 2× ВЛ200 (1,84 В + 1,37 мОм), тиристор гаснет на нуле тока</text>
${g}
<path d="${area}" fill="#4da3ff" fill-opacity="0.13"/>
<path d="${line(AV, p => X(p[0]), p => Y(p[1] / 1e3))}" stroke="#e8ecf3" stroke-width="2.2" fill="none"/>
<path d="${line(AV.filter(p => p[4] > 0), p => X(p[0]), p => Y(p[4] / 1e3))}" stroke="#4da3ff" stroke-width="2.6" fill="none"/>
<path d="${line(AV.filter(p => p[3] > 0), p => X(p[0]), p => Y(p[3] / 1e3))}" stroke="#43c59e" stroke-width="2.4" fill="none"/>
<path d="${line(AV, p => X(p[0]), p => YU(p[2]))}" stroke="#8892a4" stroke-width="1.6" fill="none" stroke-dasharray="6 4"/>
<path d="M${XT_} ${PT} V${PB}" stroke="#ffb020" stroke-width="1.6" stroke-dasharray="5 4"/>
<rect x="${IL - 46}" y="${IT - 28}" width="${IR - IL + 66}" height="${IB - IT + 58}" fill="#161a20" stroke="#3a4557" stroke-width="1.2"/>
<text x="${IL - 34}" y="${IT - 14}" class="lbl">врезка фронта 0…${Math.round(INSET * 1000)} мс · di/dt(0) = ${(M.U0 / M.L / 1e6).toFixed(1)} А/мкс</text>
${gi}
<path d="${line(A.filter(p => p[0] <= INSET), p => XT(p[0]), p => YT(p[1] / 1e3))}" stroke="#e8ecf3" stroke-width="2" fill="none"/>
<text x="${PL}" y="${PB + 45}" class="lbl">мс · ток, кА (левая шкала) · напряжение банка, В (правая)</text>
<text x="${PL + 40}" y="${PB + 69}" class="lbl" style="fill:#e8ecf3">— ток оснастки L1</text>
<text x="${PL + 192}" y="${PB + 69}" class="lbl" style="fill:#4da3ff">— ток VT1</text>
<text x="${PL + 307}" y="${PB + 69}" class="lbl" style="fill:#43c59e">— ток VD6</text>
<text x="${PL + 417}" y="${PB + 69}" class="lbl" style="fill:#8892a4">— напряжение банка</text>
<text x="${(X(M.tcommA) + 12).toFixed(1)}" y="${PB + 93}" class="lbl" style="fill:#ffb020">t = ${(M.tcommA * 1e3).toFixed(1)} мс — ток VT1 упал до тока удержания</text>
<text x="${(X(M.tcommA) + 12).toFixed(1)}" y="${PB + 113}" class="lbl">пик ${(M.ipkA / 1e3).toFixed(1)} кА · i²t VD6 ${(M.i2tD / 1e3).toFixed(0)} кА²с · i²t VT1 ${(M.i2tS / 1e3).toFixed(0)} кА²с · τ хвоста ${(M.tau * 1e3).toFixed(1)} мс · в L при гашении ${ELc.toFixed(2)} кДж</text>
</svg>`;

// standalone: своя шапка со стилями (классы те же, что в документе) + фон; вшиваемый
// в документ фрагмент — без шапки: классы даёт CSS документа
const head = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Осциллограмма тока диода VD6 и тиристора">
  <style>
    .lbl{fill:#98a3b5;font:12px/1.2 "JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    .lblb{fill:#e8ecf3;font:600 12.5px/1.2 "JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  </style>
  <rect x="0" y="0" width="${W}" height="${H}" fill="#0b0d12"/>
`;
fs.writeFileSync(__dirname + '/../out/fig_d2.svg', head + svg.replace(/^<svg[^>]*>\n/, '').replace(/<\/svg>$/, '') + '</svg>\n');
fs.writeFileSync(__dirname + '/../out/fig_d2.frag.html', svg + '\n');
console.log('fig_d2.svg:', (fs.statSync(__dirname + '/../out/fig_d2.svg').size / 1024).toFixed(0) + ' KB',
  '| Ipk', (M.ipkA / 1e3).toFixed(2), 'кА | tcomm', (M.tcommA * 1e3).toFixed(2), 'мс | τ', (M.tau * 1e3).toFixed(1), 'мс | i²t VD6', (M.i2tD / 1e3).toFixed(0), 'кА²с | окно', (TMAX * 1e3).toFixed(0), 'мс');
