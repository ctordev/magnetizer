#!/usr/bin/env python3
# Проверка «вшитое == исходник»: ловит рассинхрон документов с генераторами и standalone-рисунками.
#   python3 calc/src/embedcheck.py
# Проверяет:
#  1) calc/out/fig_d2.frag.html и fig_vd6.frag.html целиком вошиты в magnetizer.html;
#  2) calc/src/{charge,bank2,vd6,vt1}_section.html == секция документа по якорю (h2 — до
#     следующего <h2, h3 — до следующего <h2/<h3);
#  3) копия calc/src/mag10.js внутри magnetizer.html совпадает с исходником;
#  4) calc/src/t1_shema_gost.svg == calc/src/charge_block1_gost.svg (двойник-копия);
#  5) вошитые <svg> блоков 1–2 в magnetizer.html и charge_section.html совпадают с телом
#     standalone-рисунков (charge_block1/2_gost.svg: тело после <rect class="bg">, без
#     xmlns/style/фона), сопоставление по aria-label.
# Выход ≠ 0, если есть расхождение; на каждую проверку строка ok/РАСХОЖДЕНИЕ.
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent   # каталог проекта
SRC = ROOT / 'calc' / 'src'
OUT = ROOT / 'calc' / 'out'
DOC = ROOT / 'magnetizer.html'

fails = []
checks = 0


def norm(s: str) -> str:
    """Схлопывает пробельные шумы: построчно strip, пустые строки долой."""
    return '\n'.join(l.strip() for l in s.splitlines() if l.strip())


def report(name: str, ok: bool, detail: str = ''):
    global checks
    checks += 1
    print(('ok: ' if ok else 'РАСХОЖДЕНИЕ: ') + name + (f' — {detail}' if detail and not ok else ''))
    if not ok:
        fails.append(name)


def main():
    doc = DOC.read_text('utf-8')

    # 1) осциллограммы: содержимое frag-файлов вошито целиком
    for name in ('fig_d2', 'fig_vd6'):
        frag = (OUT / f'{name}.frag.html').read_text('utf-8')
        report(f'вшита {name}.frag.html', frag.strip() in doc, 'тело frag не найдено в magnetizer.html целиком')

    # 2) исходники вставляемых секций вошиты в документ (содержание построчно, без шума пробелов)
    for stem, anchor in (('charge', 'charge'), ('bank2', 'bank2'), ('vd6', 'd2why'), ('vt1', 'vt1sel')):
        sec = (SRC / f'{stem}_section.html').read_text('utf-8')
        report(f'{stem}_section.html вошита в §#{anchor}', norm(sec) in norm(doc),
               'исходник и вшивка разошлись (пересобрать из генератора или пересоздать исходник из документа)')

    # 3) браузерный вьювер mag10.js вошит как есть; допустимая адаптация вшивки —
    #    цветной svg-текст с классом переведён с fill="…" на style="fill:…" (правило AGENTS.md)
    mag = (SRC / 'mag10.js').read_text('utf-8')
    doc_uni = doc.replace('style="fill:', 'fill="')
    report('mag10.js вошит в magnetizer.html', mag.strip() in doc_uni,
           'копия внутри документа отличается от calc/src/mag10.js (не считая fill/style-адаптации)')

    # 4) двойник-копия схемы блока 1
    b1 = (SRC / 'charge_block1_gost.svg').read_text('utf-8')
    sh = (SRC / 't1_shema_gost.svg').read_text('utf-8')
    report('t1_shema_gost.svg == charge_block1_gost.svg', b1 == sh, 'копии разошлись (cp)')

    # 5) вошитые svg блоков 1–2 == тело standalone
    def standalone_body(path: pathlib.Path):
        t = path.read_text('utf-8')
        aria = re.search(r'aria-label="([^"]*)"', t)
        body = t[t.index('<rect class="bg"'):]
        body = body[body.index('>') + 1: body.rindex('</svg>')]
        return (aria.group(1) if aria else ''), norm(body)

    def inlined_body(host: str, aria_frag: str):
        for m in re.finditer(r'<svg viewBox="[^"]*"[^>]*>', host):
            tag = m.group(0)
            aria = re.search(r'aria-label="([^"]*)"', tag)
            if aria and aria_frag in aria.group(1):
                end = host.index('</svg>', m.end())
                return norm(host[m.end():end])
        return None

    for stem in ('charge_block1_gost', 'charge_block2_gost'):
        aria, body = standalone_body(SRC / f'{stem}.svg')
        key = aria[:40]
        for host_name, host in (('magnetizer.html', doc), ('charge_section.html', (SRC / 'charge_section.html').read_text('utf-8'))):
            emb = inlined_body(host, key)
            report(f'{stem}: вошитый svg в {host_name} == standalone', emb is not None and emb == body,
                   'тело вошитого svg отличается от standalone (пересобрать вшивку из standalone)')

    print(f'проверок: {checks}, расхождений: {len(fails)}')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
