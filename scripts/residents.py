# The population of the settlement, as content: households in the houses of the village, adults with jobs at the
# sites that offer them, children at school, elders. Run inside gen_base_content.py after world_maps.py.
# A fixed seed keeps the same people every time the content is built.

import random

rng = random.Random(1991)

FEMALE = ["Оксана", "Галина", "Лідія", "Ірина", "Наталія", "Олександра", "Марія", "Тетяна", "Софія", "Христина", "Дарина", "Вікторія",
          "Ганна", "Людмила", "Зоряна", "Ліна", "Віра", "Надія", "Катерина", "Уляна", "Злата", "Мирослава", "Ніна", "Леся"]
MALE = ["Петро", "Іван", "Степан", "Василь", "Богдан", "Андрій", "Микола", "Олег", "Тарас", "Юрій", "Дмитро", "Роман",
        "Максим", "Ярослав", "Остап", "Назар", "Матвій", "Арсен", "Захар", "Святослав", "Григорій", "Федір", "Орест", "Лука"]
KIDS_F = ["Мирося", "Соломійка", "Олеся", "Зірка", "Маруся", "Ганнуся", "Дзвінка", "Устина"]
KIDS_M = ["Марко", "Тимко", "Данилко", "Остапчик", "Левко", "Сашко", "Івасик", "Петрик"]
SURNAMES = [("Коваль", "Коваль"), ("Мельник", "Мельник"), ("Шевченко", "Шевченко"), ("Бондар", "Бондар"), ("Ткачук", "Ткачук"), ("Гончар", "Гончар"),
            ("Кравець", "Кравець"), ("Лисенко", "Лисенко"), ("Савчук", "Савчук"), ("Олійник", "Олійник"), ("Дячук", "Дячук"), ("Руденко", "Руденко"),
            ("Петренко", "Петренко"), ("Марчук", "Марчук"), ("Литвин", "Литвин"), ("Сидоренко", "Сидоренко")]

SKIN = ["#fbe0c8", "#f1c9a5", "#e0a97c", "#c98f65", "#a06b47", "#6e4630"]
HAIR = ["#1f1a26", "#4a2f27", "#7a4a2a", "#c9a050", "#e8d9a0", "#d86a3a", "#9aa0b0", "#f0f0f8"]
CLOTH = ["#d9534f", "#e8a23a", "#f4d35e", "#5aa469", "#3fb8b0", "#4a8fd0", "#8a63c9", "#d86aa0", "#e8e0c8", "#2f3a5a", "#3a3a44", "#8a5a2e"]


def look(age, gender):
    hair = rng.choice(HAIR[6:] if age == "elder" else HAIR[:6])
    return {"skin_color": rng.choice(SKIN), "hair_color": hair, "hair": str(rng.randrange(9)), "eye_color": rng.choice(["#2a2035", "#4a2f27", "#2f6b4a", "#3a6aa0"]),
            "face": str(rng.randrange(4)), "top_color": rng.choice(CLOTH), "top2_color": rng.choice(CLOTH), "top": str(rng.randrange(6)),
            "bottom_color": rng.choice(CLOTH), "bottom": str(rng.randrange(3)), "shoes_color": rng.choice(CLOTH), "acc": str(rng.randrange(8) if rng.random() < 0.4 else 0),
            "acc_color": rng.choice(CLOTH)}


# the jobs to fill, from every site that offers work: (site, role, how many)
COUNTS = {"radio_host": 2, "clerk": 2, "journalist": 3, "editor": 1, "photographer": 1, "sawyer": 4, "florist": 1, "waiter": 1, "baker": 2, "seller": 2, "librarian": 1, "vendor": 2, "teacher": 3, "doctor": 2, "nurse": 2,
          "officer": 3, "night_officer": 1, "firefighter": 2, "firefighter_night": 2, "collector": 2, "farmer": 3}
# roles added later are filled by the newcomers below, so the first households keep their jobs (content refers
# to some of them by id)
NEW_ROLES = {"caretaker", "groom", "jockey", "harvester", "old_miner", "tower_keeper", "forester", "postal_clerk", "postman", "utility_clerk", "utility_inspector",
             "shop_assistant", "hairdresser"}
