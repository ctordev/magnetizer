---
name: Пересчёт и генерация документов
description: Порядок пересчёта режима установки, генерации 3D/осциллограмм и вшивки их в HTML-документы; точки синхронизации геометрии между скриптами.
---

# Пересчёт → генерация → вшивка

Полная таблица скриптов — `calc/README.md`; здесь только порядок и точки синхронизации.

## Порядок pipeline (числа идут строго в эту сторону)

```bash
node calc/src/master.js          # режим: токи, N·I, i²t, токи по банкам; пишет calc/src/vd6_data.json
node calc/src/fig_vd6.js         # осциллограммы разряда с VD6 и без (берут vd6_data.json)
node calc/src/fig_d2.js          # осциллограмма тока диода/тиристора
node calc/src/yoke3d.js          # 3D-ярмо → ../yarmo.html (тексты и ссылки тоже живут в этом скрипте)
```

Геометрия → L всегда через `calc/src/em.js` (`FIX`, `variant()`): L никогда не подставляется вручную.
Режим (разряд банка на оснастку) всегда через `calc/src/rlc.js` — `sim(C,U0,L,Rf,N)` и `split(Ipk)`; своего
RLC-решателя в новых скриптах не заводим.

Оснастки под готовые головки 10ГД‑34 / 10ГД‑30Е считаются в `calc/coils/` (`motors.js` — магнитная цепь и
требуемая МДС, `coils.js` — намотка из ⌀3,3 мм и режим): там те же `em.js` и `rlc.js`, вывод фиксируется
в `calc/coils/README.md`.

## Вшивка SVG в `magnetizer.html`

Поиск по `aria-label`, замена от `<svg` до `</svg>`:

```python
def swap(label, path):
    d = open('magnetizer.html', encoding='utf-8').read()
    i = d.index('aria-label="' + label); s = d.rindex('<svg', 0, i); e = d.index('</svg>', i) + 6
    open('magnetizer.html', 'w', encoding='utf-8').write(d[:s] + open(path, encoding='utf-8').read().strip() + d[e:])

swap('Осциллограмма тока диода VD6 и тиристора', 'calc/out/fig_d2.svg')
swap('Осциллограммы разряда с диодом VD6 и без него', 'calc/out/fig_vd6.svg')
```

`<svg id="fxsvg">` в `magnetizer.html` пустой по замыслу — его наполняет JS из `mag10.js`.

## Что менять, если изменилось…

| изменилось | править | перегенерировать |
|---|---|---|
| витки / шаг / bore / длина намотки | `em.js` (`FIX`) → `mag10.js` (и его копия внутри `magnetizer.html`) → `yoke3d.js` | `master.js`, `fig_*.js`, `yoke3d.js`, вшивка |
| ярмо (его геометрия, тексты, ссылки на копии) | `yoke3d.js`: `parts`, `rules`, `note`, поле `imlab` | `yoke3d.js` (он же `yarmo.html`) |
| банк / напряжение / ключ | `master.js` | `master.js` → `fig_*.js` → вшивка |
| чужие паспортные данные | `imlab_compare.js` (источник чисел §5) | §4–§5 в `imlab-magnetizery.html`, затем ссылки в других документах |
| данные головок 10ГД‑34/10ГД‑30Е (зазоры, фланцы, длина альнико) | `calc/coils/motors.js` (`SYS`) | `node calc/coils/motors.js` → `node calc/coils/coils.js` → цифры в `calc/coils/README.md` |

Ключевая синхронизация: оснастка проекта («вариант B») описана трижды — `em.js`, `mag10.js` + его копия в
`magnetizer.html`, `yoke3d.js`. Правится всегда вместе.

## Чего не делать

- Не править цифры в HTML вручную: только перегенерацией. Устаревшие значения — только в сносках «прежняя ревизия».
- Не запускать `mag10.js` через `node` (он браузерный, `document`).
- После любой правки документов — скилл `magnetizer-verify`.
