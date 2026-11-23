---
name: Git: приватность DCO
description: Правило для этого проекта — не светить корпоративный ashirin@astralinux.ru в Signed-off-by и авторе коммита; личный адрес берётся из git-config репозитория и не пишется в файлы репозитория; порядок коммита и перекос истории при утечке.
---

# Git: приватность Signed-off-by

## Правило

- **В этом проекте в `Signed-off-by` (DCO), в авторе и коммиттере коммита не должно быть
  `ashirin@astralinux.ru`** — корпоративный адрес. `origin` — публичный GitHub
  (`github.com:ctordev/magnetizer.git`), трейлер и автор уезжают в публичную историю.
- Личный адрес для подписи лежит **в git-config репозитория** (`git config user.email`,
  `.git/config` не версионируется) и продублирован в личном `~/.config/opencode/AGENTS.md`.
- **Личный адрес не писать в файлы репозитория** (скиллы, AGENTS.md, документы) —
  они публикуются при пуше. В трекаемых файлах только ссылка: «адрес из git-config».

## Перед каждым коммитом

```bash
git config user.email        # обязан показать личный адрес, не ashirin@astralinux.ru
```

Если конфиг съехал (клон, worktree, другой каталог) — коммитить с явным переопределением
из личного AGENTS.md, не меняя глобальный конфиг:

```bash
git -c user.name="Aleksey Shirin" -c user.email="<личный адрес из git-config/AGENTS>" commit -s -m "..."
```

После коммита — контроль:

```bash
git log -1 --format='%ae / %ce | %(trailers:key=Signed-off-by,valueonly)'
# нет ashirin@astralinux.ru; в тексте коммита — grep -c ashirin@astralinux.ru → 0
```

Трейлеры: тело → `Assisted-by: OpenCode (<модель по отображаемому имени>)` → `Signed-off-by:`
(личный AGENTS).

## Если astralinux-адрес уже утёк в локальные коммиты (до пуша)

История ещё не опубликована — переписать (рабочее дерево чистое: заstashить).
`NEW` — личный адрес из git-config:

```bash
NEW=$(git config user.email)
git filter-branch -f \
  --env-filter "export GIT_AUTHOR_EMAIL=$NEW
                export GIT_COMMITTER_EMAIL=$NEW" \
  --msg-filter "sed 's/ashirin@astralinux\.ru/$NEW/g'" \
  -- --all
git stash pop
```

`--msg-filter` обязателен: адрес живёт в трейлере `Signed-off-by`, это часть сообщения.
После перекоса удалить `refs/original/*` и осколок `refs/stash`, затем
`git reflog expire --expire=now --all && git gc --prune=now` и проверить, что старые SHA
исчезли (`git cat-file -e <старый SHA>` → ошибка).

## Пуш

Пуш выполняет **только пользователь** (личное правило): агент готовит команду, не выполняет.
Если старая история уже на GitHub — force-push с привязкой к известному удалённому SHA:

```
git push --force-with-lease=main:<старый удалённый SHA> origin main
```

После force-push старые коммиты недостижимы из ветки, но GitHub сохраняет их по SHA —
полное удаление только через поддержку GitHub.