NEW_COUNTS = {"groom": 2, "jockey": 2, "harvester": 3}
openings = []
for loc in locations:
    for site in loc.get("sites", []):
        for job in site.get("jobs", []):
            if job["role"] not in NEW_ROLES:
                openings += [(site["id"], job["role"])] * COUNTS.get(job["role"], 1)
rng.shuffle(openings)
# the most important ones are filled first
order = {"mayor": 0, "radio_host": 0, "journalist": 0, "editor": 1, "photographer": 1, "doctor": 0, "firefighter": 0, "firefighter_night": 0, "officer": 0, "teacher": 1, "nurse": 1, "baker": 2, "seller": 2, "farmer": 2, "sawyer": 2}
openings.sort(key=lambda o: order.get(o[1], 3))

residents = []
used_names = set()


def name_of(pool, surname):
    for _ in range(40):
        n = rng.choice(pool)
        if (n, surname) not in used_names:
            used_names.add((n, surname))
            return n
    return rng.choice(pool)


for i, hid in enumerate(homes):
    sur = SURNAMES[i % len(SURNAMES)][0]
    size = rng.choice([2, 3, 3, 4, 4])
    members = ["adult", "adult"][: 1 if size == 2 and rng.random() < 0.3 else 2]
    while len(members) < size:
        members.append("child" if rng.random() < 0.7 else "elder")
    if rng.random() < 0.2:
        members = ["elder", "elder"]
    for j, age in enumerate(members):
        gender = "f" if (j == 0) != (rng.random() < 0.15) else "m"
        if age == "child":
            first = name_of(KIDS_F if gender == "f" else KIDS_M, sur)
        else:
            first = name_of(FEMALE if gender == "f" else MALE, sur)
        r = {"id": f"res_{len(residents) + 1}", "name": f"{first} {sur}", "gender": gender, "age": age, "home": hid,
             # most people are honest and calm; a few are not, and the village has its stories because of them
             "honesty": rng.choice([90, 85, 80, 75, 70, 60, 50, 30, 20]), "temper": rng.choice([10, 20, 30, 40, 50, 55, 60, 75, 90]),
             "social": rng.choice([30, 45, 55, 65, 75, 85]), "look": look(age, gender)}
        if age == "adult" and openings:
            site, role = openings.pop(0)
            r["job"] = [site, role]
        if age == "child":
            r["school"] = "school_site"
        residents.append(r)


