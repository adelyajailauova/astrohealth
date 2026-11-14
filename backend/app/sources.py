"""Registry of verified sources.

Every medical threshold and recommendation in the app points to one of these
entries. Quotes are short excerpts checked against the live pages (Nov 2026).
"""

SOURCES: dict[str, dict] = {
    "nasa_std3001_v1_3004": {
        "org": "NASA",
        "title": "NASA-STD-3001 Vol. 1, 3.5 In-Mission Medical Care [V1 3004]",
        "url": "https://www.nasa.gov/reference/3-0-health-and-medical-care/",
        "quote": "Assessing, recording, monitoring, and trending vital signs ... "
        "Private transmission of medical data (including imaging) to ground medical support ... "
        "evidence-based asynchronous behavioral health treatment protocols available on electronic devices.",
    },
    "nasa_std3001_v1_4030": {
        "org": "NASA",
        "title": "NASA-STD-3001 Vol. 1, 4.8.2 Career Radiation Exposure Limit [V1 4030]",
        "url": "https://www.nasa.gov/reference/4-0-human-performance/",
        "quote": "An individual crewmember's total career effective radiation dose due to spaceflight "
        "radiation exposure shall be less than 600 mSv.",
    },
    "nasa_cardio": {
        "org": "NASA HRP",
        "title": "Risk of Cardiovascular Adaptations",
        "url": "https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/",
        "quote": "...potentially leading to blood clots, heart arrythmias, cardiovascular disease, and low "
        "blood pressure which elevates the chances of fainting at landing.",
    },
    "nasa_hypoxia": {
        "org": "NASA HRP",
        "title": "Risk of Hypoxia",
        "url": "https://www.nasa.gov/reference/risk-of-hypoxia/",
        "quote": "Mild hypoxia, if untreated, can cause confusion, headaches, vision impairment, and trouble sleeping.",
    },
    "nasa_sleep": {
        "org": "NASA HRP",
        "title": "Risk from Inadequate Sleep and Irregular Schedules",
        "url": "https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/",
        "quote": "Astronauts witness 16 sunrises and sunsets per day aboard the space station.",
    },
    "nasa_behavior": {
        "org": "NASA HRP",
        "title": "Risk of Behavioral Changes and Psychiatric Disorders",
        "url": "https://www.nasa.gov/reference/risk-of-behavioral-conditions-and-psychiatric-disorders/",
        "quote": "NASA encourages astronauts to explore self-care options including keeping a regular journal.",
    },
    "nasa_sans": {
        "org": "NASA HRP",
        "title": "Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS)",
        "url": "https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/",
        "quote": "Approximately 70 percent of astronauts aboard the International Space Station experience "
        "some swelling in the back of their eyes.",
    },
    "nasa_bone": {
        "org": "NASA HRP",
        "title": "Risk of Spaceflight-Induced Bone Changes",
        "url": "https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/",
        "quote": "On average, bones lose between 1% and 1.5% of their density each month during four-to-six-month missions.",
    },
    "nasa_fitness": {
        "org": "NASA HRP",
        "title": "Risk of Reduced Cardiorespiratory and Musculoskeletal Fitness",
        "url": "https://www.nasa.gov/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/",
        "quote": "Astronauts ... perform resistance training and aerobic exercises for 1.5 hours per day.",
    },
    "nasa_immune": {
        "org": "NASA HRP",
        "title": "Risk of Altered Immune System Responses",
        "url": "https://www.nasa.gov/reference/risk-of-altered-immune-system-responses/",
        "quote": "Some astronauts ... have reported cold sores, rashes, atypical allergies, and infections.",
    },
    "nasa_radiation": {
        "org": "NASA HRP",
        "title": "Risk of Radiation-Induced Cancers",
        "url": "https://www.nasa.gov/reference/risk-of-radiation-induced-cancers/",
        "quote": "Missions to the Moon and Mars will extend beyond this protective bubble.",
    },
    "nasa_distance": {
        "org": "NASA HRP",
        "title": "Hazard: Distance From Earth",
        "url": "https://www.nasa.gov/hrp/hazard-distance-from-earth/",
        "quote": "Facing a communication delay of up to 20 minutes one way ...",
    },
    "nasa_gravity": {
        "org": "NASA HRP",
        "title": "Hazard: Gravity Fields",
        "url": "https://www.nasa.gov/hrp/hazard-gravity-fields/",
        "quote": "When shifting from weightlessness to gravity, astronauts may even experience lightheadedness and fainting.",
    },
    "nasa_wearables": {
        "org": "NASA",
        "title": "Wearable Tech for Space Station Research (2024)",
        "url": "https://www.nasa.gov/missions/station/wearable-tech-for-space-station-research/",
        "quote": "Core body temperature rises higher and faster during exercise in space than on Earth.",
    },
    "csa_biomonitor": {
        "org": "CSA",
        "title": "Bio-Monitor: Keeping an eye on astronauts' vital signs",
        "url": "https://www.asc-csa.gc.ca/eng/sciences/bio-monitor.asp",
        "quote": "Measures pulse and electrical activity of the heart, blood pressure, breathing rate and volume, "
        "skin temperature, blood oxygen saturation, physical activity levels.",
    },
    "mp_vitals": {
        "org": "NIH MedlinePlus",
        "title": "Vital signs",
        "url": "https://medlineplus.gov/ency/article/002341.htm",
        "quote": "Breathing: 12 to 18 breaths per minute. Pulse: 60 to 100 beats per minute.",
    },
    "mp_pulse": {
        "org": "NIH MedlinePlus",
        "title": "Pulse",
        "url": "https://medlineplus.gov/ency/article/003399.htm",
        "quote": "Adults: 60 to 100 beats per minute. Well-trained athletes: 40 to 60 beats per minute.",
    },
    "mp_hbp": {
        "org": "NIH MedlinePlus",
        "title": "High blood pressure - adults",
        "url": "https://medlineplus.gov/ency/article/000468.htm",
        "quote": "Normal: lower than 120/80 mm Hg. Elevated: 120-129 and <80. Stage 1: 130/80 to <140/90. "
        "140/90 mm Hg or higher: Stage 2.",
    },
    "mp_lbp": {
        "org": "NIH MedlinePlus",
        "title": "Low blood pressure",
        "url": "https://medlineplus.gov/ency/article/007278.htm",
        "quote": "Normal blood pressure is between 90/60 mmHg and 120/80 mmHg ... A drop of as little as "
        "20 mmHg can cause problems for some people.",
    },
    "mp_pulseox": {
        "org": "NIH MedlinePlus",
        "title": "Pulse Oximetry",
        "url": "https://medlineplus.gov/lab-tests/pulse-oximetry/",
        "quote": "Normal 95% to 100%. Contact your provider if your oxygen saturation level is 92% or lower. "
        "If it falls to 88% or lower, seek immediate medical attention.",
    },
    "mp_temp": {
        "org": "NIH MedlinePlus",
        "title": "Body temperature norms",
        "url": "https://medlineplus.gov/ency/article/001982.htm",
        "quote": "Normal from 97°F (36.1°C) to 99°F (37.2°C). Over 100.4°F (38°C) most often means a fever.",
    },
    "mp_glucose": {
        "org": "NIH MedlinePlus",
        "title": "Blood sugar test",
        "url": "https://medlineplus.gov/ency/article/003482.htm",
        "quote": "Fasting 70 to 99 mg/dL normal; 100 to 125 impaired fasting glucose; 126 or higher usually diabetes.",
    },
    "mp_hypoglycemia": {
        "org": "NIH MedlinePlus",
        "title": "Low blood sugar",
        "url": "https://medlineplus.gov/ency/article/000386.htm",
        "quote": "Blood sugar below 70 mg/dL (3.9 mmol/L) is considered low.",
    },
    "nhlbi_sleep": {
        "org": "NIH NHLBI",
        "title": "How Much Sleep Is Enough?",
        "url": "https://www.nhlbi.nih.gov/health/sleep/how-much-sleep",
        "quote": "Experts recommend that adults sleep between 7 and 9 hours a night.",
    },
    "nccih_relax": {
        "org": "NIH NCCIH",
        "title": "Relaxation Techniques: What You Need To Know",
        "url": "https://www.nccih.nih.gov/health/relaxation-techniques-what-you-need-to-know",
        "quote": "Preliminary evidence suggesting that diaphragmatic breathing exercises may help to reduce stress ... "
        "HRV biofeedback is helpful for reducing self-reported stress and anxiety.",
    },
    "nccih_meditation": {
        "org": "NIH NCCIH",
        "title": "Meditation and Mindfulness: Effectiveness and Safety",
        "url": "https://www.nccih.nih.gov/health/meditation-and-mindfulness-effectiveness-and-safety",
        "quote": "About 8 percent of participants had a negative effect from practicing meditation ... "
        "most commonly reported negative effects were anxiety and depression.",
    },
}
