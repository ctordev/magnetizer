#!/usr/bin/env python3
# Выжимка «Технические данные / Конструкция» из зеркал imlab.narod.ru по установкам
# намагничивания и индукторам → refs/imlab/_notes/specs.md
import re, pathlib

SRC = pathlib.Path('refs/imlab/_text')
OUT = pathlib.Path('refs/imlab/_notes/specs.md')
KEEP = re.compile(r'(M_Fields/(Magn_Equip|UNI|Uni_|Inductor|E_10|E_15|GI_|Gi_|Magnetizer|Imp_EM|Imp_Demagn|St_Demagn|Demagn|ITC|Magn_Meas|Magnet_Models|Magn_Field|Coil|Coil10|Ind_Coil|MF_Coil|1Tl_Magnet|2Tl_Magnet|SmCo|Calibration_Coil))', re.I)
NAV = ('Главная страница', 'Контактная информация', 'Новости', 'Поиск на', 'Форум', 'Словарь', 'Ссылки',
       'Альтернативные источники', 'Компьютеры и', 'Механотронные', 'Перспективные', 'Электроника и')

out = []
for p in sorted(SRC.rglob('*.txt')):
    rel = str(p.relative_to(SRC))
    if not KEEP.search(rel):
        continue
    lines = p.read_text(encoding='utf-8').split('\n')
    title = next((l for l in lines[0:3] if len(l) > 20), rel)
    body, start = [], None
    for i, l in enumerate(lines):
        if re.match(r'^(Технические данные|Конструкция|Назначение|1\. Введение)', l):
            start = i
            break
    if start is None:
        continue
    for l in lines[start:]:
        if any(l.startswith(n) for n in NAV):
            break
        if re.match(r'^\d{2}\.\d{2}\.\d{4}$', l):
            break
        body.append(l)
    # «Словарь терминов» и дальше — справочный балласт, обрываем
    for j, l in enumerate(body):
        if re.match(r'^(Словарь|Приборы для|Примечание)', l) and j > 3:
            body = body[:j]
            break
    out.append('## ' + title + '\nисточник: ' + rel.replace('.txt', '') + '\n\n' + '\n'.join(body[:70]))
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text('\n\n'.join(out), encoding='utf-8')
print('страниц в выжимке:', len(out), '| размер:', OUT.stat().st_size)
