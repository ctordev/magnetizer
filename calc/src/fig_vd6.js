// §3, рисунок 2: осциллограммы «с VD6 и без» — верхняя панель ток оснастки, нижняя напряжение банка.
// Данные — из calc/src/vd6_data.json (пишет master.js): одна модель и для рисунка, и для таблиц.
// Пуск: node calc/src/fig_vd6.js → calc/out/fig_vd6.svg (standalone), fig_vd6.frag.html (вшивается
// в magnetizer.html без шапки — классы .lbl/.lblb даёт CSS документа; цветные подписи — inline
// style="fill:…", атрибут fill класс бы перебил) и vd6_preview.html (предпросмотр в браузере).
// Подписи — моноширинный класс документа (строка 12px ≈ 7.2px ширины, bbox ≈ 16px), поэтому
// раскладка считается под JetBrains Mono, шаг строк ≥ 19px.
const fs = require('fs');
const D = JSON.parse(fs.readFileSync(__dirname + '/vd6_data.json', 'utf8'));
const A = D.A, B = D.B;                       // [t, i_оснастки, u_банка, i_диода, i_тиристора]
const M = D.meta;
const IMAX = Math.ceil((M.ipkA / 1000) * 1.2 / 2) * 2;            // кА
const VMIN = -Math.ceil(Math.abs(M.uminB) * 1.25 / 20) * 20;      // В
const VMAX = Math.ceil(M.U0 * 1.15 / 50) * 50;
let TEND = 0.02; for (const p of A) if (Math.abs(p[1]) > M.ipkA * 0.01) TEND = p[0];
const TMAX = Math.ceil((TEND + 0.004) / 0.01) * 0.01;
const AV = A.filter(p => p[0] <= TMAX + 1e-9), BV = B.filter(p => p[0] <= TMAX + 1e-9);  // видимое окно
const W = 1320, H = 708, PL = 96, PR = 1246;
const X = t => PL + (PR - PL) * t / TMAX;
// верхняя панель: ток 0..IMAX кА
const PT1 = 96, PB1 = 372, Y1 = k => PB1 - (PB1 - PT1) * k / IMAX;
// нижняя панель: напряжение VMIN..VMAX В
const PT2 = 452, PB2 = 640, YU = v => PB2 - (PB2 - PT2) * (v - VMIN) / (VMAX - VMIN);
const ln = (arr, fx, fy) => arr.map((p, n) => (n ? 'L' : 'M') + fx(p).toFixed(1) + ' ' + fy(p).toFixed(1)).join(' ');

// сетка: метки времени — целые мс (как у fig_d2), метки напряжения — круглые от −200 до 300,
// нулевая линия выделена (зона ниже 0 В подписана в правом верхнем углу нижней панели)
let g = '';
const TSTEP = TMAX * 1000 / 8;
for (let ms = 0; ms <= TMAX * 1000 + 0.01; ms += TSTEP) {
  const x = X(ms / 1e3).toFixed(1);
  g += `<path d="M${x} ${PT1} V${PB1}" stroke="#2b3140"/><path d="M${x} ${PT2} V${PB2}" stroke="#2b3140"/>` +
       `<text x="${x}" y="${PB1 + 20}" text-anchor="middle" class="lbl">${Math.round(ms)}</text>` +
       `<text x="${x}" y="${PB2 + 20}" text-anchor="middle" class="lbl">${Math.round(ms)}</text>`;
}
for (let i = 0; i <= 5; i++) { const kA = Math.round(IMAX * i / 5), y = Y1(kA);
  g += `<path d="M${PL} ${y.toFixed(1)} H${PR}" stroke="#2b3140"/><text x="${PL - 10}" y="${(y + 5).toFixed(1)}" text-anchor="end" class="lbl">${kA}</text>`; }
for (let v = Math.ceil(VMIN / 100) * 100; v <= VMAX; v += 100) { const y = YU(v);
  g += `<path d="M${PL} ${y.toFixed(1)} H${PR}" stroke="${v === 0 ? '#4a5568' : '#2b3140'}" stroke-width="${v === 0 ? 1.6 : 1}"/>` +
       `<text x="${PL - 10}" y="${(y + 5).toFixed(1)}" text-anchor="end" class="lbl">${v}</text>`; }
// красная зона обратной полярности на банке
g += `<rect x="${PL}" y="${YU(0).toFixed(1)}" width="${PR - PL}" height="${(YU(VMIN) - YU(0)).toFixed(1)}" fill="#e5484d" fill-opacity="0.07"/>`;

