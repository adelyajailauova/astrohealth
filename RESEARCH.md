# Исследование: мониторинг здоровья астронавтов

Сводка по официальным источникам NASA HRP и Канадского космического агентства (CSA). Её задача — дать основу для приложения: датчики → оценка на борту → автоматическая передача данных medical staff / flight surgeons.

---

## 1. Пять угроз космического полёта (NASA HRP)

| Угроза | Что происходит | Что можно измерять |
|---|---|---|
| **Радиация** | Рак, дегенерация тканей (сердце, сосуды, глаза), влияние на ЦНС, острый лучевой синдром. Луна и Марс находятся **вне магнитосферы**, МКС — внутри неё | Накопленная доза с персонального дозиметра (ESA Active Dosimeter, CSA EVARM) |
| **Изоляция и замкнутость** | Тревога, депрессия, недосып, сбой циркадных ритмов, перегрузка работой | Настроение, сон (актиграфия), когнитивные тесты |
| **Удалённость от Земли** | Задержка связи **до 20 минут в одну сторону** на Марсе, полёт около 3 лет, ограниченные медицинские ресурсы | — (влияет на архитектуру системы, см. п. 4) |
| **Гравитация** | Кости теряют **1–1,5% плотности в месяц**; жидкости смещаются к голове (SANS); головокружение и обмороки при смене гравитации; камни в почках | АД, ЧСС, ортостатический тест, данные о тренировках |
| **Враждебная/замкнутая среда** | Изменения иммунитета, реактивация латентных вирусов, CO₂, микробы, температура, шум | CO₂ в кабине и персональный CO₂, температура, симптомы |

## 2. Риски из Human Research Roadmap и показатели для них

Официальный список HRP включает 22 риска. Ниже — те, которые можно отслеживать датчиками:

- **Сердечно-сосудистые адаптации.** Тромбы, **аритмии**, низкое АД и обмороки при посадке; сердце становится более сферическим. → **ЭКГ, ЧСС, ВСР, АД**. Это главный аргумент в пользу нашей идеи.
- **SANS.** Отёк диска зрительного нерва, складки сетчатки. Около **70% астронавтов МКС** имеют отёк в задней части глаза. → самооценка зрения (тест Амслера, острота зрения), в будущем — снимки фундоскопа.
- **Сон и циркадные ритмы.** 16 восходов в сутки на МКС; в полёте астронавты спят значительно меньше. → длительность сна, актиграфия, ЧСС во сне (вест Wearable Monitoring).
- **Поведение и психика.** Тревога и депрессия; помогают ведение дневника и окна. → ежедневный опросник настроения, дневник.
- **Гипоксия.** При пониженном давлении в кабине будущих кораблей: спутанность, головная боль, нарушения зрения и сна. → **SpO₂**.
- **Кардиореспираторная и мышечная форма.** Средняя потеря силы и аэробной формы 10–12%; норма тренировок — 1,5 ч/день, 6–7 дней в неделю. → минуты тренировок, ЧСС на тренировке.
- **Кости.** Минус 1–1,5% плотности в месяц. → напоминание о силовых тренировках, ориентировочный трекер.
- **Иммунитет.** Сыпь, герпес, аллергии. → журнал симптомов, температура.
- **Терморегуляция (ESA Thermolab).** В космосе температура ядра тела растёт **выше и быстрее** во время нагрузки и дольше не снижается в покое. → температура тела.
- **Декомпрессионная болезнь (ВКД).** Симптомы требуют быстро завершить выход. → чек-лист симптомов после выхода.
- **Радиация.** → доза за миссию в сравнении с лимитом.

## 3. Что реально используется на борту (прототипы нашей идеи)

**CSA Bio-Monitor** (на МКС с декабря 2018; разработчик — Carré Technologies / Hexoskin):
- комплект из умной рубашки, повязки на голову и приложения на планшете;
- измеряет: **пульс и ЭКГ, АД, частоту и объём дыхания, температуру кожи, SpO₂, физическую активность**;
- носится во сне и на тренировках;
- данные передаются на Землю: батарея ставится в базу, и данные уходят через систему связи станции. Это **store-and-forward**, а не стрим в реальном времени.
- Мотивация CSA: отдельные ЭКГ, тонометр, пульсоксиметр и браслет громоздкие и отнимают время.

