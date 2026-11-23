#!/usr/bin/env python3
# plain-text из зеркал imlab.narod.ru — чтобы читать и искать по всему собранному.
#   python3 calc/src/imlab_text.py            → refs/imlab/_text/<путь>.txt
import re, pathlib, html, sys

SRC, DST = pathlib.Path('refs/imlab'), pathlib.Path('refs/imlab/_text')
DST.mkdir(parents=True, exist_ok=True)
SKIP = ('_text', '.s', '_images.txt')


def text_of(h):
    h = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', h)
    h = re.sub(r'(?i)<br[^>]*>', '\n', h)
    h = re.sub(r'(?i)</(p|div|tr|li|h[1-6]|table)>', '\n', h)
    h = re.sub(r'(?i)</t[dh]>', ' | ', h)
    h = re.sub(r'(?s)<[^>]+>', ' ', h)
    h = html.unescape(h)
    h = re.sub(r'[ \t\u00a0]+', ' ', h)
    h = re.sub(r'\n\s*\n+', '\n', h)
    return '\n'.join(l.strip() for l in h.split('\n') if l.strip())


files = [p for p in sorted(SRC.rglob('*.htm*')) if not any(s in str(p) for s in SKIP)]
for p in files:
    t = text_of(p.read_text('utf-8', 'replace'))
    out = DST / (str(p.relative_to(SRC)) + '.txt')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(t, encoding='utf-8')
print('текстов:', len(files), '| строк всего:', sum(len((DST / (str(p.relative_to(SRC)) + '.txt')).read_text(encoding='utf-8').split('\n')) for p in files))
