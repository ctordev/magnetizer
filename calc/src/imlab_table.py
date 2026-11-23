#!/usr/bin/env python3
# Таблица «зона намагничивания → требуемая индукция → требуемый ток» по всем
# конструкциям из зеркала imlab.narod.ru (refs/imlab/_text/…).
#   python3 calc/src/imlab_table.py          → refs/imlab/_notes/fixtures.json + .md
# Числа берутся дословно из страниц; колонка «кА·витков» — наша оценка
# (H = B/µ0 в зазоре, NI = H·l_зазора) — она нужна, чтобы сравнивать
# соленоид без ярма и оснастку с полюсами.
import json, pathlib, re

SRC = pathlib.Path('refs/imlab/_text/M_Fields')
OUT = pathlib.Path('refs/imlab/_notes')
MU0 = 4e-7 * 3.141592653589793

NUM = r'(\d+(?:[.,]\d+)?)'
PAT_B = re.compile(r'амплитуда магнитной индукции.{0,240}?(?:не менее|до|примерно)\s*(\d+(?:[.,]\d+)?)\s*Тл.{0,120}?не более\s*(\d+)\s*А', re.I | re.S)
PAT_B2 = re.compile(r'(\d+(?:[.,]\d+)?)\s*Тл при амплитуде импульса тока не более\s*(\d+)\s*А', re.I | re.S)
PAT_ZONE = re.compile(r'зоны.{0,200}?диаметр\D{0,4}(\d+)[\s\d+.]{0,14}?мм.{0,140}?высот[аы]\D{0,4}(\d+)[\s\d+.]{0,14}?мм', re.I | re.S)
PAT_TURNS = re.compile(r'число витков[^0-9]*(\d+)', re.I)
PAT_L = re.compile(r'(?:расчетная|измеренная|индуктивность индуктора) ?индуктивность?.{0,60}?(\d+[.,]\d*)\s*(мкГн|мГн|Гн|мкГ|мГ)', re.I | re.S)
PAT_R = re.compile(r'активное сопротивление.{0,60}?(\d+[.,]\d*)\s*Ом', re.I | re.S)
PAT_DIM = re.compile(r'габаритные размеры.{0,40}?((?:\d+\s*[х×]\s*){2,3}\d+)', re.I | re.S)
PAT_MASS = re.compile(r'масса.{0,40}?(\d+[.,]?\d*)\s*кг', re.I | re.S)


def one(text, pat, flags=0):
    m = re.search(pat, text, flags)
    return m.group(1).replace(',', '.') if m else None


rows = []
for p in sorted(SRC.rglob('*.txt')):
    t = '\n'.join(p.read_text(encoding='utf-8').split('\n')[:400])
    title = next((l for l in t.split('\n')[:2] if len(l) > 25), p.parent.name)
    m = re.search(PAT_B, t) or re.search(PAT_B2, t)
    if not m:
        continue
    B, I = float(m.group(1)), float(m.group(2))
    z = re.search(PAT_ZONE, t)
    d_mm = float(z.group(1)) if z else None
    h_mm = float(z.group(2)) if z else None
    turns = one(t, PAT_TURNS)
    ind = re.search(PAT_L, t)
    L = None
    if ind:
        v = float(ind.group(1).replace(',', '.'))
        mult = {'мкгн': 1, 'мкг': 1, 'мгн': 1e3, 'мг': 1e3, 'гн': 1e6}[ind.group(2).lower()]
        L = v * mult                                  # мкГн
    R = one(t, PAT_R)
    # оценка МДС: поле в зазоре B/µ0, длина зазора ≈ диаметр полюса (реальный
    # прообраз — наша модель C); для соленоида без ярма это верхняя оценка
    ni = None
    if d_mm:
        ni = round(B / MU0 * d_mm / 1000 / 1000, 1)   # кА·витков
    rows.append(dict(page=str(p.relative_to(SRC)).replace('.htm.txt', '.htm'),
                     title=title[:120], bore_mm=d_mm, zone_h_mm=h_mm, B_T=B, I_A=I,
                     at=B / I if I else None, ni_kAt=ni, turns=turns, L_uH=L, R_ohm=R,
                     dims=one(t, PAT_DIM), mass_kg=one(t, PAT_MASS)))

OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'fixtures.json').write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding='utf-8')
hdr = '| страница | зона, мм (⌀×в) | B, Тл | I, А | Тл/кА | кА·витков (оценка) | витков | L, мкГн | R, Ом |'
md = [hdr, '|' + '---|' * 9]
for r in sorted(rows, key=lambda r: (r['B_T'] / r['I_A']) if r['I_A'] else 0):
    md.append('| {page} | {b} | {B} | {I} | {at} | {ni} | {turns} | {L} | {R} |'.format(
        page=r['page'], b=f"{r['bore_mm']}×{r['zone_h_mm']}" if r['bore_mm'] else '—',
        B=r['B_T'], I=r['I_A'], at=round(r['at'] * 1000, 2) if r['at'] else '—',
        ni=r['ni_kAt'] or '—', turns=r['turns'] or '—',
        L=round(r['L_uH'], 1) if r['L_uH'] else '—', R=r['R_ohm'] or '—'))
(OUT / 'fixtures.md').write_text('\n'.join(md) + '\n', encoding='utf-8')
print('записей:', len(rows))
print('\n'.join(md))