**Другие носимые устройства на МКС:** Actiwatch Spectrum (сон и освещённость), T-Mini (температура ядра тела, повязка), Wearable Monitoring (ЧСС и дыхание во сне), Personal CO₂ Monitor, Active Dosimeter.
**Ультразвук:** Vascular Echo — ультразвук, которым удалённо управляют с Земли, потому что экипаж не обязательно умеет проводить УЗИ.

## 4. Выводы для архитектуры нашего приложения

1. **Наша идея совпадает с реальной практикой** (Bio-Monitor), так что её легко обосновать перед жюри.
2. **Отличие от Bio-Monitor (наше преимущество):** Bio-Monitor в первую очередь собирает данные для науки. Мы добавляем **оценку на борту в реальном времени + понятные подсказки астронавту + автоматическую сортировку отчёта** для врачей.
3. **Задержка связи меняет дизайн.** На МКС врач может ответить почти сразу, а у Марса проходит до 40 минут туда и обратно. Поэтому:
   - приложение **само** определяет статус (зелёный/жёлтый/красный) и показывает инструкцию первой помощи сразу;
   - отправка данных идёт через **очередь store-and-forward** с приоритетами: критические события сразу, сводки пакетами;
   - в интерфейсе виден **выбор локации** (МКС / Луна / Марс) и симулированная задержка связи. Это хорошо смотрится на демо.
4. Задача хакатона требует **самопроверку + рекомендации + объяснения** для не-медиков. Нужны карточки «Зачем это измерять / как измерить / что значит результат».

## 5. Показатели и пороги MVP (проверены по источникам)

> Пороги проверены по живым страницам NIH MedlinePlus / NHLBI и NASA-STD-3001 (ноябрь 2026). Сайты AHA и CDC отказали в автоматической загрузке, поэтому использованы NIH-источники с теми же нормами. «App» означает наше собственное правило эскалации, а не цифру из источника. Полная таблица с цитатами — в приложении на вкладке Evidence и в `backend/app/sources.py`.

| Показатель | Норма 🟢 | Внимание 🟡 | Тревога 🟠 / Критично 🔴 | Источник |
|---|---|---|---|---|
| ЧСС покоя | 60–100 (40–59 у тренированных) | 101–120 | >120 или <40 (app) | MedlinePlus Pulse |
| ЭКГ | регулярный ритм | — | нерегулярный (app) | NASA HRP Cardiovascular |
| АД | 90/60 – <120/80 | 120–139 / 80–89; <90/60; падение ≥20 мм рт. ст. | ≥140/90; низкое АД + головокружение | MedlinePlus HBP, Low BP |
| SpO₂ | 95–100% | 93–94% | ≤92% 🟠, ≤88% 🔴 | MedlinePlus Pulse Oximetry |
| Температура | 36,1–37,2 °C | 37,3–38,0 | >38,0 в покое | MedlinePlus Body temperature |
| Дыхание | 12–18 /мин | вне диапазона | <8 или >24 (app) | MedlinePlus Vital signs |
| Глюкоза натощак | 70–99 | 100–125 | ≥126 или <70 | MedlinePlus Blood sugar / Low blood sugar |
| Сон | ≥7 ч | <7 ч | <5 ч (app) | NIH NHLBI |
| Настроение | 3–5 | 2 или стресс ≥4 (app) | 1 (app) | NASA HRP Behavioral |
| Тренировки | ≥90 мин/день | <90 | — | NASA HRP Fitness |
| Радиация | <50% лимита | ≥50% (app) | ≥80% (app); лимит 600 мЗв за карьеру | NASA-STD-3001 V1 4030 |

**Дыхание и медитация:** NIH NCCIH приводит предварительные данные о том, что диафрагмальное дыхание может снижать стресс (кортизол, АД), а HRV-биофидбек снижает субъективный стресс и тревогу. Медитация обычно низкорисковая, но у ~8% участников исследований были негативные эффекты. Поэтому в приложении есть предупреждение и возможность приватной связи с психологом. NASA-STD-3001 V1 3004 требует «доказательные асинхронные протоколы поведенческой помощи на электронных устройствах».

## 6. Предлагаемый MVP для демо

