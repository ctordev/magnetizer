#!/usr/bin/env python3
# Проверка целостности зеркала imlab.narod.ru (refs/imlab/): битые ссылки,
# недостающие картинки, обрезанные/пустые страницы. Режимы:
#   python3 calc/src/imlab_check.py                — отчёт → refs/imlab/_notes/integrity.md
#   python3 calc/src/imlab_check.py --fix          — недостающие <img> заменить ссылкой на оригинал
#                                                    (обратимо: --restore вернёт тег обратно)
#   python3 calc/src/imlab_check.py --restore      — вернуть <img>, если файл уже докачан
#   python3 calc/src/imlab_check.py --offline      — убрать из копии чужие сетевые запросы
#                                                    (скрипты ucoz/счётчики, //imlab.narod.ru/...),
#                                                    а то что скачано — перевести на локальные пути
#   python3 calc/src/imlab_check.py --online       — вернуть эти теги (после --offline)
import argparse, base64, collections, os, pathlib, re, urllib.parse, urllib.request

ROOT = pathlib.Path('refs/imlab')
NOTES = ROOT / '_notes'
IMG_TAG = re.compile(r'<img\b[^>]*>', re.I)
SRC_ATTR = re.compile(r'\bsrc="([^"]+)"', re.I)
HREF_ATTR = re.compile(r'\b(?:href|src)="([^"]+)"', re.I)
MARK_OPEN = '<!--IMLAB-MISSING:'
MARK_CLOSE = '<!--/IMLAB-MISSING-->'
OFF_MARK = '<!--IMLAB-OFF:'
OFF_MARK_END = '<!--/IMLAB-OFF-->'
SITE_HOST = 'imlab.narod.ru'
NET_TAG = re.compile(r'<(?:script|img|link|iframe)\b[^>]*>', re.I)
REF_ATTR = re.compile(r'\b(?:src|href)="([^"]+)"', re.I)
SCRIPT_SPAN = re.compile(r'<script\b[^>]*>.*?</script\s*>|<style\b[^>]*>.*?</style\s*>', re.I | re.S)
SITE_REF = re.compile(r'^(?:https?:)?//' + SITE_HOST + '/', re.I)
JUNK_REF = re.compile(r'^(?:https?:)?//(?:[^/]+\.)?(?:ucoz\.net|yadro\.ru)/|^(?:https?:)?//' + SITE_HOST +
                      r'/\?|^/\?', re.I)
CSS = ('<style>/* добавлено зеркалом: пометка о несохранённом рисунке и hiding рекламного фрейма ucoz */'
       '.imlab-missing{display:block;margin:10px 0;padding:8px 12px;border:1px dashed #9ab;color:#5a6b7a;'
       'background:#f4f6f8;font:13px/1.5 sans-serif;text-decoration:none}'
       'iframe[style*="position:fixed"]{display:none!important}</style>')


CSS_OLD = ('<style>/* добавлено калькой-зеркалом: пометка о несохранённом рисунке */'
           '.imlab-missing{display:block;margin:10px 0;padding:8px 12px;border:1px dashed #9ab;color:#5a6b7a;'
           'background:#f4f6f8;font:13px/1.5 sans-serif;text-decoration:none}</style>',)


def ensure_css(h: str) -> str:
    """Один раз вставить в страницу наш <style>; прежние версии блока заменяем на текущую."""
    for old in CSS_OLD:
        h = h.replace(old, CSS)
    if CSS in h:
        return h
    return re.sub(r'(?i)</head>', CSS + '</head>', h, count=1) if '</head>' in h.lower() else CSS + h


def resolve(base_page: pathlib.Path, ref: str):
    """Локальный путь, на который указывает ref внутри зеркала (или None, если ref внешний)."""
    ref = ref.strip()
    if ref.startswith(('http://', 'https://', '//', 'data:', 'mailto:', 'javascript:', 'tel:', '#')):
        return None
    base = '/' + urllib.parse.quote(str(base_page.relative_to(ROOT)))
    rel = urllib.parse.unquote(urllib.parse.urlparse(urllib.parse.urljoin(base, ref)).path).lstrip('/')
    return ROOT / rel if rel else None


def site_url(page_rel: str, ref: str) -> str:
    """Абсолютный URL того же файла на самом сайте (для ссылки «открыть на сайте» / докачки)."""
    import posixpath
    rel = posixpath.normpath(posixpath.join(posixpath.dirname(page_rel), ref))
    return 'https://imlab.narod.ru/' + urllib.parse.quote(rel)


def pages():
    return sorted(p for p in ROOT.rglob('*.htm*') if '_text' not in p.parts and '_notes' not in p.parts)


MARK_RE = re.compile(re.escape(MARK_OPEN) + r'([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+)-->')