# ------------------------------------------------------------------------------------------------------------
# Who lives how. Drawn from a generator of their own, after the first households, so those stay as they were.
# - partners: the two grown-ups of a household, two elders living together, and some young sweethearts from
#   different houses; partners go out together
# - young: grown-ups in their twenties; only they (and sweethearts) are about late in the evening
# - mobility: some elders walk with a cane, a few people use a wheelchair
# - pram: a young parent pushes a pram when out
# - and enough newcomers that every place has its own people: every job filled (the priest at the church, the
#   staff of every shop, the grooms and jockeys, the harvesters, the caretaker of the cemetery, the old miner)
def _people_of_the_town():
    trng = random.Random(2077)


    def look2(age, gender):
        hair = trng.choice(HAIR[6:] if age == "elder" else HAIR[:6])
        return {"skin_color": trng.choice(SKIN), "hair_color": hair, "hair": str(trng.randrange(9)), "eye_color": trng.choice(["#2a2035", "#4a2f27", "#2f6b4a", "#3a6aa0"]),
                "face": str(trng.randrange(4)), "top_color": trng.choice(CLOTH), "top2_color": trng.choice(CLOTH), "top": str(trng.randrange(6)),
                "bottom_color": trng.choice(CLOTH), "bottom": str(trng.randrange(3)), "shoes_color": trng.choice(CLOTH), "acc": str(trng.randrange(8) if trng.random() < 0.4 else 0),
                "acc_color": trng.choice(CLOTH)}


    def name2(pool, surname):
        for _ in range(60):
            n = trng.choice(pool)
            if (n, surname) not in used_names:
                used_names.add((n, surname))
                return n
        return trng.choice(pool)


    def pair(a, b):
        a["partner"], b["partner"] = b["id"], a["id"]


    households = {}
    for r in residents:
        households.setdefault(r["home"], []).append(r)
    for hid, members in households.items():
        adults = [m for m in members if m["age"] == "adult"]
        elders = [m for m in members if m["age"] == "elder"]
        # husband and wife (two of a kind in one house are brothers or sisters, not a couple)
        if len(adults) >= 2 and adults[0]["gender"] != adults[1]["gender"]:
            pair(adults[0], adults[1])
        if len(elders) == 2 and elders[0]["gender"] != elders[1]["gender"]:
            pair(elders[0], elders[1])
        # a household of just two grown-ups is a young couple; one of the two pushes a pram
        if len(members) == 2 and len(adults) == 2:
            for a in adults:
                a["young"] = True
            trng.choice(adults)["pram"] = True
    for r in residents:
        if r["age"] == "elder" and trng.random() < 0.4:
            r["mobility"] = "cane"
    # one grandmother gets about in a wheelchair
    elders = [r for r in residents if r["age"] == "elder" and r.get("mobility") != "cane"]
    if elders:
        trng.choice(elders)["mobility"] = "wheelchair"

    # the newcomers: every job still open, plus the new places' people
    rest = list(openings)
    for loc in locations:
        for site in loc.get("sites", []):
            for job in site.get("jobs", []):
                if job["role"] in NEW_ROLES:
                    rest.extend([(site["id"], job["role"])] * NEW_COUNTS.get(job["role"], 1))
    village_homes = [h for h in homes if h.startswith("home_")]
    LIVE_AT = {"priest": "church_site", "forester": "forest_hut", "farmer": "farmhouse", "harvester": "farmhouse", "groom": "farmhouse",
               "receptionist": "hostel_site", "jockey": "hostel_site", "vintner": "farmhouse"}
    YOUNG_ROLES = {"waiter", "receptionist", "jockey", "groom", "vet_nurse", "driver", "vendor", "harvester", "florist", "collector", "clerk"}
    newcomers = []
    for k, (site, role) in enumerate(rest):
        elder = role == "old_miner"
        gender = "m" if role in ("priest", "old_miner") else ("f" if trng.random() < 0.5 else "m")
        young = role in YOUNG_ROLES and trng.random() < 0.75
        sur = trng.choice(SURNAMES)[0]
        first = name2(FEMALE if gender == "f" else MALE, sur)
        if role == "priest":
            first = "отець " + trng.choice(["Микола", "Андрій", "Йосиф", "Павло"])
        home = LIVE_AT.get(role) or village_homes[(k * 5 + 3) % len(village_homes)]
        r = {"id": f"res_{len(residents) + 1}", "name": f"{first} {sur}", "gender": gender, "age": "elder" if elder else "adult", "home": home,
             "honesty": trng.choice([90, 85, 80, 75, 70, 60]), "temper": trng.choice([10, 20, 30, 40, 50]),
             "social": trng.choice([45, 55, 65, 75, 85]), "look": look2("elder" if elder else "adult", gender), "job": [site, role]}
        if young:
            r["young"] = True
        if role == "old_miner":
            r["mobility"] = "cane"
        residents.append(r)
        newcomers.append(r)
    # a radio technician who works from a wheelchair, if there is one among the newcomers
    for r in newcomers:
        if r["job"][1] in ("clerk", "technician", "receptionist") and not r.get("mobility"):
            r["mobility"] = "wheelchair"
            break
    # young people of the town find each other: sweethearts from different houses
    singles = [r for r in residents if r.get("young") and not r.get("partner")]
    trng.shuffle(singles)
    used = set()
    for a in singles:
        if a["id"] in used:
            continue
        for b in singles:
            if b["id"] not in used and b["id"] != a["id"] and b["home"] != a["home"] and b["gender"] != a["gender"]:
                pair(a, b)
                used.update({a["id"], b["id"]})
                break
    # and a few grown-up sons and daughters still living at home, who go out in the evenings
    for hid, members in households.items():
        if len([m for m in members if m["age"] == "child"]) >= 2 and trng.random() < 0.7:
            sur = members[0]["name"].split(" ")[-1]
            gender = "f" if trng.random() < 0.5 else "m"
            first = name2(FEMALE if gender == "f" else MALE, sur)
            residents.append({"id": f"res_{len(residents) + 1}", "name": f"{first} {sur}", "gender": gender, "age": "adult", "home": hid, "young": True,
                              "honesty": trng.choice([90, 80, 70, 60, 50]), "temper": trng.choice([20, 30, 40, 55, 70]),
                              "social": trng.choice([65, 75, 85, 90]), "look": look2("adult", gender)})


_people_of_the_town()
