/* Проверка геометрии схем (ГОСТ/ЕСКД) в браузере: пересечения проводников,
 * наложения, подписи на проводниках/рамках/друг на друге, выход за viewBox.
 *
 * Как запускать: python3 -m http.server 8811 в каталоге проекта, открыть
 * http://127.0.0.1:8811/<документ>.html?cb=N (или отдельный calc/src/*.svg,
 * свежий ?cb= против кэша), затем browser.evaluate со скриптом = содержимому
 * этого файла. За один вызов проверяются ВСЕ svg[viewBox] документа; 3D-вьюверы
 * (#fxsvg и svg внутри .fx) пропускаются — их подписи ставятся в проекции и
 * статической геометрии не имеют. Пустой массив issues = документ чист.
 *
 * Тексты измеряются экранными прямоугольниками, пересчитанными в координаты viewBox
 * обратным CTM корневого svg: так учитывается и letterbox (отдельно открытый .svg
 * центрируется в окне — простой пересчёт от края элемента давал ложные сантиметры),
 * и собственный transform текста (повёрнутые заголовки осей), который getBBox
 * игнорирует и из-за которого были ложные «outsideViewBox». Если фигура не
 * отрисована (нулевые размеры), включается запасной путь через getBBox.
 *
 * Правила разбора:
 *  - проводник = <path class="w">; класс w2 (штриховые цепи управления, механические
 *    связи, магнитопровод условно) и пути без класса (символы: треугольники VS1 и т.п.)
 *    в проверке пересечений НЕ участвуют;
 *  - дуги a/A (полувитки катушек) пропускаются: отрезком они не являются;
 *  - в парсере d токен «M» НЕ является сегментом, а сдвиг индекса обязан учитывать
 *    букву команды — иначе результаты ложные;
 *  - касание концом в проводник = соединение (junctions), а не пересечение;
 *    коллинеарное касание концами тоже соединение;
 *  - для наклонных проводников расстояние до подписи считается по истинной геометрии
 *    (огибать bounding box нельзя: диагональ «накрывает» подпись по bbox, не касаясь).
 *  - рамки проверяются только у rect с fill="none" (стальной магнитопровод — заливка).
 *
 * Что должно быть в ответе: figures (сколько проверено), ok (сколько без замечаний),
 * issues[] — по фигурам с непустыми списками: crossings [], collinearOverlap [],
 * textOnWire [], textOnText [], outsideViewBox [], textOnFrame [].
 */