def scan():
    bad_img, bad_ref, broken_html, empty, marked = (collections.defaultdict(list),
                                                    collections.defaultdict(list), [], [], collections.defaultdict(list))
    offsite = []
    for p in pages():
        h = p.read_text('utf-8', 'replace')
        if len(h) < 200:
            empty.append(str(p))
        if h.lower().count('<html') and '</html>' not in h.lower():
            broken_html.append(str(p))
        rel = str(p.relative_to(ROOT))
        for mo in MARK_RE.finditer(h):
            ref = base64.b64decode(mo.group(2)).decode()
            r = resolve(p, ref)
            if r is None or not r.exists():
                marked[rel].append(ref)
        for tag in IMG_TAG.findall(h):
            m = SRC_ATTR.search(tag)
            if not m:
                continue
            r = resolve(p, m.group(1))
            if r is not None and not r.exists():
                bad_img[rel].append(m.group(1))
        for ref in HREF_ATTR.findall(h):
            r = resolve(p, ref)
            if r is not None and not r.exists() and r.suffix.lower() not in ('.jpg', '.jpeg', '.png', '.gif', '.bmp'):
                bad_ref[rel].append(ref)
        # что страница по-прежнему просит из сети (картинки/скрипты) — этого в копии нет
        spans = [(x.start(), h.index('>', x.start()) + 1, x.end()) for x in SCRIPT_SPAN.finditer(h)]
        for mo in NET_TAG.finditer(h):
            if any(a <= mo.start() < b for _, a, b in spans):
                continue
            sm = REF_ATTR.search(mo.group(0))
            if sm and sm.group(1).startswith(('http', '//')) and 'imlab-missing' not in mo.group(0):
                offsite.append(f'{rel} → {sm.group(1)[:110]}')
    return bad_img, bad_ref, broken_html, empty, marked, offsite


def report(bad_img, bad_ref, broken_html, empty, marked, offsite):
    NOTES.mkdir(parents=True, exist_ok=True)
    all_missing = sorted({site_url(page, ref)
                          for page, refs in list(bad_img.items()) + list(marked.items()) for ref in refs})
    out = ['# Целостность зеркала imlab.narod.ru', '']
    out.append(f'- страниц в зеркале: {len(pages())}')
    out.append(f'- не скачано картинок: {sum(len(v) for v in marked.values())} помечено + '
               f'{sum(len(v) for v in bad_img.values())} битых тегов; уникальных файлов: {len(all_missing)}')
    out.append(f'- страниц с битыми внутренними ссылками: {len(bad_ref)}, ссылок: {sum(len(v) for v in bad_ref.values())}')
    out.append(f'- обрезанных (нет </html>) страниц: {len(broken_html)}; пустых/слишком коротких: {len(empty)}')
    net = sum(p.read_text('utf-8', 'replace').count(OFF_MARK) for p in pages())
    out.append(f'- тегов, обращавшихся в сеть (ucoz/счётчики/чужие домены), убрано ради чтения без сети: {net}')
    out.append(f'- загружаемых из сети ссылок осталось: {len(offsite)}')
    out += [' - ' + o for o in offsite[:20]]
    out.append('\nСписок на докачку (это же аргумент для зеркала): `_notes/missing_images.txt`. '
               'После докачки — `python3 calc/src/imlab_check.py --restore`, и вместо пометок снова встанут `<img>`.')
    out.append('\n## Недостающие картинки по страницам')
    for page in sorted(set(list(bad_img) + list(marked)), key=lambda k: -(len(bad_img[k]) + len(marked[k]))):
        refs = sorted(set(bad_img[page] + marked[page]))
        out.append(f'\n### {page} — {len(refs)}')
        out += [' - ' + r for r in refs[:400]]
    if bad_ref:
        out.append('\n## Битые внутренние ссылки (страниц нет в зеркале)')
        for page in sorted(bad_ref, key=lambda k: -len(bad_ref[k])):
            out.append(f'\n### {page} — {len(bad_ref[page])}')
            out += [' - ' + r for r in sorted(set(bad_ref[page]))[:100]]
    (NOTES / 'integrity.md').write_text('\n'.join(out) + '\n', encoding='utf-8')
    (NOTES / 'missing_images.txt').write_text('\n'.join(all_missing) + '\n', encoding='utf-8')
    print(f'страниц: {len(pages())} | картинок не скачано: {sum(len(v) for v in marked.values()) + sum(len(v) for v in bad_img.values())} '
          f'(уникальных: {len(all_missing)}) | битых ссылок: {sum(len(v) for v in bad_ref.values())} '
          f'| обрезанных: {len(broken_html)} | пустых: {len(empty)}')
    print('отчёт:', NOTES / 'integrity.md', '| список докачки:', NOTES / 'missing_images.txt')


