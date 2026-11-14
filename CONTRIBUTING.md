# Как работать с проектом командой

## 1. Первый запуск (один раз)
Нужны Python 3.11+, Node.js 20+ и git.

```bash
git clone https://github.com/adelyajailauova/astrohealth.git
cd astrohealth
python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt
cd frontend && npm install && cd ..
```

Запуск двух серверов в двух терминалах:
```bash
.venv/bin/uvicorn app.main:app --app-dir backend --port 8000 --reload
```
```bash
cd frontend && npm run dev
```
Откройте http://localhost:5173. На Windows вместо `.venv/bin/` пишите `.venv\Scripts\`.

## 2. Как вносить правки
1. Обновите main: `git checkout main && git pull`
2. Создайте свою ветку: `git checkout -b имя/что-делаю`, например `aliya/amsler-test`
3. Внесите изменения и закоммитьте: `git add -A && git commit -m "Добавлен тест Амслера"`
4. Отправьте ветку: `git push -u origin имя/что-делаю`
5. На GitHub нажмите **Compare & pull request**. Кто-то из команды смотрит изменения и нажимает **Merge**.

Не пушьте напрямую в `main`. Так правки не перетрут друг друга.

## 3. Где обсуждать
- **Issues** — идеи и задачи («добавить тест Амслера», «перевести интерфейс»). Назначайте исполнителя, чтобы два человека не делали одно и то же.
- **Комментарии в Pull Request** — обсуждение конкретного кода.

## 4. Кто что может взять (по папкам, чтобы меньше конфликтов)
| Область | Файлы |
|---|---|
| Медицинские правила и источники | `backend/app/assess.py`, `backend/app/sources.py`, `RESEARCH.md` |
| Симуляция и демо-сценарии | `backend/app/simulator.py` |
| Канал связи / задержка | `backend/app/comms.py` |
| Экран астронавта | `frontend/src/pages/Crew.tsx`, `frontend/src/components.tsx` |
| Wellbeing / check-in | `frontend/src/pages/Wellbeing.tsx` |
| Mission Control | `frontend/src/pages/Ground.tsx` |
| Стили | `frontend/src/index.css` |

## 5. Правило по медицинской информации
Любой новый порог или совет добавляется **только со ссылкой на официальный источник** (NASA, ESA, CSA, NIH и т.п.) в `sources.py`. Если правило придумали сами, ставьте `origin="app"`. Тогда на вкладке Evidence будет честно видно, что это наше решение.