- **Дашборд экипажа** с фигурой человека: зоны тела кликабельны (сердце → ЭКГ/АД, лёгкие → SpO₂/дыхание, голова → сон/настроение/зрение, кости/мышцы → тренировки), цвет зоны показывает статус.
- **Живые графики** со «стримом датчиков» (симулятор в стиле Bio-Monitor, позже — реальный BLE-датчик / Web Bluetooth, если он будет).
- **Движок оценки**: правила из таблицы 5 + сравнение с базовой линией. Выдаёт статус и рекомендацию.
- **Mission Control (экран врача)**: входящие отчёты по приоритету, задержка связи, история показателей.
- **Ежедневный чек-ин**: настроение, сон, симптомы, тест зрения; геймификация через серии дней и очки.
- Локации: МКС / Луна / Марс с разной задержкой связи.

Стек в итоге: **React + Vite + TypeScript + Recharts** на фронтенде, **Python FastAPI + WebSocket** на бэкенде (см. README.md).

---

## Источники
- NASA-STD-3001 Vol.1 — 3.0 Health and Medical Care: https://www.nasa.gov/reference/3-0-health-and-medical-care/
- NASA-STD-3001 Vol.1 — 4.0 Human Performance: https://www.nasa.gov/reference/4-0-human-performance/
- MedlinePlus: Vital signs https://medlineplus.gov/ency/article/002341.htm · Pulse https://medlineplus.gov/ency/article/003399.htm · High BP https://medlineplus.gov/ency/article/000468.htm · Low BP https://medlineplus.gov/ency/article/007278.htm · Pulse oximetry https://medlineplus.gov/lab-tests/pulse-oximetry/ · Temperature https://medlineplus.gov/ency/article/001982.htm · Blood sugar https://medlineplus.gov/ency/article/003482.htm · Low blood sugar https://medlineplus.gov/ency/article/000386.htm
- NIH NHLBI — How Much Sleep Is Enough: https://www.nhlbi.nih.gov/health/sleep/how-much-sleep
- NIH NCCIH — Relaxation Techniques: https://www.nccih.nih.gov/health/relaxation-techniques-what-you-need-to-know
- NIH NCCIH — Meditation and Mindfulness: https://www.nccih.nih.gov/health/meditation-and-mindfulness-effectiveness-and-safety
- NASA HRP — 5 Hazards of Human Spaceflight: https://www.nasa.gov/hrp/hazards/
- NASA HRP — Hazard: Distance from Earth: https://www.nasa.gov/hrp/hazard-distance-from-earth/
- NASA HRP — Hazard: Gravity Fields: https://www.nasa.gov/hrp/hazard-gravity-fields/
- NASA HRP — Hazard: Isolation and Confinement: https://www.nasa.gov/hrp/hazard-isolation-and-confinement/
- NASA HRP — Hazard: Hostile/Closed Environments: https://www.nasa.gov/hrp/hazard-hostile-closed-environments/
- NASA HRP — Risks of Human Spaceflight: https://www.nasa.gov/hrp/risks/
- NASA Human Research Roadmap — Risks (22): https://humanresearchroadmap.nasa.gov/risks/
- NASA — Risk of Cardiovascular Adaptations: https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/
- NASA — Risk of SANS: https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/
- NASA — Risk from Inadequate Sleep: https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/
- NASA — Risk of Behavioral Conditions: https://www.nasa.gov/reference/risk-of-behavioral-conditions-and-psychiatric-disorders/
- NASA — Risk of Hypoxia: https://www.nasa.gov/reference/risk-of-hypoxia/
- NASA — Risk of Reduced Fitness: https://www.nasa.gov/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/
- NASA — Risk of Bone Changes: https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/
- NASA — Risk of Altered Immune Response: https://www.nasa.gov/reference/risk-of-altered-immune-system-responses/
- NASA — Risk of Radiation-Induced Cancers: https://www.nasa.gov/reference/risk-of-radiation-induced-cancers/
- NASA — Risk of Decompression Sickness: https://www.nasa.gov/reference/risk-of-decompression-sickness/
- NASA — Space Radiation (SRAG): https://www.nasa.gov/hrp/hazard-space-radiation/
- NASA — Wearable Tech for Space Station Research (2024): https://www.nasa.gov/missions/station/wearable-tech-for-space-station-research/
- NASA — Station Science 101: Cardiovascular Research: https://www.nasa.gov/missions/station/iss-research/station-science-101-cardiovascular-research-on-station/
- CSA — Bio-Monitor: https://www.asc-csa.gc.ca/eng/sciences/bio-monitor.asp