def do_fix():
    """Недостающие <img> → пометка со ссылкой на оригинал (обратимо через --restore)."""
    n = 0
    for p in pages():
        h = p.read_text('utf-8', 'replace')

        def repl(mo):
            nonlocal n
            tag = mo.group(0)
            sm = SRC_ATTR.search(tag)
            if not sm:
                return tag
            ref = sm.group(1)
            r = resolve(p, ref)
            if r is None or r.exists():
                return tag
            n += 1
            url = site_url(str(p.relative_to(ROOT)), ref)
            return (f'{MARK_OPEN}{base64.b64encode(tag.encode()).decode()}:{base64.b64encode(ref.encode()).decode()}-->'
                    f'<a class="imlab-missing" href="{url}" title="Рисунок не скачан в локальную копию">'
                    f'&#9888; рисунок {ref} в локальную копию не скачан — открыть на сайте</a>{MARK_CLOSE}')

        h2 = IMG_TAG.sub(repl, h)
        if MARK_OPEN in h2:
            h2 = ensure_css(h2)
        if h2 != h:
            p.write_text(h2, encoding='utf-8')
    print('помечено как «не скачано»:', n)


def do_restore():
    n = 0
    pat = re.compile(re.escape(MARK_OPEN) + r'([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+)-->.*?' + re.escape(MARK_CLOSE), re.S)
    for p in pages():
        h = p.read_text('utf-8', 'replace')
        if MARK_OPEN not in h:
            continue

        def back(mo):
            nonlocal n
            tag = base64.b64decode(mo.group(1)).decode()
            ref = base64.b64decode(mo.group(2)).decode()
            r = resolve(p, ref)
            if r is not None and r.exists():
                n += 1
                return tag
            return mo.group(0)
        h2 = pat.sub(back, h)
        if h2 != h:
            p.write_text(h2, encoding='utf-8')
    print('возвращено тегов <img>:', n)


def do_offline():
    """Копия должна читаться без сети: чужие скрипты/счётчики убираем, скачанное — локально."""
    dropped = localized = 0
    for p in pages():
        h = p.read_text('utf-8', 'replace')
        spans = [(m.start(), h.index('>', m.start()) + 1, m.end()) for m in SCRIPT_SPAN.finditer(h)]

        def repl(mo):
            nonlocal dropped, localized
            tag = mo.group(0)
            if any(a <= mo.start() < b for _, a, b in spans):
                return tag          # это текст внутри <script>/<style>, а не настоящий тег
            m = REF_ATTR.search(tag)
            if not m:
                return tag
            ref = m.group(1)
            if 'imlab-missing' in tag or not ref.startswith(('/', 'http', '//')):
                return tag                      # локальные относительные ссылки не трогаем
            if JUNK_REF.search(ref):
                dropped += 1
                return f'{OFF_MARK}{base64.b64encode(tag.encode()).decode()}-->{OFF_MARK_END}'
            if SITE_REF.search(ref):
                path = urllib.parse.unquote(urllib.parse.urlparse(ref.replace('//' + SITE_HOST,
                                                                             'http://' + SITE_HOST)).path).lstrip('/')
                lp = ROOT / path if path else None
                if lp is not None and lp.exists():
                    localized += 1
                    new = os.path.relpath(lp, p.parent).replace(os.sep, '/')
                    return tag.replace('"%s"' % ref, '"%s"' % new, 1)
                dropped += 1
                return f'{OFF_MARK}{base64.b64encode(tag.encode()).decode()}-->{OFF_MARK_END}'
            return tag

        h2 = NET_TAG.sub(repl, h)
        if OFF_MARK in h2:
            h2 = ensure_css(h2)
        if h2 != h:
            p.write_text(h2, encoding='utf-8')
    print('убрано сетевых тегов: %d | переведено на локальные файлы: %d' % (dropped, localized))


def do_online():
    n = 0
    for p in pages():
        h = p.read_text('utf-8', 'replace')
        if OFF_MARK not in h:
            continue

        def back(mo):
            nonlocal n
            n += 1
            return base64.b64decode(mo.group(1)).decode()
        h2 = re.compile(re.escape(OFF_MARK) + r'([A-Za-z0-9+/=]+)-->' + re.escape(OFF_MARK_END)).sub(back, h)
        p.write_text(h2, encoding='utf-8')
    print('вернуто сетевых тегов:', n)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--fix', action='store_true', help='недостающие <img> → ссылка на оригинал')
    ap.add_argument('--restore', action='store_true', help='вернуть <img>, если файл докачан')
    ap.add_argument('--offline', action='store_true', help='убрать сетевые запросы из копии')
    ap.add_argument('--online', action='store_true', help='вернуть сетевые теги')
    a = ap.parse_args()
    if a.fix:
        do_fix()
    if a.restore:
        do_restore()
    if a.offline:
        do_offline()
    if a.online:
        do_online()
    report(*scan())