const tC = M.tcommA;
const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Осциллограммы разряда с диодом VD6 и без него">
<text x="24" y="30" class="lblb">Зачем нужен VD6: банк ${(M.C * 1e3).toFixed(1)} мФ / ${M.U0} В, оснастка 2 слоя × 12 витков / ${(M.L * 1e6).toFixed(0)} мкГн — разряд с диодом и без</text>
<text x="24" y="50" class="lbl">сплошная — с VD6 на клеммах оснастки; пунктир — без VD6 (чистый последовательный RLC). Тиристор Т253-1250 в обоих случаях выключается сам.</text>
<text x="${PL - 10}" y="${PT1 - 22}" text-anchor="end" class="lbl">I, кА</text>
<text x="${PL - 10}" y="${PT2 - 22}" text-anchor="end" class="lbl">U банка, В</text>
${g}
<path d="${ln(AV, p => X(p[0]), p => Y1(p[1] / 1000))}" stroke="#43c59e" stroke-width="2.8" fill="none"/>
<path d="${ln(BV, p => X(p[0]), p => Y1(p[1] / 1000))}" stroke="#e5484d" stroke-width="2.4" fill="none" stroke-dasharray="7 5"/>
<path d="M${X(tC).toFixed(1)} ${PT1} V${PB1}" stroke="#ffb020" stroke-width="1.6" stroke-dasharray="5 4"/>
<text x="${(X(tC) + 10).toFixed(1)}" y="${PT1 + 18}" class="lbl" style="fill:#ffb020">${(M.tcommA * 1e3).toFixed(1)} мс — тиристор погас, все ${(M.ipkA / 1e3).toFixed(1)} кА ушли в VD6</text>
<text x="${(X(tC) + 10).toFixed(1)}" y="${PT1 + 38}" class="lbl">в L1 в этот момент ${(0.5 * M.L * M.ipkA * M.ipkA / 1e3).toFixed(2)} кДж — им нужно куда-то деться</text>
<text x="${X(TMAX * 0.40).toFixed(1)}" y="${(Y1(2.3) - 20).toFixed(1)}" class="lbl" style="fill:#43c59e">ток оснастки (он же ток VD6 на хвосте):</text>
<text x="${X(TMAX * 0.40).toFixed(1)}" y="${Y1(2.3).toFixed(1)}" class="lbl" style="fill:#43c59e">живёт до ${(M.tau * 4.6 * 1e3).toFixed(0)} мс, τ = ${(M.tau * 1e3).toFixed(1)} мс, i²t диода ${(M.i2tD / 1e3).toFixed(0)} кА²с</text>
<text x="${X(TMAX * 0.16).toFixed(1)}" y="${Y1(0.35).toFixed(1)}" class="lbl" style="fill:#e5484d">без VD6: ноль на ${(M.tcommB * 1e3).toFixed(1)} мс — поле обрывается</text>
<path d="${ln(AV, p => X(p[0]), p => YU(p[2]))}" stroke="#43c59e" stroke-width="2.8" fill="none"/>
<path d="${ln(BV, p => X(p[0]), p => YU(p[2]))}" stroke="#e5484d" stroke-width="2.6" fill="none" stroke-dasharray="7 5"/>
<circle cx="${X(M.tcommB).toFixed(1)}" cy="${YU(M.uminB).toFixed(1)}" r="5" fill="none" stroke="#e5484d" stroke-width="2"/>
<text x="${X(TMAX * 0.16).toFixed(1)}" y="${(YU(M.uminB) - 34).toFixed(1)}" class="lbl" style="fill:#e5484d">${M.uminB.toFixed(0)} В на банке обратной полярности (${(0.5 * M.C * M.uminB * M.uminB / 1e3).toFixed(2)} кДж),</text>
<text x="${X(TMAX * 0.16).toFixed(1)}" y="${(YU(M.uminB) - 14).toFixed(1)}" class="lbl" style="fill:#e5484d">то же обратное напряжение держит и VT1</text>
<text x="${X(TMAX * 0.46).toFixed(1)}" y="${YU(150).toFixed(1)}" class="lbl" style="fill:#43c59e">с VD6: банк остаётся около 0 В, полярность не меняется</text>
<text x="${PR}" y="${PT2 - 22}" text-anchor="end" class="lbl">зона ниже 0 В — обратное напряжение на электролитах (паспорт: 1.5 В)</text>
<text x="${PL}" y="${H - 26}" class="lbl">Экспозиция поля ∫N·I dt: с VD6 — ${(M.N * M.niA).toFixed(0)} А·виток·с, без VD6 — ${(M.N * M.niB).toFixed(0)} А·виток·с (в ${(M.niA / M.niB).toFixed(1)} раза меньше).</text>
<text x="${PL}" y="${H - 8}" class="lbl">i²t: VD6 ${(M.i2tD / 1e3).toFixed(0)} кА²с (2×ВЛ200 → ${(100 * M.i2tD / 2 / 180e3).toFixed(0)}% на диод), VT1 ${(M.i2tS / 1e3).toFixed(0)} кА²с = ${(100 * M.i2tS / 3.92e6).toFixed(1)}% у Т253-1250.</text>
</svg>`;

// standalone: своя шапка со стилями (классы те же, что в документе) + фон; вшиваемый в документ
// фрагмент — без шапки; vd6_preview.html — обёртка для предпросмотра в браузере
const head = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Осциллограммы разряда с диодом VD6 и без него">
  <style>
    .lbl{fill:#98a3b5;font:12px/1.2 "JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    .lblb{fill:#e8ecf3;font:600 12.5px/1.2 "JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  </style>
  <rect x="0" y="0" width="${W}" height="${H}" fill="#0b0d12"/>
`;
fs.writeFileSync(__dirname + '/../out/fig_vd6.svg', head + svg.replace(/^<svg[^>]*>\n/, '').replace(/<\/svg>$/, '') + '</svg>\n');
fs.writeFileSync(__dirname + '/../out/fig_vd6.frag.html', svg + '\n');
const css = fs.readFileSync(__dirname + '/../out/charge_preview.html', 'utf8').match(/<style>[\s\S]*?<\/style>/)[0];
fs.writeFileSync(__dirname + '/../out/vd6_preview.html',
  `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>VD6</title>${css}</head><body><div class="fig">${svg}</div></body></html>`);
console.log('fig_vd6.svg + fig_vd6.frag.html + vd6_preview.html,', (svg.length / 1024).toFixed(0) + ' KB',
  '| окно', (TMAX * 1e3).toFixed(0), 'мс | точек A/B:', AV.length + '/' + BV.length);
