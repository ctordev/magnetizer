/* Живая часть документа «Катушки под 10ГД-34 / 10ГД-30Е»: калькулятор режима и графики.
   ВАЖНО: своей модели здесь нет. Функции wind/shot/cov/recommend/pullToCenter/basketEffect
   (calc/coils/winding.js), Lwind/Hpoint/HmagAvg (calc/src/em.js) и sim/split (calc/src/rlc.js)
   вшиты в страницу КАК ЕСТЬ — генератор doc10gd.js выкладывает их исходники в <script> перед этим
   файлом. Совпадение с расчётом скриптов проверяет calcCheck() — она сверяет контрольные точки,
   которые генератор посчитал в node. Файл читается генератором как есть. */
(function () {
  'use strict';

  var el = function (id) { return document.getElementById(id); };
  var nf = function (x, d) { return (isFinite(x) ? x : 0).toLocaleString('ru-RU', { maximumFractionDigits: d, minimumFractionDigits: d }); };
  var V = function (id) { return parseFloat(el(id).value); };
  var put = function (id, txt) { el(id).textContent = txt; };
  var Rtotal = function (w) { return w.R + 0.0015; };            // обмотка + шина/тиристор (как в shot)

  // ── что задал пользователь ──
  function state() {
    var k = el('k-sys').value, sys = DATA.SYS[k];
    var req = ['k-bore', 'k-per', 'k-nl', 'k-pitch', 'k-dcu', 'k-u', 'k-c', 'k-kl'];
    for (var q = 0; q < req.length; q++) if (!isFinite(V(req[q]))) return null;   // поле не дописано — не считаем
    var o = {
      bore: V('k-bore'), per: Math.round(V('k-per')), nL: Math.round(V('k-nl')),
      pitch: V('k-pitch'), dCu: V('k-dcu'), U: V('k-u'), C: V('k-c') * 1e-3, kL: V('k-kl')
    };
    var w = wind(o.bore, o.per, o.nL, o.pitch, o.dCu);
    var s = shot(w, o.U, o.kL, o.C);
    return { k: k, sys: sys, o: o, w: w, s: s, need: DATA.NEED[k], work: DATA.NEED[k] * 2.5,
      cov: cov(w, sys, s.NI), needI: DATA.NEED[k] * 2.5 / w.N };
  }

  // ── числа ──
  function readout(m) {
    var w = m.w, s = m.s, A = Math.PI / 4 * Math.pow(w.dCu / 1e3, 2), E = 0.5 * m.o.C * m.o.U * m.o.U;
    put('o-geo', 'витков ' + w.N + ' (' + w.nL + ' × ' + w.per + '), высота ' + nf(w.h, 0) + ' мм, ⌀внешн. ' + nf(w.od, 0) + ' мм');
    put('o-wire', nf(w.len, 1) + ' м меди ⌀' + nf(w.dCu, 1) + ' мм, ' + nf(w.mass, 2) + ' кг (шаг ' + nf(w.pitch, 1) + ' мм)');
    put('o-L', nf(w.L * 1e6, 0) + ' мкГн воздушная → ' + nf(s.L * 1e6, 0) + ' мкГн с головкой (×' + nf(m.o.kL, 1) + ')');
    put('o-R', nf(w.R * 1e3, 1) + ' мОм обмотки + 1,5 мОм шины/тиристора = ' + nf(Rtotal(w) * 1e3, 1) + ' мОм');
    put('o-ipk', nf(s.r.ipk / 1e3, 2) + ' кА');
    put('o-ni', nf(s.NI / 1e3, 0) + ' кА·витков');
    put('o-zap', '×' + nf(s.NI / m.need, 1) + ' к расчёту цепи (' + nf(m.need / 1e3, 0) + '), ×' + nf(s.NI / m.work, 2) + ' к цели ×2,5');
    put('o-cov', nf(m.cov * 100, 0) + ' % нужного H_sat в объёме магнита (без стали)');
    put('o-t', 'T/2 ' + nf(s.r.Thalf * 1e3, 1) + ' мс · фронт ' + nf(s.r.tpk * 1e3, 1) + ' мс · di/dt ' + nf(s.r.dmx / 1e6, 1) + ' кА/мкс · банка ' + nf(E / 1e3, 2) + ' кДж');
    put('o-bank', s.sp.map(function (x) { return nf(x.I, 0) + ' А на ' + x.n + '×' + x.uf + ' мкФ'; }).join(' · '));
    put('o-it', 'VT1 ' + nf(s.r.i2tS / T253.i2t * 100, 1) + ' % паспорта · VD6 ' + nf(s.r.i2tD / 2 / VL200.i2t * 100, 1) + ' % на диод');
    put('o-heat', '+' + nf(s.dT, 1) + ' °C за выстрел, J = ' + nf(s.r.ipk / (A * 1e6), 0) + ' А/мм², межвитковое ' + nf(s.L * (s.r.ipk / s.r.tpk) / w.N, 1) + ' В');
    put('o-force', 'давление на витки ' + nf(s.press / 1e6, 2) + ' МПа · тяга к центру при смещении 1 см ' +
      (m.o.kL > 1.05 ? '≈ ' + nf(pullToCenter(w, m.o.U, 0.01, m.o.kL) / 1e3, 0) + ' кН' : '— (её нет, пока в bore нет стали)'));
    var bk = basketEffect(w, m.sys, s.NI, s.r.tpk);
    put('o-basket', bk
      ? bk.name + ': до ' + nf(bk.I / 1e3, 1) + ' кА, ' + nf(bk.F, 0) + ' Н, ' + nf(bk.E, 0) + ' Дж = ' +
        nf(bk.E / E * 100, 0) + ' % банка, +' + nf(bk.Rref * 1e3, 1) + ' мОм к цепи разряда'
      : 'короткозамкнутого витка нет: ' + (m.sys.basket ? m.sys.basket.note : 'нет металла вокруг магнита'));

    var bad = [], ok = [], i;
    if (s.NI < m.work * 0.95) {
      // до нужного МДС доводим тем же решателем, а не формулой U·√(C/L): скидка на R и падения велика
      var U1 = m.o.U * m.work / s.NI;
      for (i = 0; i < 4; i++) U1 = U1 * m.work / shot(m.w, U1, m.o.kL, m.o.C).NI;
      bad.push('ампер-витков ' + nf(s.NI / 1e3, 0) + ' кА·витков — меньше рабочей цели ' + nf(m.work / 1e3, 1) +
        ' (×' + nf(s.NI / m.need, 1) + ' от расчёта цепи). По этой же модели цель получается при ~' +
        Math.round(U1 / 10) * 10 + ' В (у нас ступени по 30 В — ближайшая верхняя ' + (Math.ceil(U1 / 30 - 1e-9) * 30) + ' В)');
    }
    else if (s.NI < m.work) ok.push('ампер-витков ' + nf(s.NI / 1e3, 0) + ' — вровень с целью (' + nf(s.NI / m.work, 2) + ' цели), хватает');
    else ok.push('ампер-витков хватает: ' + nf(s.NI / 1e3, 0) + ' кА·витков, ×' + nf(s.NI / m.need, 1) + ' от расчёта цепи');
    if (s.sp[0].I > 500) bad.push('ток на банку ' + nf(s.sp[0].I, 0) + ' А — разумный предел этих банок ~500 А: больше витков или меньше напряжение');
    if (s.press > 1.6e6) bad.push('давление ' + nf(s.press / 1e6, 1) + ' МПа — без пропитки и бандажа намотка поедет');
    if (m.w.h > m.sys.stackH + 25) bad.push('намотка ' + nf(m.w.h, 0) + ' мм не влезает в окно ' + (m.sys.stackH + 25) +
      ' мм (пакет ' + m.sys.stackH + ' мм + запас на каркас): витков в слое не больше ' + Math.floor((m.sys.stackH + 25) / m.o.pitch));
    else if (m.w.h > m.sys.stackH + 40) bad.push('намотка ' + nf(m.w.h, 0) + ' мм сильно выше пакета (' + m.sys.stackH + ' мм): верхние витки работают плохо');
    if (m.o.bore > DATA.BM[m.k].stackMax + 40) bad.push('bore ⌀' + m.o.bore + ' далеко от магнита — связь падает быстрее, чем МДС');
    // «охват» — поле в магните при ДАННОМ токе: сам по себе он растёт с напряжением,
    // поэтому ругаться на bore можно только когда ампер-витков уже хватает
    if (s.NI >= m.work * 0.95) {
      if (m.cov >= 0.7) ok.push('связь с магнитом хорошая: охват ' + nf(m.cov * 100, 0) + ' % нужного H_sat');
      else bad.push('ампер-витки есть, но охват поля всего ' + nf(m.cov * 100, 0) + '% — витки далеко от магнита,' +
        ' уменьшить bore важнее, чем доматывать');
    } else if (m.cov < 0.45) {
      bad.push('связь с магнитом слабая и при этом напряжении (охват ' + nf(m.cov * 100, 0) + '%): с bore ⌀' +
        m.o.bore + ' мм ток тут почти не поможет — сначала уменьшить bore');
    }
    el('k-verdict').innerHTML = '<div class="' + (bad.length ? 'warn' : 'ok') + '"><b>' + (bad.length ? 'Что не так' : 'Режим проходит') +
      '.</b> ' + bad.concat(ok).join('. ') + '. Приёмка всё равно по B в зазоре: не ниже ' + nf(m.sys.BgapNom, 2) + ' Тл.</div>';
  }

  // ── рекомендуемая намотка: тот же recommend(), что в консольных таблицах, но вызванный с тем, что
  // ── ввёл пользователь: bore, провод и шаг, ёмкость, напряжение, множитель L ──
  function hint(m) {
    var r = recommend(m.sys, { bore: m.o.bore, pitch: m.o.pitch, dCu: m.o.dCu, U: m.o.U, C: m.o.C,
      kL: m.o.kL, NIwork: m.work });
    var h = '<b>Рекомендую ' + r.nL + ' слоя × ' + r.per + ' витков</b>: ' + nf(r.s.NI / 1e3, 0) + ' кА·витков' +
      ' (×' + nf(r.s.NI / m.need, 1) + ' к расчёту цепи) током ' + nf(r.s.r.ipk / 1e3, 2) + ' кА, ' +
      'L = ' + nf(r.w.L * 1e6, 0) + ' мкГн, ⌀внешн. ' + nf(r.w.od, 0) + ' мм, ' + nf(r.w.mass, 2) + ' кг меди.' +
      ' <button class="btn" onclick="kApply(' + r.nL + ',' + r.per + ')">принять ' + r.nL + ' × ' + r.per + '</button><br>' +
      '<span class="hint">Почему столько: в окно ' + nf(r.hMax, 0) + ' мм (пакет ' + m.sys.stackH + ' мм + запас на каркас)' +
      ' встаёт не больше ' + r.perMax + ' витков в слое при шаге ' + nf(m.o.pitch, 1) + ' мм. Слоёв ' + r.nL +
      (r.nL === 3 ? ' — двумя слоями не удаётся взять МДС и уложить токи в ограничения, поэтому три.' :
        r.nL === 2 ? ' — двух хватает с запасом; третий слой удвоил бы медь и убрал бы витки дальше от магнита.' :
        ' — хватает и одного слоя, дальше ток только рос бы.') +
      ' Меньше ' + (r.nMin || 1) + ' витков всего мотать нельзя: ' +
      (r.nMinWhy && r.nMinWhy.length ? 'это ' + r.nMinWhy.join(', ') + ' — за границей по току/силам/колебательности'
        : 'дальше контур уже не держит ток') + '. Выше — смысла нет: окно не позволяет. Ответ меняется вместе' +
      ' со всеми полями выше.' +
      (m.sys.flangeMeasured ? '</span>' : ' <b>⚠ У этой головки в паспорте нет ⌀ фланцев и высоты пакета</b> —' +
        ' взято ⌀' + DATA.BM[m.k].stackMax + ' и ' + m.sys.stackH + ' мм по кольцу магнита; промер образцом меняет' +
        ' и bore, и это число витков.</span>');
    if (!r.reaches) {
      h += '<br><b class="bad">Ни одна намотка, влезающая в это окно, цели ×2,5 не даёт.</b> Добирать не витками, а: ' +
        (r.need && r.need.U ? '<b>' + Math.round(r.need.U) + ' В</b> при этой ёмкости' : 'напряжением не добрать (упрётся в ζ)') +
        (r.need && r.need.C ? ' или <b>' + nf(r.need.C * 1e3, 1) + ' мФ</b> при этом напряжении' : '') + '.';
    }
    if (r.alt) {
      h += '<br><span class="hint">Вариант «меньше меди»: ' + r.alt.nL + ' × ' + r.alt.per + ' — ' + r.alt.w.N +
        ' витков, ' + nf(r.alt.w.mass, 2) + ' кг вместо ' + nf(r.w.mass, 2) + ' кг, та же МДС (' + nf(r.alt.s.NI / 1e3, 0) +
        ' кА·витков), но ток ' + nf(r.alt.s.r.ipk / 1e3, 2) + ' кА вместо ' + nf(r.s.r.ipk / 1e3, 2) + ' (банк ' +
        nf(r.alt.s.sp[0].I, 0) + ' А против ' + nf(r.s.sp[0].I, 0) + ' А) и импульс короче: T/2 ' +
        nf(r.alt.s.r.Thalf * 1e3, 1) + ' мс против ' + nf(r.s.r.Thalf * 1e3, 1) + ' мс.' +
        ' <button class="btn" onclick="kApply(' + r.alt.nL + ',' + r.alt.per + ')">принять ' + r.alt.nL + ' × ' + r.alt.per + '</button></span>';
    }
    el('k-reco').innerHTML = h;
  }

  // ── график 1: форма импульса при разных напряжениях ──
  function drawI(m) {
    var U = m.o.U, vs = [0.5, 0.7, 0.85, 1, 1.2, 1.5].map(function (k) { return Math.max(40, Math.round(U * k / 10) * 10); });
    vs = vs.filter(function (v, i) { return vs.indexOf(v) === i; });
    var T = m.s.r.Thalf * 1e3, curves = [], maxI = 0.2;
    for (var i = 0; i < vs.length; i++) {
      var s = shot(m.w, vs[i], m.o.kL, m.o.C), pts = [];
      for (var j = 0; j < s.r.hist.length; j += 15) {
        var t = s.r.hist[j][0] * 1e3;
        if (t > T * 1.25) break;
        pts.push([t, s.r.hist[j][1] / 1e3]);
      }
      maxI = Math.max(maxI, s.r.ipk / 1e3);
      curves.push({ U: vs[i], pts: pts, cur: vs[i] === U, ipk: s.r.ipk / 1e3, tpk: s.r.tpk * 1e3 });
    }
    var Wp = 760, Hp = 300, ml = 58, mr = 110, mt = 14, mb = 36;
    var X = function (t) { return ml + (Wp - ml - mr) * t / (T * 1.25); };
    var Y = function (a) { return Hp - mb - (Hp - mt - mb) * a / (maxI * 1.12); };
    var g = '<rect width="' + Wp + '" height="' + Hp + '" fill="#161a20"/>', k;
    for (i = 0; i <= 4; i++) {
      var yv = maxI * 1.12 * i / 4;
      g += '<line x1="' + ml + '" y1="' + Y(yv) + '" x2="' + (Wp - mr) + '" y2="' + Y(yv) + '" stroke="#243040"/>';
      if (i) g += '<text x="' + (ml - 6) + '" y="' + (Y(yv) + 4) + '" fill="#9fb0c8" font-size="11" text-anchor="end">' + nf(yv, 1) + '</text>';  // 0 на оси уже подписан меткой «0,0»
    }
    for (i = 0; i <= 5; i++) {
      var tv = T * 1.25 * i / 5;
      g += '<line x1="' + X(tv) + '" y1="' + mt + '" x2="' + X(tv) + '" y2="' + (Hp - mb) + '" stroke="#243040"/>' +
        '<text x="' + X(tv) + '" y="' + (Hp - mb + 13) + '" fill="#9fb0c8" font-size="11" text-anchor="middle">' + nf(tv, 1) + '</text>';
    }
    var aNeed = m.needI / 1e3;
    if (aNeed < maxI * 1.12) g += '<line x1="' + ml + '" y1="' + Y(aNeed) + '" x2="' + (Wp - mr) + '" y2="' + Y(aNeed) +
      '" stroke="#7ee0a0" stroke-dasharray="5 4"/><text x="' + (ml + 4) + '" y="' + (Y(aNeed) - 5) + '" fill="#7ee0a0" font-size="11">ток, нужный по магнитной цепи с запасом ×2,5: ' + nf(aNeed, 2) + ' кА</text>';
    for (i = 0; i < curves.length; i++) {
      var c = curves[i], d = '';
      for (k = 0; k < c.pts.length; k++) d += (k ? 'L' : 'M') + X(c.pts[k][0]).toFixed(1) + ' ' + Y(c.pts[k][1]).toFixed(1);
      g += '<path d="' + d + '" fill="none" stroke="' + (c.cur ? '#41a6ff' : '#3d5a78') + '" stroke-width="' + (c.cur ? 2.6 : 1.3) + '"/>' +
        '<circle cx="' + X(c.tpk).toFixed(1) + '" cy="' + Y(c.ipk).toFixed(1) + '" r="' + (c.cur ? 4 : 2.4) + '" fill="' + (c.cur ? '#41a6ff' : '#3d5a78') + '"/>' +
        '<text x="' + (Wp - mr + 6) + '" y="' + Math.min(Hp - mb, Math.max(mt + 10, Y(c.ipk) - 4)) + '" fill="' + (c.cur ? '#41a6ff' : '#6c86a3') +
        '" font-size="11">' + c.U + ' В · ' + nf(c.ipk, 2) + ' кА</text>';
    }
    g += '<text x="' + ((ml + Wp - mr) / 2) + '" y="' + (Hp - 6) + '" fill="#9fb0c8" font-size="11" text-anchor="middle">время, мс</text>' +
      '<text transform="rotate(-90 14 ' + ((mt + Hp - mb) / 2) + ')" x="14" y="' + ((mt + Hp - mb) / 2) +
      '" fill="#9fb0c8" font-size="11" text-anchor="middle">ток оснастки, кА</text>';
    el('k-i-chart').innerHTML = '<svg class="chart" viewBox="0 0 ' + Wp + ' ' + Hp + '" role="img" aria-label="Форма импульса тока оснастки при разных напряжениях банка">' + g + '</svg>';
  }

  // ── график 2: ампер-витки и охват поля против напряжения. Одиницы: слева кА·витков, справа %.
  // Диапазон по X строится вокруг выбранного напряжения — точка текущего режима всегда внутри графика. ──
  function drawNI(m) {
    var step = 20, u0 = Math.min(40, Math.floor(m.o.U * 0.6 / step) * step), u1 = Math.max(320, Math.ceil(m.o.U * 1.1 / step) * step);
    var us = [], pts = [], covs = [], maxNI = m.work / 1e3 * 1.3, maxCov = 1.2, U, i, s, cv;
    for (U = u0; U <= u1; U += step) us.push(U);
    for (i = 0; i < us.length; i++) {
      s = shot(m.w, us[i], m.o.kL, m.o.C); cv = cov(m.w, m.sys, s.NI) * 100;
      pts.push([us[i], s.NI / 1e3]); covs.push([us[i], cv]);
      maxNI = Math.max(maxNI, s.NI / 1e3); maxCov = Math.max(maxCov, cv);
    }
    var Wp = 760, Hp = 300, ml = 58, mr = 58, mt = 14, mb = 36;
    var X = function (u) { return ml + (Wp - ml - mr) * (u - u0) / (u1 - u0); };
    var Y = function (v) { return Hp - mb - (Hp - mt - mb) * v / maxNI; };
    var Y2 = function (v) { return Hp - mb - (Hp - mt - mb) * v / maxCov; };
    var g = '<rect width="' + Wp + '" height="' + Hp + '" fill="#161a20"/>';
    for (i = 0; i <= 4; i++) {                          // одна сетка, две шкалы: кА·витков и % охвата
      var v = maxNI * i / 4, pc = maxCov * i / 4;
      g += '<line x1="' + ml + '" y1="' + Y(v) + '" x2="' + (Wp - mr) + '" y2="' + Y(v) + '" stroke="#243040"/>' +
        '<text x="' + (ml - 8) + '" y="' + (Y(v) + 4) + '" fill="#9fb0c8" font-size="11" text-anchor="end">' + nf(v, 0) + '</text>';
      if (i) g += '<text x="' + (Wp - mr + 6) + '" y="' + (Y(v) + 4) + '" fill="#8a6bb0" font-size="11">' + nf(pc, 0) + '</text>';  // нижнюю «0» задавила бы метка «320»
    }
    var xs = (u1 - u0) > 480 ? 100 : 40;
    for (U = Math.ceil(u0 / xs) * xs; U <= u1; U += xs) g += '<line x1="' + X(U) + '" y1="' + mt + '" x2="' + X(U) +
      '" y2="' + (Hp - mb) + '" stroke="#243040"/><text x="' + X(U) + '" y="' + (Hp - mb + 13) + '" fill="#9fb0c8" font-size="11" text-anchor="middle">' + U + '</text>';
    if (maxCov > 1.02 * 100) g += '<line x1="' + ml + '" y1="' + Y2(100) + '" x2="' + (Wp - mr) + '" y2="' + Y2(100) +
      '" stroke="#8a6bb0" stroke-dasharray="2 4"/><text x="' + (ml + 6) + '" y="' + (Y2(100) - 5) + '" fill="#8a6bb0" font-size="11">поле в магните = H_sat: дальше намагничение почти не растёт</text>';
    [[m.need / 1e3, '#ff9a9a', 'нужно по магнитной цепи '], [m.work / 1e3, '#7ee0a0', 'рабочая цель ×2,5 ']].forEach(function (q) {
      g += '<line x1="' + ml + '" y1="' + Y(q[0]) + '" x2="' + (Wp - mr) + '" y2="' + Y(q[0]) + '" stroke="' + q[1] + '" stroke-dasharray="5 4"/>' +
        '<text x="' + (ml + 6) + '" y="' + (Y(q[0]) - 5) + '" fill="' + q[1] + '" font-size="11">' + q[2] + nf(q[0], 0) + ' кА·витков</text>';
    });
    function line(arr, Yf) { var d = '', i; for (i = 0; i < arr.length; i++) d += (i ? 'L' : 'M') + X(arr[i][0]).toFixed(1) + ' ' + Yf(arr[i][1]).toFixed(1); return d; }
    g += '<path d="' + line(covs, Y2) + '" fill="none" stroke="#8a6bb0" stroke-width="1.5" stroke-dasharray="6 4"/>' +
      '<path d="' + line(pts, Y) + '" fill="none" stroke="#41a6ff" stroke-width="2.4"/>';
    var mx = X(m.o.U), my = Y(m.s.NI / 1e3), flip = mx > Wp - mr - 200;
    g += '<circle cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="5" fill="#41a6ff"/>' +
      '<text x="' + (mx + (flip ? -9 : 9)).toFixed(1) + '" y="' + (my - 9).toFixed(1) + '" fill="#41a6ff" font-size="12"' +
      (flip ? ' text-anchor="end"' : '') + '>' + nf(m.s.NI / 1e3, 0) + ' кА·вит при ' + m.o.U + ' В · охват ' + nf(m.cov * 100, 0) + ' %</text>' +
      '<text x="' + ((ml + Wp - mr) / 2) + '" y="' + (Hp - 6) + '" fill="#9fb0c8" font-size="11" text-anchor="middle">напряжение банка, В</text>' +
      '<text transform="rotate(-90 14 ' + ((mt + Hp - mb) / 2) + ')" x="14" y="' + ((mt + Hp - mb) / 2) +
      '" fill="#9fb0c8" font-size="11" text-anchor="middle">N·I при этих витках, кА·витков</text>' +
      '<text transform="rotate(90 ' + (Wp - 12) + ' ' + ((mt + Hp - mb) / 2) + ')" x="' + (Wp - 12) + '" y="' + ((mt + Hp - mb) / 2) +
      '" fill="#8a6bb0" font-size="11" text-anchor="middle">охват поля, % от H_sat</text>';
    el('k-ni-chart').innerHTML = '<svg class="chart" viewBox="0 0 ' + Wp + ' ' + Hp + '" role="img" aria-label="Ампер-витки и охват поля в зависимости от напряжения банка">' + g + '</svg>';
  }

  function calc() {
    var m = state();
    if (!m) { el('k-verdict').innerHTML = '<div class="warn">Поле заполнено не полностью — как допишете, пересчитаю.</div>'; return; }
    readout(m); hint(m); drawI(m); drawNI(m);
  }

  // ── самопроверка: страница должна повторять числа node-скриптов ──
  function calcCheck() {
    var rows = DATA.SELFTEST, bad = 0;
    if (!rows || !rows.length) return true;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], w = wind(r[0], r[1], r[2], r[3], r[4]), s = shot(w, r[5], r[6], r[7] * 1e-3);
      var dev = Math.max(Math.abs(w.L * 1e6 - r[8]) / r[8], Math.abs(s.r.ipk - r[9]) / r[9], Math.abs(s.NI - r[10]) / r[10]);
      if (dev > 2e-3) { bad++; console.error('calcCheck: расхождение ' + (dev * 100).toFixed(2) + '% — ⌀' + r[0] + ', ' + r[2] + '×' + r[1] + ', ' + r[5] + ' В'); }
    }
    el('k-check').className = 'badge ' + (bad ? 'kb-warn' : 'kb-ok');
    el('k-check').textContent = bad ? 'РАСХОЖДЕНИЕ с calc/coils: ' + bad + ' из ' + rows.length + ' точек'
      : 'модель страницы совпадает с calc/coils: ' + rows.length + '/' + rows.length + ' контрольных точек';
    console.log('calcCheck: ' + el('k-check').textContent);
    return bad === 0;
  }

  window.kApply = function (nL, per) {          // принять рекомендацию (или её вариант) в поля
    if (nL) el('k-nl').value = nL;
    if (per) el('k-per').value = per;
    calc();
  };
  window.kSet = function (id, v) { el(id).value = v; kRecalc(); };
  window.kSys = function () {
    var k = el('k-sys').value, p = DATA.PREFILL[k], sys = DATA.SYS[k], bm = DATA.BM[k];
    el('k-borehint').textContent = 'ориентир ⌀' + bm.bore + ' = пакет ⌀' + bm.stackMax + ' + 5 мм на сторону' +
      (sys.flangeMeasured ? '' : '; ⚠ ⌀ фланцев и высота пакета не измерены — приняты по ⌀ магнита');
    ['bore', 'per', 'nl', 'pitch', 'dcu', 'u', 'c', 'kl'].forEach(function (k) { if (p[k] !== undefined) el('k-' + k).value = p[k]; });
    el('k-borepreset').value = ''; calc();
  };
  window.kBore = function () { var v = parseFloat(el('k-borepreset').value); if (v) { el('k-bore').value = v; calc(); } };
  var timer = null;
  window.kRecalc = function () { if (timer) clearTimeout(timer); timer = setTimeout(calc, 120); };
  window.kCalc = calc;      // пересчитать сразу (им пользуются самопроверки и отладка страницы)

  calc();
  calcCheck();
})();