(() => {
  const svgs = [...document.querySelectorAll('svg[viewBox]')]
    .filter(s => s.id !== 'fxsvg' && !s.closest('.fx'));
  const all = [...document.querySelectorAll('svg')];
  const issues = []; let ok = 0;

  for (const svg of svgs) {
    const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    const VX = vb[0], VY = vb[1], VW = vb[2], VH = vb[3], EPS = 1.5;
    const wires = []; let arcs = 0, wid = 0;
    for (const p of svg.querySelectorAll('path')) {
      const cls = (p.getAttribute('class') || '').split(/\s+/);
      if (!cls.includes('w') || cls.includes('w2')) continue;
      const d = p.getAttribute('d') || '';
      const toks = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
      let x = 0, y = 0, cmd = '', cur = null, i = 0;
      const start = () => { if (cur && cur.segs.length) wires.push(cur); cur = { w: wid++, d: d.slice(0, 18), segs: [] }; };
      while (i < toks.length) {
        const t = toks[i];
        if (/[A-Za-z]/.test(t)) { cmd = t; i++; }
        const C = cmd.toUpperCase(), rel = (cmd !== C);
        const N = () => parseFloat(toks[i++]);
        if (C === 'M' || C === 'L') {
          const dx = N(), dy = N(), X = rel ? x + dx : dx, Y = rel ? y + dy : dy;
          if (C === 'M') start(); else if (!cur) start();
          if (C === 'L' && cur && (X !== x || Y !== y)) cur.segs.push({ x1: x, y1: y, x2: X, y2: Y });
          x = X; y = Y; if (C === 'M') cmd = rel ? 'l' : 'L';
        } else if (C === 'H' || C === 'V') {
          const v = N(), X = C === 'H' ? (rel ? x + v : v) : x, Y = C === 'V' ? (rel ? y + v : v) : y;
          if (!cur) start(); if (X !== x || Y !== y) cur.segs.push({ x1: x, y1: y, x2: X, y2: Y }); x = X; y = Y;
        } else if (C === 'A') { i += 5; const dx = N(), dy = N(); x = rel ? x + dx : dx; y = rel ? y + dy : dy; arcs++; }
        else if (C === 'C') { i += 4; const dx = N(), dy = N(); x = rel ? x + dx : dx; y = rel ? y + dy : dy; arcs++; }
        else i++;
      }
      if (cur && cur.segs.length) wires.push(cur);
    }
    const inter = (a, b) => {
      const d1 = (a.x2 - a.x1) * (b.y1 - a.y1) - (a.y2 - a.y1) * (b.x1 - a.x1),
        d2 = (a.x2 - a.x1) * (b.y2 - a.y1) - (a.y2 - a.y1) * (b.x2 - a.x1),
        d3 = (b.x2 - b.x1) * (a.y1 - b.y1) - (b.y2 - b.y1) * (a.x1 - b.x1),
        d4 = (b.x2 - b.x1) * (a.y2 - b.y1) - (b.y2 - b.y1) * (a.x2 - b.x1);
      return (d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0) &&
        Math.abs(d1) > 1e-9 && Math.abs(d2) > 1e-9 && Math.abs(d3) > 1e-9 && Math.abs(d4) > 1e-9;
    };
    const coll = (a, b) => {
      const c1 = (a.x2 - a.x1) * (b.y1 - a.y1) - (a.y2 - a.y1) * (b.x1 - a.x1),
        c2 = (a.x2 - a.x1) * (b.y2 - a.y1) - (a.y2 - a.y1) * (b.x2 - a.x1);
      if (Math.abs(c1) > 2 || Math.abs(c2) > 2) return false;
      const h = Math.abs(a.y2 - a.y1) < Math.abs(a.x2 - a.x1), k = h ? 'x' : 'y';
      const a1 = Math.min(a[k + '1'], a[k + '2']), a2 = Math.max(a[k + '1'], a[k + '2']);
      const b1 = Math.min(b[k + '1'], b[k + '2']), b2 = Math.max(b[k + '1'], b[k + '2']);
      return Math.min(a2, b2) - Math.max(a1, b1) > 1;
    };
    const onSeg = (px, py, s) => {
      const cr = (s.x2 - s.x1) * (py - s.y1) - (s.y2 - s.y1) * (px - s.x1);
      if (Math.abs(cr) > 2) return false;
      const dot = (px - s.x1) * (s.x2 - s.x1) + (py - s.y1) * (s.y2 - s.y1), L2 = (s.x2 - s.x1) ** 2 + (s.y2 - s.y1) ** 2;
      return dot > -EPS * EPS && dot < L2 + EPS * EPS;
    };
    const flat = []; wires.forEach(w => w.segs.forEach((s, j) => flat.push({ w, s, j })));
    const cross = [], overl = []; let conns = 0;
    for (let A = 0; A < flat.length; A++) for (let B = A + 1; B < flat.length; B++) {
      const pp = flat[A], qq = flat[B]; if (pp.w === qq.w) continue;
      const s = pp.s, t = qq.s;
      if (coll(s, t)) {
        const touch = [[s.x1, s.y1, t.x1, t.y1], [s.x1, s.y1, t.x2, t.y1], [s.x2, s.y2, t.x1, t.y1], [s.x2, s.y2, t.x2, t.y2]]
          .some(([x1, y1, x2, y2]) => Math.hypot(x1 - x2, y1 - y2) < 1.5);
        if (!touch) overl.push([pp.w.w + ':' + pp.j + ' ' + pp.w.d, qq.w.w + ':' + qq.j + ' ' + qq.w.d]); continue;
      }
      if (!inter(s, t)) continue;
      if (onSeg(s.x1, s.y1, t) || onSeg(s.x2, s.y2, t) || onSeg(t.x1, t.y1, s) || onSeg(t.x2, t.y2, s)) conns++;
      else cross.push([pp.w.w + ':' + pp.j + ' ' + pp.w.d, qq.w.w + ':' + qq.j + ' ' + qq.w.d]);
    }
    const dist = (s, t) => {
      let best = 1e9;
      for (let k = 0; k <= 40; k++) {
        const u = k / 40, px = s.x1 + (s.x2 - s.x1) * u, py = s.y1 + (s.y2 - s.y1) * u;
        const inX = px >= t.x && px <= t.x + t.w, inY = py >= t.y && py <= t.y + t.h;
        const dx = !inX ? Math.min(Math.abs(px - t.x), Math.abs(px - (t.x + t.w))) : 0;
        const dy = !inY ? Math.min(Math.abs(py - t.y), Math.abs(py - (t.y + t.h))) : 0;
        best = Math.min(best, Math.hypot(dx, dy));
      }
      for (const [cx, cy] of [[t.x, t.y], [t.x + t.w, t.y], [t.x, t.y + t.h], [t.x + t.w, t.y + t.h]]) {
        const vx = s.x2 - s.x1, vy = s.y2 - s.y1, L2 = vx * vx + vy * vy;
        let u = L2 ? ((cx - s.x1) * vx + (cy - s.y1) * vy) / L2 : 0; u = Math.max(0, Math.min(1, u));
        best = Math.min(best, Math.hypot(cx - (s.x1 + vx * u), cy - (s.y1 + vy * u)));
      }
      return best;
    };
    // подписи: экранный прямоугольник → координаты viewBox через обратный CTM корневого svg:
    // он учитывает и letterbox (отдельно открытый .svg центрируется в окне), и собственный
    // transform текста (повёрнутые заголовки осей), который getBBox игнорирует;
    // запасной путь — getBBox, если фигура не отрисована
    const sr = svg.getBoundingClientRect();
    const ctm = svg.getScreenCTM();
    const viaScreen = ctm && sr.width > 2 && sr.height > 2;
    const im = viaScreen ? ctm.inverse() : null;
    const texts = [...svg.querySelectorAll('text')].map(t => {
      const s = (t.textContent || '').trim();
      if (!viaScreen) { const b = t.getBBox(); return { x: b.x, y: b.y, w: b.width, h: b.height, s }; }
      const r = t.getBoundingClientRect();
      const p1 = new DOMPoint(r.left, r.top).matrixTransform(im);
      const p2 = new DOMPoint(r.right, r.bottom).matrixTransform(im);
      return { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), w: Math.abs(p2.x - p1.x), h: Math.abs(p2.y - p1.y), s };
    });
    const txtWire = [], txtTxt = [], outside = [], txtFrame = [];
    for (const t of texts) {
      if (t.x < VX || t.y < VY || t.x + t.w > VX + VW || t.y + t.h > VY + VH)
        outside.push(['x2=' + Math.round(t.x + t.w), 'y2=' + Math.round(t.y + t.h), t.s.slice(0, 40)]);
      for (const f of flat) {
        const d = dist(f.s, t);
        if (d < 3) txtWire.push([t.s.slice(0, 24), 'wire ' + f.w.w + ':' + f.j + ' ' + f.w.d, 'd=' + Math.round(d * 10) / 10]);
      }
    }
    for (let A = 0; A < texts.length; A++) for (let B = A + 1; B < texts.length; B++) {
      const a = texts[A], b = texts[B];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) txtTxt.push([a.s.slice(0, 22), b.s.slice(0, 22)]);
    }
    for (const r of svg.querySelectorAll('rect')) {
      if ((r.getAttribute('fill') || '') !== 'none') continue;
      const rx = +r.getAttribute('x'), ry = +r.getAttribute('y'), rw = +r.getAttribute('width'), rh = +r.getAttribute('height');
      for (const t of texts) {
        if (t.x < rx + rw && rx < t.x + t.w && t.y < ry + rh && ry < t.y + t.h) {
          const band = 4;
          if ((t.x < rx + band && rx < t.x + t.w) || (t.x + t.w > rx + rw - band && rx + rw < t.x) ||
            (t.y < ry + band && ry < t.y + t.h) || (t.y + t.h > ry + rh - band && ry + rh < t.y))
            txtFrame.push([t.s.slice(0, 22), 'rect ' + rx + ',' + ry]);
        }
      }
    }
    if (cross.length || overl.length || txtWire.length || txtTxt.length || outside.length || txtFrame.length)
      issues.push({
        fig: all.indexOf(svg), aria: (svg.getAttribute('aria-label') || '').slice(0, 40),
        conductorPaths: wires.length, segs: flat.length, junctions: conns,
        crossings: cross, collinearOverlap: overl, textOnWire: txtWire,
        textOnText: txtTxt, outsideViewBox: outside, textOnFrame: txtFrame
      });
    else ok++;
  }
  return { figures: svgs.length, ok, issues };
})()
