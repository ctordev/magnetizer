#!/usr/bin/env python3
# Проверка целостности наших HTML-документов (не зеркала): разборы тегов, локальные
# ссылки и картинки, id-дубли, «сырые» < внутри <pre>/<code>.
#   python3 calc/src/htmlcheck.py [файл …]        # без аргументов — все *.html в каталоге проекта
import html.parser, pathlib, re, sys, urllib.parse

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
        'param', 'source', 'track', 'wbr'}
RAW = re.compile(r'</?(?:[A-Za-z][A-Za-z0-9]*)[\s/>]')


class Check(html.parser.HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path, self.problems = path, []
        self.stack, self.ids, self.refs = [], set(), []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'):
            if a['id'] in self.ids:
                self.problems.append(f'строка {self.getpos()[0]}: повтор id="{a["id"]}"')
            self.ids.add(a['id'])
        for key in ('src', 'href'):
            if key in a:
                self.refs.append(a[key])
        if tag not in VOID:
            self.stack.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID and self.stack and self.stack[-1][0] == tag:
            self.stack.pop()

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack:
            self.problems.append(f'строка {self.getpos()[0]}: </{tag}> без открывающего тега')
            return
        if self.stack[-1][0] != tag:
            open_tags = ' > '.join(t for t, _ in self.stack[-4:])
            self.problems.append(f'строка {self.getpos()[0]}: </{tag}> не совпадает с открытым <{self.stack[-1][0]}> '
                                 f'(цепочка: {open_tags})')
            for i in range(len(self.stack) - 1, -1, -1):
                if self.stack[i][0] == tag:
                    del self.stack[i:]
                    return
        else:
            self.stack.pop()

VERBATIM = re.compile(r'<(pre|code)\b[^>]*>(.*?)</\1>', re.S | re.I)

SYM = re.compile(r'[A-Z]{1,3}\d{1,3}[a-z]?')
SVG_BLOCK = re.compile(r'<svg[^>]*viewBox[^>]*>.*?</svg>', re.S)
SVG_TEXT = re.compile(r'<text[^>]*>([^<]*)</text>')
ROW_FIRST = re.compile(r'<tr[^>]*>\s*<td[^>]*>(.*?)</td>', re.S)


def scheme_symbols(text: str):
    """Позиционные обозначения со статичных svg-схем обязаны встречаться в таблицах своей
    секции (первая ячейка строки) или в тексте документа вне рисунков. Ловит «на схеме нарисовали,
    а в спецификацию/прозу забыли внести»."""
    def syms(s):
        return {t for w in re.split(r'[\s,;./«»()·…\-–—]+', re.sub(r'<[^>]+>', ' ', s))
                if SYM.fullmatch(t := w.strip('«»"().'))}
    prose = syms(SVG_BLOCK.sub(' ', text))          # всё вне svg-схем: проза, таблицы, подписи
    problems = []
    # секции по h2: табличные обозначения секции + обозначения BOM (§7)
    h2 = [m.start() for m in re.finditer(r'<h2[ >]', text)] + [len(text)]
    bom = text[text.index('id="bom"'):] if 'id="bom"' in text else ''
    bom_syms = {s for m in ROW_FIRST.finditer(bom) for s in syms(m.group(1))}
    for k in range(len(h2) - 1):
        sec = text[h2[k]:h2[k + 1]]
        svgs = SVG_BLOCK.findall(sec)
        if not svgs:
            continue
        tab = {s for tab in re.findall(r'<table[^>]*>.*?</table>', sec, re.S)
               for m in ROW_FIRST.finditer(tab) for s in syms(m.group(1))}
        for svg in svgs:
            for m in SVG_TEXT.finditer(svg):
                for sym in syms(m.group(1)):
                    if sym not in tab and sym not in bom_syms and sym not in prose:
                        problems.append(f'схема: обозначение «{sym}» есть на рисунке, '
                                        f'но нет в таблицах секции и в тексте')
    return problems


def raw_in_verbatim(text: str):
    """В pre/code нельзя писать «<img>» открытым текстом: парсер съест это как тег."""
    out = []
    for m in VERBATIM.finditer(text):
        base = text[:m.start()].count('\n')
        for line_no, line in enumerate(m.group(2).splitlines(), base + 1):
            if RAW.search(line):
                out.append(f'строка {line_no}: незакрытая сущность в <{m.group(1)}>: {line.strip()[:70]!r}')
    return out


def local_target(doc: pathlib.Path, ref: str):
    ref = ref.strip()
    if ref.startswith(('http://', 'https://', '//', 'data:', 'mailto:', 'javascript:', 'tel:', '#')):
        return None
    path = urllib.parse.unquote(urllib.parse.urlparse(ref).path)
    return (doc.parent / path).resolve() if path else doc


def check(doc: pathlib.Path):
    text = doc.read_text('utf-8', 'replace')
    p = Check(str(doc))
    p.feed(text)
    for tag, line in p.stack:
        p.problems.append(f'строка {line}: <{tag}> не закрыт')
    missing = []
    for ref in p.refs:
        t = local_target(doc, ref)
        if t is not None and not t.exists():
            missing.append(ref)
    return p.problems + raw_in_verbatim(text) + scheme_symbols(text), sorted(set(missing))


if __name__ == '__main__':
    here = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('-') else '.')
    docs = [pathlib.Path(a) for a in sys.argv[1:]] or sorted(here.glob('*.html'))
    bad = 0
    for doc in docs:
        problems, missing = check(doc)
        status = 'ok' if not problems and not missing else 'ПРОБЛЕМЫ'
        print(f'{status}: {doc}')
        for x in problems:
            print('   -', x)
        for x in missing:
            print('   - нет файла:', x)
        bad += bool(problems or missing)
    print(f'проверено документов: {len(docs)}, с замечаниями: {bad}')
