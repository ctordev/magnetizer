#!/usr/bin/env python3
# Зеркало разделов imlab.narod.ru про намагничивание: HTML + картинки в refs/imlab/.
#
#   python3 calc/src/mirror_imlab.py                      # весь сайт
#   SEEDS="https://imlab.narod.ru/M_Fields/Magn_Equip/Magn_Equip.htm" \
#     python3 calc/src/mirror_imlab.py                    # только поддерево от URL
#   IMG=0 ...                                            # только HTML (быстрый обзор)
#
# Скачанные файлы не перекачиваются, поэтому докачку можно повторять.
#   FILES=refs/imlab/_notes/missing_images.txt python3 calc/src/mirror_imlab.py
#     — докачать конкретный список файлов (его пишет calc/src/imlab_check.py), без обхода ссылок.
import os, re, sys, time, pathlib, urllib.parse, urllib.request
from collections import deque

BASE = 'https://imlab.narod.ru/'
DEFAULT_SEEDS = [BASE + 'index.html',
                 BASE + 'M_Fields/M_Fields.htm',
                 BASE + 'M_Fields/Magn_Equip/Magn_Equip.htm']
START = os.environ['SEEDS'].split() if os.environ.get('SEEDS') else \
        (sys.argv[1:] or DEFAULT_SEEDS)
OUT = pathlib.Path(os.environ.get('OUT', 'refs/imlab'))
MAX_PAGES = int(os.environ.get('MAX_PAGES', '400'))
GET_IMG = os.environ.get('IMG', '1') == '1'
DELAY = float(os.environ.get('DELAY', '0.2'))
RETRIES = int(os.environ.get('RETRIES', '6'))
WAIT = int(os.environ.get('WAIT_SITE', '600'))      # секунд — ждём, пока сайт снова ответит
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) magnetizer-docs/1.0'}
IMG_EXT = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.css', '.js')

seen, pages, imgs, failed = set(), [], [], []


def local_path(url):
    p = urllib.parse.unquote(urllib.parse.urlparse(url).path).lstrip('/')
    if not p or p.endswith('/'):
        p += 'index.html'
    elif '.' not in p.rsplit('/', 1)[-1]:      # .rar/.zip/… — сохраняем как есть
        p += '/index.html'
    return OUT / p


def fetch(url, tries=None):
    tries = tries or RETRIES
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25) as r:
                return r.read(), r.headers.get('content-type', '')
        except Exception as e:
            if i == tries - 1:
                return None, repr(e)
            time.sleep(5 + 10 * i)                 # narod.ru отвечает не сразу — паузы длинные


def same_site(url):
    pu = urllib.parse.urlparse(url)
    return pu.scheme in ('http', 'https') and pu.netloc.replace('www.', '') == 'imlab.narod.ru'


def wait_for_site(url, limit=WAIT):
    """narod.ru после серии запросов молчит — ждём, пока снова не ответит."""
    t0 = time.time()
    while time.time() - t0 < limit:
        data, _ = fetch(url, tries=1)
        if data:
            return True
        print('  сайт не отвечает, пауза…', flush=True)
        time.sleep(25)
    return False


def download_list(path):
    """Докачка готового списка URL (по одному в строке), без обхода ссылок."""
    urls = [u for u in pathlib.Path(path).read_text(encoding='utf-8').split() if u.strip()]
    got = skip = fail = backoff = 0
    i = 0
    while i < len(urls):
        u = urls[i]
        i += 1
        lp = local_path(u)
        if lp.exists() and lp.stat().st_size > 0:
            skip += 1
            continue
        data, _ = fetch(u, tries=2)
        if data is None:
            fail += 1
            # narod.ru после десятки запросов молчит минутами — не бросаем, а разгоняемся
            if fail % 6 == 0:
                backoff += 1
                if backoff >= 4:
                    print('сайт молчит уже ~%d минут — докачку продолжите той же командой' % (backoff * 3), flush=True)
                    break
                print('  %d неудач подряд, пауза %d с…' % (fail, 60 * backoff), flush=True)
                time.sleep(60 * backoff)
            continue
        lp.parent.mkdir(parents=True, exist_ok=True)
        lp.write_bytes(data)
        got += 1
        fail = 0
        backoff = 0
        time.sleep(DELAY)
        if i % 60 == 0:
            print('  %d/%d: скачано %d' % (i, len(urls), got), flush=True)
            time.sleep(20)               # narod.ru не любит частые запросы
    print('список: %d | скачано %d | уже было %d | ошибок %d' % (len(urls), got, skip, fail), flush=True)
    return got, skip, fail


if os.environ.get('FILES'):
    download_list(os.environ['FILES'])
    sys.exit(0)

wait_for_site(START[0])

q = deque()
for s in START:
    seen.add(urllib.parse.urlparse(s)._replace(query='', fragment='').geturl())
    q.append(s)

while q:
    if len(pages) >= MAX_PAGES:
        break
    url = q.popleft()                      # BFS: сначала все ссылки текущего уровня
    lp = local_path(url)
    is_img = lp.suffix.lower() in IMG_EXT
    if is_img and not GET_IMG:
        continue
    if lp.exists() and lp.stat().st_size > 0:
        data = lp.read_bytes()
    else:
        data, err = fetch(url)
        if data is None:
            failed.append((url, err))
            continue
        lp.parent.mkdir(parents=True, exist_ok=True)
        lp.write_bytes(data)
        time.sleep(DELAY)
    if is_img:
        imgs.append((url, str(lp), len(data)))
        continue
    pages.append([url, str(lp), len(data)])
    html = data.decode('utf-8', 'replace')
    t = re.search(r'<title>(.*?)</title>', html, re.S | re.I)
    pages[-1].append(re.sub(r'\s+', ' ', t.group(1) if t else '').strip())
    print('  %6d %s — %s' % (len(data), lp, pages[-1][3][:68]), flush=True)
    for m in re.findall(r'(?:href|src)="([^"\'#]+)"', html):
        if m.lower().startswith(('mailto:', 'javascript:', 'tel:')):
            continue
        u = urllib.parse.urljoin(url, m)
        u = urllib.parse.urlparse(u)._replace(query='', fragment='').geturl()
        if not same_site(u) or u in seen:
            continue
        seen.add(u)
        q.append(u)

man = {}
for line in (OUT / '_manifest.tsv').read_text('utf-8', 'replace').splitlines() if (OUT / '_manifest.tsv').exists() else []:
    f = line.split('\t')
    if f and f[0]:
        man[f[0]] = f
for u, l, n, t in pages:                       # манифест дополняем, а не перезаписываем
    man[u] = [u, l, str(n), t]
pathlib.Path(OUT / '_manifest.tsv').write_text(
    '\n'.join('\t'.join(v) for v in man.values()) + '\n', encoding='utf-8')
print('ИТОГО страниц: %d | картинок: %d | ошибок: %d' % (len(pages), len(imgs), len(failed)), flush=True)
for u, e in failed:
    print('  FAIL', u, e[:100], flush=True)
