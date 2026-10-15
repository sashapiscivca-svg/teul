# The world fills up (docs/world-economy.md): what the player carries in the pocket, the bags from the wool farm,
# the keys that open the way, the places that do something (stations), the help the town's people ask for, the
# journalist's questions. Run inside gen_base_content.py after daily_content.py (it needs `found`, `items`,
# `locations`, `collections`, `npcs`, `residents`).
#
# Rules kept here: nothing at home earns or gives from nothing; every key and every thing a help needs can be
# got in places open before it (checked by check_economy.py); texts are Ukrainian.

SP, SU, AU, WI = "Spring", "Summer", "Autumn", "Winter"

POCKET = 8


def good(id, name, model, slots, tags=(), category="goods"):
    """Something the player carries: a find of the town (food, a material, a little thing)."""
    found(id, name, category, model, slots, tags)
    items[-1]["carry"] = True


def jar(id, name, body, lid, tags, label=None):
    m = [b(34, 34, 0, 32, 32, 34, "body", "cyl"), b(32, 32, 32, 36, 36, 8, "lid", "cyl")]
    s = {"body": slot(*body), "lid": slot(*lid)}
    if label:
        m.append(b(33, 33, 10, 34, 34, 12, "label", "cyl"))
        s["label"] = slot(*label)
    good(id, name, m, s, tags)


def bottle(id, name, glass, cork, tags, label=None):
    m = [b(40, 40, 0, 20, 20, 36, "glass", "cyl"), b(44, 44, 34, 12, 12, 16, "glass", "cyl"), b(45, 45, 50, 10, 10, 6, "cork", "cyl")]
    s = {"glass": slot(*glass), "cork": slot(*cork)}
    if label:
        m.append(b(39, 39, 10, 22, 22, 12, "label", "cyl"))
        s["label"] = slot(*label)
    good(id, name, m, s, tags)


def cup(id, name, cup_color, drink, tags):
    good(id, name, [b(36, 36, 0, 28, 28, 30, "cup", "cyl"), b(39, 39, 26, 22, 22, 4, "drink", "cyl"), b(62, 44, 8, 8, 10, 14, "cup", "round")],
         {"cup": slot(*cup_color), "drink": slot(*drink)}, tags)


# ---- food and drink -------------------------------------------------------------------------------------------
good("bread", "Паляниця", [b(22, 30, 0, 56, 40, 24, "crust", "round"), b(30, 36, 20, 40, 28, 8, "top", "round"), b(36, 44, 26, 28, 4, 2, "cut")],
     {"crust": slot("wood", 3), "top": slot("wood", 1), "cut": slot("pastel", 3)}, ("food", "bread"))
good("bun", "Булочка з маком", [b(30, 30, 0, 40, 40, 20, "crust", "ball"), b(38, 38, 18, 24, 24, 4, "seeds", "round")],
     {"crust": slot("autumn", 3), "seeds": slot("ceramic", 5)}, ("food", "sweet"))
good("pie", "Яблучний пиріг", [b(22, 22, 0, 56, 56, 14, "dish", "cyl"), b(24, 24, 10, 52, 52, 10, "crust", "cyl"), b(34, 34, 18, 32, 4, 2, "lattice"), b(34, 50, 18, 32, 4, 2, "lattice")],
     {"dish": slot("ceramic", 0), "crust": slot("wood", 3), "lattice": slot("wood", 1)}, ("food", "sweet"))
good("milk", "Глечик молока", [b(34, 34, 0, 32, 32, 36, "jug", "cyl"), b(38, 38, 34, 24, 24, 10, "jug", "cyl"), b(39, 39, 42, 22, 22, 2, "milk", "cyl"), b(64, 44, 14, 8, 10, 16, "jug", "round")],
     {"jug": slot("ceramic", 2), "milk": slot("ceramic", 0)}, ("food", "dairy"))
good("eggs", "Свіжі яйця", [b(22, 30, 0, 56, 40, 10, "basket", "round")] + [b(28 + (i % 3) * 15, 34 + (i // 3) * 14, 6, 14, 12, 16, "egg", "ball") for i in range(5)],
     {"basket": slot("wood", 3), "egg": slot("ceramic", 1)}, ("food", "farm"))
good("cheese", "Головка сиру", [b(26, 26, 0, 48, 48, 26, "rind", "cyl"), b(50, 50, 0, 24, 24, 26, "cut", "box")],
     {"rind": slot("autumn", 3), "cut": slot("pastel", 3)}, ("food", "dairy"))
jar("honey", "Банка меду", ("autumn", 1), ("fabric", 6), ("food", "sweet"), ("pastel", 3))
jar("jam", "Вишневе варення", ("fabric", 1), ("fabric_pink", 3), ("food", "sweet"), ("ceramic", 0))
good("flour", "Мішечок борошна", [b(30, 32, 0, 40, 36, 34, "sack", "round"), b(38, 38, 32, 24, 22, 8, "tie", "cone")],
     {"sack": slot("ceramic", 1), "tie": slot("wood", 3)}, ("grain",))
bottle("wine", "Пляшка вина «Лоза»", ("fabric", 3), ("wood", 3), ("drink", "wine"), ("pastel", 3))
bottle("grape_juice", "Виноградний сік", ("fabric", 6), ("ceramic", 0), ("drink", "sweet"), ("leaf", 1))
bottle("lemonade", "Домашній лимонад", ("glass", 3), ("fabric", 2), ("drink", "sweet"), ("fabric", 2))
cup("coffee", "Кава навинос", ("ceramic", 0), ("earth", 0), ("drink",))
cup("cocoa", "Какао з пінкою", ("fabric", 7), ("earth", 3), ("drink", "sweet"))
good("water_jar", "Глек криничної води", [b(34, 34, 0, 32, 32, 34, "clay", "cyl"), b(38, 38, 32, 24, 24, 8, "clay", "cyl"), b(39, 39, 38, 22, 22, 2, "water", "cyl")],
     {"clay": slot("pot", 1), "water": slot("glass", 1)}, ("water",))

# ---- the farm and the field --------------------------------------------------------------------------------
good("wool", "Овеча вовна", [b(24, 30, 0, 52, 40, 22, "fleece", "ball"), b(34, 36, 16, 30, 26, 14, "fleece", "ball")],
     {"fleece": slot("ceramic", 1)}, ("wool", "craft"))
good("yarn", "Моток пряжі", [b(32, 32, 0, 36, 36, 34, "ball", "ball"), b(30, 46, 14, 40, 6, 4, "strand", "round")],
     {"ball": slot("fabric", 3), "strand": slot("fabric", 3)}, ("yarn", "craft"))
good("hay", "Оберемок сіна", [b(20, 30, 0, 60, 40, 22, "hay", "round"), b(26, 28, 18, 44, 30, 8, "hay", "round"), b(22, 48, 6, 56, 4, 4, "twine")],
     {"hay": slot("autumn", 3), "twine": slot("wood", 2)}, ("farm",))
good("carrot", "Морква", [b(30, 44, 0, 46, 12, 12, "root", "cone"), b(70, 44, 2, 16, 12, 10, "top", "round")],
     {"root": slot("autumn", 0), "top": slot("leaf", 1)}, ("veg",))
good("potato", "Картопля", [b(28, 40, 0, 20, 16, 14, "body", "ball"), b(50, 36, 0, 22, 18, 15, "body", "ball"), b(40, 52, 0, 18, 15, 13, "body", "ball"), b(56, 40, 12, 3, 3, 2, "eye")],
     {"body": slot("wood", 3), "eye": slot("wood", 2)}, ("veg",))
good("corn", "Качан кукурудзи", [b(36, 26, 0, 22, 50, 20, "cob", "round"), b(30, 22, 0, 34, 20, 12, "husk", "round")],
     {"cob": slot("fabric", 2), "husk": slot("leaf", 3)}, ("veg",))
good("sunflower_seeds", "Насіння соняшника", [b(30, 30, 0, 40, 40, 16, "bag", "round"), b(40, 40, 14, 20, 20, 6, "seeds", "ball")],
     {"bag": slot("pastel", 3), "seeds": slot("ceramic", 5)}, ("seeds",))

# ---- little things -------------------------------------------------------------------------------------------
good("book", "Книжка з бібліотеки", [b(26, 30, 0, 48, 36, 10, "cover"), b(28, 30, 2, 44, 34, 6, "pages"), b(26, 30, 10, 48, 36, 2, "cover")],
     {"cover": slot("fabric", 0), "pages": slot("pastel", 3)}, ("book",))
good("bouquet", "Букет квітів", [b(44, 44, 0, 12, 12, 30, "stems", "cone"), b(30, 30, 26, 40, 40, 22, "flowers", "ball"), b(38, 30, 30, 10, 10, 10, "accent", "ball"), b(40, 40, 10, 20, 20, 10, "wrap", "cone")],
     {"stems": slot("leaf", 0), "flowers": slot("fabric_pink", 0), "accent": slot("fabric", 2), "wrap": slot("pastel", 3)}, ("flower", "gift"))
good("wish_charm", "Оберіг з фонтану", [b(40, 40, 0, 20, 20, 20, "charm", "ball"), b(46, 46, 18, 8, 8, 12, "string", "cyl")],
     {"charm": slot("glass", 1), "string": slot("fabric", 1)}, ("charm", "rare"))
good("horseshoe", "Підкова на щастя", [b(24, 36, 0, 12, 30, 6, "iron", "round"), b(64, 36, 0, 12, 30, 6, "iron", "round"), b(30, 30, 0, 40, 12, 6, "iron", "round")],
     {"iron": slot("metal", 0)}, ("charm", "rare"))
good("postcard", "Листівка з Липового", [b(24, 34, 0, 52, 32, 3, "card"), b(28, 38, 3, 24, 24, 1, "picture"), b(56, 40, 3, 14, 4, 1, "stamp")],
     {"card": slot("pastel", 3), "picture": slot("glass", 1), "stamp": slot("fabric", 1)}, ("paper",))
good("star_chart", "Зоряна карта", [b(22, 30, 0, 56, 40, 4, "paper", "round"), b(30, 36, 4, 4, 4, 1, "star"), b(48, 44, 4, 4, 4, 1, "star"), b(60, 38, 4, 4, 4, 1, "star")],
     {"paper": slot("glass", 1), "star": slot("fabric", 2)}, ("star", "paper"))
good("record", "Платівка «Липове FM»", [b(26, 26, 0, 48, 48, 3, "vinyl", "cyl"), b(42, 42, 3, 16, 16, 1, "label", "cyl")],
     {"vinyl": slot("ceramic", 5), "label": slot("fabric", 1)}, ("music",))
good("scarf", "В'язаний шарф", [b(20, 40, 0, 60, 18, 8, "knit", "round"), b(20, 40, 6, 10, 18, 4, "fringe")],
     {"knit": slot("fabric", 1), "fringe": slot("fabric", 5)}, ("craft", "gift"))
good("mittens", "Рукавички", [b(26, 34, 0, 22, 32, 10, "knit", "round"), b(52, 34, 0, 22, 32, 10, "knit", "round"), b(26, 34, 8, 22, 6, 3, "cuff")],
     {"knit": slot("fabric", 6), "cuff": slot("ceramic", 0)}, ("craft", "gift"))

# ---- bags: they add room to the pocket (the best one counts) ----------------------------------------------------
found("pouch", "Торбинка", "gear", [b(30, 34, 0, 40, 32, 30, "sack", "round"), b(36, 38, 28, 28, 22, 8, "neck", "cone"), b(46, 30, 30, 8, 40, 3, "cord")],
      {"sack": slot("ceramic", 1), "neck": slot("ceramic", 1), "cord": slot("fabric", 1)}, ("bag",))
items[-1]["bag"] = 8
found("backpack", "Рюкзак", "gear", [b(26, 34, 0, 48, 28, 50, "body", "round"), b(28, 30, 30, 44, 10, 20, "flap", "round"), b(32, 60, 4, 36, 6, 30, "pocket", "round"), b(34, 32, 48, 32, 8, 6, "handle", "round")],
      {"body": slot("leaf", 0), "flap": slot("wood", 0), "pocket": slot("leaf", 2), "handle": slot("wood", 2)}, ("bag",))
items[-1]["bag"] = 20

# ---- keys: guides that open the way (on the keyring, never in the pocket) --------------------------------------
def key(id, name, model, slots):
    found(id, name, "gear", model, slots, ("key",))
    items[-1]["key"] = True


key("miner_lantern", "Ліхтар старого шахтаря", [b(38, 38, 0, 24, 24, 6, "metal", "cyl"), b(40, 40, 6, 20, 20, 22, "glass", "cyl"), b(38, 38, 28, 24, 24, 6, "metal", "cone"), b(46, 46, 34, 8, 8, 8, "metal", "round"), b(44, 44, 10, 12, 12, 12, "flame", "ball")],
    {"metal": slot("metal", 2), "glass": slot("glass", 0), "flame": slot("fabric", 2)})
# the old miner's lantern still burns: a light like any lamp
items[-1]["tags"] = ["key", "light"]
key("cellar_key", "Ключ від льоху", [b(26, 44, 0, 20, 20, 6, "iron", "cyl"), b(44, 48, 0, 34, 6, 6, "iron"), b(68, 48, 0, 6, 12, 6, "iron")],
    {"iron": slot("metal", 2)})
key("tower_key", "Ключ від водонапірної вежі", [b(24, 42, 0, 22, 22, 6, "brass", "cyl"), b(44, 48, 0, 36, 6, 6, "brass"), b(70, 48, 0, 8, 14, 6, "brass")],
    {"brass": slot("metal", 1)})
key("race_pass", "Перепустка на іподром", [b(26, 36, 0, 48, 28, 3, "card"), b(30, 40, 3, 12, 12, 1, "horse"), b(46, 42, 3, 22, 4, 1, "text")],
    {"card": slot("fabric", 2), "horse": slot("earth", 1), "text": slot("ceramic", 5)})

# every find already in the world goes into the pocket too
FIND_CATEGORIES = {"nature", "fish", "worn"}
for it in items:
    if it.get("hidden") and it["category"] in FIND_CATEGORIES:
        it["carry"] = True
TAGS_MORE = {"wheat_ear": ["grain"], "grapes": ["fruit"], "crystal_shard": ["cave", "rare"]}
for it in items:
    if it["id"] in TAGS_MORE:
        it["tags"] = sorted(set(it.get("tags", [])) | set(TAGS_MORE[it["id"]]))

# ---- places that do something --------------------------------------------------------------------------------
stations = []


def st(id, location, prop, label, text, kind, needs=(), cost=0, gives=(), earn=0, per_day=1, seasons=(), hours=None, requires=None):
    s = {"id": id, "location": location, "prop": prop, "label": label, "text": text, "kind": kind,
         "needs": [list(n) for n in needs], "cost": cost, "gives": [list(g) for g in gives], "earn": earn,
         "per_day": per_day, "seasons": list(seasons)}
    if hours:
        s["hours"] = list(hours)
    if requires:
        s["requires"] = requires
    stations.append(s)


# the village square
st("st.fountain.wish", "village", "fountain", "Кинути монетку", "Монетка дзенькнула об дно. Бажання загадано — тільки нікому не кажи.", "wish", cost=1, per_day=3)
st("st.fountain.charm", "village", "fountain", "Пошукати на дні оберіг", "Між монетками блиснуло скельце на шнурочку. Хтось загадав і забув — тепер воно твоє.", "wish",
   cost=5, gives=[("wish_charm", 1)], seasons=(SP, SU))
st("st.notice_board.read", "village", "notice_board", "Прочитати оголошення", "«Загубився кіт, рудий, відгукується на «Пиріжок»». «Продам велосипед, майже не кусається». «У суботу — толока біля школи».", "read", per_day=3)
st("st.telescope.stars", "village", "telescope", "Подивитися на зорі", "Ти знаходиш Чумацький Шлях і Великий Віз — і перемальовуєш їх на клаптик паперу.", "gather",
   gives=[("star_chart", 1)], hours=(20, 24))
st("st.stall_bread.bun", "village", "stall_bread", "Купити булочку", "Ще тепла, з маком. Пекарка підморгує: «Друга — завтра!»", "buy", cost=4, gives=[("bun", 1)], per_day=2, hours=(7, 14))
st("st.stall_veg.carrot", "village", "stall_veg", "Купити моркву", "Солодка, з грядки, ще з землею на хвостику.", "buy", cost=2, gives=[("carrot", 2)], per_day=2, hours=(7, 16))
st("st.stall_veg.potato", "village", "stall_veg", "Купити картоплю", "Три бульби — якраз на деруни.", "buy", cost=3, gives=[("potato", 1)], per_day=2, hours=(7, 16))
st("st.stall_veg.seeds", "village", "stall_veg", "Купити насіння соняшника", "Жменька смаженого насіння — і пташкам, і собі.", "buy", cost=2, gives=[("sunflower_seeds", 1)], per_day=2, hours=(7, 16))
st("st.stall_flowers.bouquet", "village", "stall_flowers", "Купити букет", "Квітникарка загортає букет у крафт і перев'язує стрічкою.", "buy", cost=10, gives=[("bouquet", 1)], per_day=1, hours=(8, 18))
# the second-hand buyer by the vegetable stalls: anything from the pocket, cheaply, up to twenty pieces a day
# (a price of 0 means "not that": what was lent or is someone else's)
st("st.market.buyer", "village", "stall_veg", "Скупка: продати з інвентарю", "Скупник крутить річ у руках, називає ціну й відраховує монети з бляшанки.", "sell", per_day=20, hours=(8, 17))
stations[-1]["buys"] = [["#loan", 0], ["#post", 0], ["#rare", 12], ["#rift", 10], ["#crafted", 8], ["#tool", 6], ["#record", 5], ["#music", 5], ["#fish", 4], ["#worn", 4], ["#gift", 4],
                        ["#dish", 3], ["#toy", 3], ["#book", 3], ["#metal", 3], ["#wool", 3], ["#yarn", 3], ["#material", 2], ["#sweet", 2], ["#flower", 2], ["#seed", 2],
                        ["#sapling", 2], ["#sheet", 2], ["#food", 1], ["*", 1]]
stations[-1]["spent"] = "Скупник махає рукою: «На сьогодні досить, бляшанка порожня. Приходь завтра»."
st("st.carousel.ride", "village", "carousel", "Покататися на каруселі", "Коники біжать по колу, світ розмивається, а ти смієшся, як у дитинстві.", "ride", cost=2, per_day=4, hours=(10, 21))
st("st.swing.swing", "village", "swing", "Погойдатися", "Вище, ще вище — видно дахи й верхівку костелу.", "play", per_day=6)
st("st.birdbath.feed", "village", "birdbath", "Насипати пташкам насіння", "Горобці злітаються звідусіль. Одна синичка лишає тобі пір'їнку на згадку.", "make",
   needs=[("sunflower_seeds", 1)], gives=[("feather", 1)])

# the bakery and the café
st("st.bakery.bread", "bakery_in", "bread_shelf", "Купити паляницю", "Тепла паляниця, ще пахне піччю.", "buy", cost=5, gives=[("bread", 1)], per_day=2, hours=(6, 19))
st("st.bakery.pie", "bakery_in", "cash_counter", "Купити яблучний пиріг", "Шматок? Ні — цілий пиріг. Пекар навіть не питає.", "buy", cost=12, gives=[("pie", 1)], hours=(8, 19))
st("st.bakery.flour", "bakery_in", "bread_oven", "Продати борошно пекарю", "«Оце мука! Тонка, як пух», — пекар відраховує монети.", "sell", needs=[("flour", 2)], earn=14, per_day=2)
st("st.bakery.bake_pie", "bakery_in", "bread_oven", "Спекти пиріг у печі", "Яблука, борошно, яйце — і за пів години на всю пекарню пахне корицею.", "make",
   needs=[("#fruit", 2), ("flour", 1), ("eggs", 1)], gives=[("pie", 1)])
st("st.cafe.coffee", "cafe_in", "counter", "Взяти каву навинос", "Бариста малює на пінці листочок липи.", "buy", cost=4, gives=[("coffee", 1)], per_day=3, hours=(7, 21))
st("st.cafe.cocoa", "cafe_in", "counter", "Взяти какао", "Какао з пінкою і зефіринкою зверху. Гріє долоні й душу.", "buy", cost=5, gives=[("cocoa", 1)], per_day=2, seasons=(AU, WI), hours=(7, 21))
st("st.cafe.lemonade", "cafe_in", "counter", "Взяти лимонад", "Холодний, з м'ятою. Лід дзенькає об склянку.", "buy", cost=4, gives=[("lemonade", 1)], per_day=2, seasons=(SP, SU), hours=(9, 21))
st("st.cafe.fish", "cafe_in", "stove", "Віддати рибу кухарю", "«На юшку піде!» — кухар забирає улов і висипає тобі в долоню монети.", "sell", needs=[("#fish", 1)], earn=8, per_day=4)

# the market (the grocery buys what the forest and the garden give, a little a day)
st("st.grocery.fruit", "grocery_in", "apple_basket", "Продати фрукти", "Продавчиня зважує яблука на старих терезах і задоволено киває.", "sell", needs=[("#fruit", 2)], earn=6, per_day=3)
st("st.grocery.berries", "grocery_in", "veg_crate", "Продати ягоди", "«Лісові? Справжні?» — і вже розкладає їх у кошички.", "sell", needs=[("#berry", 2)], earn=7, per_day=2)
st("st.grocery.mushrooms", "grocery_in", "veg_crate", "Продати гриби", "Гриби в крамниці розбирають ще до обіду.", "sell", needs=[("#mushroom", 2)], earn=10, per_day=2)
st("st.grocery.milk", "grocery_in", "display_fridge", "Купити молоко", "Пляшка з фермерським молоком, із вершками зверху.", "buy", cost=4, gives=[("milk", 1)], per_day=2, hours=(7, 21))
st("st.grocery.honey", "grocery_in", "shop_shelf", "Купити мед", "Липовий мед з пасіки за фермою. Тягнеться, як сонячне проміння.", "buy", cost=14, gives=[("honey", 1)], hours=(7, 21))

# flowers, books, the church and the cemetery
st("st.flowers.make_bouquet", "flower_in", "potting_bench", "Скласти букет зі своїх квітів", "Флористка показує, як поставити мак поміж ромашок. Виходить гарно!", "make",
   needs=[("#flower", 3)], gives=[("bouquet", 1)], per_day=2)
st("st.flowers.buy", "flower_in", "flower_cart", "Купити букет", "Півонії, еустоми й гілочка евкаліпту.", "buy", cost=10, gives=[("bouquet", 1)], hours=(8, 19))
st("st.library.borrow", "library_in", "bookshelf", "Взяти книжку додому", "Бібліотекарка ставить штамп і шепоче: «Тільки не загинайте сторінки».", "read", gives=[("book", 1)], hours=(9, 19))
st("st.library.return", "library_in", "bookcase_tall", "Повернути книжку", "Книжка повертається на полицю, а в тебе в голові лишається ціла історія.", "read", needs=[("book", 1)], per_day=2)
st("st.church.candle", "church_in", "candle_stand", "Запалити свічку", "Маленький вогник тремтить поміж інших. Тихо стає на душі.", "wish", cost=2)
st("st.church.organ", "church_in", "organ", "Послухати орган", "Органістка якраз репетирує. Звук наповнює костел до самого склепіння.", "play", per_day=2, hours=(10, 18))
st("st.cemetery.flowers", "cemetery", "grave_stone", "Покласти квіти", "Ти кладеш букет на старий камінь. Хтось колись так само сюди приходив.", "wish", needs=[("bouquet", 1)])

# the radio, the paper, the town hall
st("st.radio.song", "radio_in", "mic_stand", "Замовити пісню", "Ведучий читає твоє привітання в ефірі. На всю вулицю грає твоя пісня!", "play", cost=3, per_day=2, hours=(8, 22))
st("st.radio.record", "radio_in", "record_shelf", "Купити платівку радіо", "Платівка з найкращими піснями «Липове FM», з підписом ведучого.", "buy", cost=25, gives=[("record", 1)])
st("st.newsroom.ad", "newsroom_in", "news_desk", "Дати оголошення в газету", "Редакторка обіцяє поставити його поруч із прогнозом погоди. Найкраще місце!", "read", cost=5)
st("st.newsroom.paper", "newsroom_in", "newspaper_stack", "Погортати свіжий номер", "Пахне друкарською фарбою. На першій шпальті — новини, які ти, може, сам і зробив.", "read", per_day=3)
st("st.townhall.postcard", "townhall_in", "reception_desk", "Взяти листівку з видом містечка", "Секретарка дістає листівку з ратушею й липами: «На згадку!»", "buy", cost=3, gives=[("postcard", 1)], per_day=2, hours=(9, 18))

# the gym, the vet, the hostel, the bar
st("st.gym.train", "gym_in", "treadmill", "Потренуватися", "Пів години на доріжці — і ноги кажуть «дякую» (трохи згодом).", "play", cost=3, per_day=2, hours=(7, 22))
st("st.gym.box", "gym_in", "punching_bag", "Погамселити грушу", "Тренерка показує правильний джеб. Ще! Ще!", "play", per_day=3)
st("st.vet.stray", "vet_in", "cat_bed", "Нагодувати безпритульного кота", "Рудий кіт з'їдає рибку, муркоче й засинає просто на твоїй руці.", "make", needs=[("#fish", 1)])
st("st.hostel.rest", "hostel_in", "bunk_bed", "Подрімати з дороги", "Скрипить ліжко, шумить місто за вікном. Ти прокидаєшся відпочилим.", "rest", cost=10)
st("st.bar.lemonade", "bar_in", "bar_counter", "Замовити лимонад", "Барменка кладе в склянку дві вишеньки: «За рахунок закладу — одна».", "buy", cost=5, gives=[("lemonade", 1)], per_day=2, hours=(12, 24))
st("st.bar.wine", "bar_in", "bar_counter", "Продати вино в бар", "«Справжня «Лоза»? Беру!» — пляшка вирушає на верхню полицю.", "sell", needs=[("wine", 1)], earn=25, per_day=2)
st("st.bar.jukebox", "bar_in", "jukebox", "Поставити пісню в автоматі", "Монетка проковтнута, платівка опускається — і бар підспівує.", "play", cost=1, per_day=4)
st("st.bar.darts", "bar_in", "dartboard", "Кинути дротики", "Сімка, двадцятка, і… просто в яблучко! Хтось за столиком аплодує.", "play", per_day=3)

# the water tower (once the key is had) and the forest
st("st.tower.lookout", "water_tower_in", "iron_ladder", "Піднятися на оглядовий майданчик", "Звідси видно все Липове: дахи, поле, вітряки й темну смугу лісу.", "play", per_day=3)
st("st.tower.water", "water_tower_in", "pipe_valve", "Набрати води з крана", "Вода з вежі холодна й трохи пахне залізом.", "gather", gives=[("water_jar", 1)], per_day=2)
st("st.forest.campfire", "forest", "campfire", "Погрітися біля вогнища", "Тріщить хмиз, іскри летять до зірок. Пахне димом і печеною картоплею.", "rest", per_day=2)
st("st.forest.bake_potato", "forest", "campfire", "Спекти картоплю в жарі", "Обпікаєш пальці, дмухаєш — і їси з попелом. Найсмачніше в світі.", "make", needs=[("potato", 1)])
st("st.forest.lookout", "forest", "fire_lookout", "Видертися на пожежну вишку", "Ліс до самого обрію, і ніде ні димка. Лісник махає тобі знизу.", "play", per_day=2)
st("st.forest.sawmill", "forest", "sawmill", "Допомогти на пилорамі", "Ти подаєш дошки, пилорама співає. Пилярі ділять з тобою обід і платню.", "gather", earn=10, hours=(8, 17))

# the farm and the wool farm
st("st.farm.milk", "farm", "cowshed", "Подоїти корову", "Зірка стоїть смирно і тільки раз махає хвостом тобі по вуху.", "gather", gives=[("milk", 1)], per_day=2, hours=(5, 11))
st("st.farm.eggs", "farm", "chicken_coop", "Зібрати яйця", "Кури обурено кудкудакають, але віддають. Одне яйце ще тепле.", "gather", gives=[("eggs", 1)], hours=(6, 12))
st("st.farm.well", "farm", "well", "Набрати води з криниці", "Цебро гуркоче ланцюгом униз, і з глибини піднімається крижана вода.", "gather", gives=[("water_jar", 1)], per_day=3)
st("st.farm.honey", "farm", "beehive", "Зібрати мед", "У сітці й рукавицях, повільно-повільно… Бджоли незадоволені, але мед — твій.", "gather", gives=[("honey", 1)], seasons=(SU, AU))
st("st.farm.shear", "farm", "wool_bale", "Постригти вівцю", "Вівця Бебешка терпить, бо знає: влітку без шуби легше.", "gather", gives=[("wool", 2)], per_day=2)
st("st.farm.corn", "farm", "corn_row", "Наламати кукурудзи", "Качани шелестять, і з кожного визирає жовте зерно.", "gather", gives=[("corn", 1)], per_day=2, seasons=(SU, AU))
st("st.farm.hay", "farm", "haystack", "Набрати сіна", "Сіно колеться й пахне літом, навіть узимку.", "gather", gives=[("hay", 1)], per_day=3)
st("st.farm.feed", "farm", "trough", "Нагодувати худобу", "Корови тягнуться до сіна, фермер дякує монетою: «Помічник!»", "sell", needs=[("hay", 1)], earn=5, per_day=2)
st("st.creamery.cheese", "creamery_in", "cheese_vat", "Зварити сир", "Молоко густішає, сироварка показує, як різати калє. За тиждень — сир!", "make",
   needs=[("milk", 2)], gives=[("cheese", 1)], per_day=2)
st("st.creamery.spin", "creamery_in", "spinning_wheel", "Спрясти пряжу", "Колесо дзижчить, вовна тягнеться в рівну нитку. Виходить не одразу, але виходить.", "make",
   needs=[("wool", 2)], gives=[("yarn", 1)], per_day=3)
st("st.creamery.scarf", "creamery_in", "loom", "Виткати шарф", "Човник снує туди-сюди. Шарф виходить теплим і трохи кривим — так і треба.", "make",
   needs=[("yarn", 2)], gives=[("scarf", 1)])
st("st.creamery.mittens", "creamery_in", "loom", "Сплести рукавички", "Петля за петлею — і ось пара рукавичок з візерунком-ялинкою.", "make", needs=[("yarn", 1)], gives=[("mittens", 1)])
st("st.creamery.pouch", "creamery_in", "cash_counter", "Пошити торбинку", "Сироварка шиє з твоєї вовни торбинку на шнурку: «Тепер влізе більше!»", "buy",
   needs=[("wool", 3)], cost=30, gives=[("pouch", 1)])
st("st.creamery.sell_cheese", "creamery_in", "cash_counter", "Здати сир на продаж", "Твій сир кладуть на вітрину з табличкою «Від нашого сусіда».", "sell", needs=[("cheese", 1)], earn=18, per_day=2)

# the field, the mill, the vineyard and the winery
st("st.fields.wheat", "fields", "wheat_a", "Нажати пшениці", "Серп шелестить, колоски лягають у сніп. Над полем кружляє лелека.", "gather", gives=[("wheat_ear", 2)], per_day=2, seasons=(SU, AU))
st("st.fields.pass", "fields", "notice_board", "Купити перепустку на іподром", "На дошці — каса іподрому «Буревій»: «Сезонна перепустка. Коні чекають!»", "buy",
   cost=40, gives=[("race_pass", 1)])
st("st.factory.mill", "factory_in", "flour_mill", "Змолоти борошно", "Жорна гудуть, і з лотка сиплеться біле, тепле борошно.", "make", needs=[("wheat_ear", 3)], gives=[("flour", 1)], per_day=3)
st("st.vineyard.grapes", "vineyard", "grapevine", "Зібрати виноград", "Грона важкі й теплі від сонця. Одна ягідка — тобі, решта — в кошик.", "gather", gives=[("grapes", 2)], per_day=2, seasons=(SU, AU))
st("st.vineyard.juice", "vineyard", "wine_press", "Вичавити сік", "Ногами в чан — і сміх на весь виноградник. Сік солодкий-солодкий.", "make", needs=[("grapes", 3)], gives=[("grape_juice", 1)])
st("st.winery.wine", "winery_in", "wine_barrel", "Покласти вино в бочку", "Винар наливає твій виноградний сік у дубову бочку й ставить крейдою твоє ім'я.", "make",
   needs=[("grapes", 4)], gives=[("wine", 1)])
st("st.winery.buy", "winery_in", "bottle_shelf", "Купити пляшку вина", "«Урожай минулої осені. Гарний був рік», — каже винар.", "buy", cost=30, gives=[("wine", 1)])

# the hippodrome (with the pass) and the cave (with the lantern)
st("st.hippodrome.race", "hippodrome", "grandstand", "Подивитися забіг", "Коні летять по колу, трибуни гудуть. Буревій виграє на пів голови!", "play", cost=2, per_day=2, hours=(10, 19))
st("st.hippodrome.horse", "hippodrome", "stable", "Пригостити коня морквою", "Кінь хрумтить морквою й тицяє тебе носом. Конюх дарує стару підкову: «На щастя».", "make",
   needs=[("carrot", 2)], gives=[("horseshoe", 1)])
st("st.cave.minecart", "cave", "minecart", "Прокотитися вагонеткою", "Рейки скриплять, ліхтар хитається, а в темряві спалахують кристали.", "ride", per_day=3)

# ---- help that opens the way ------------------------------------------------------------------------------------
helps = []


def aid(id, giver, giver_name, location, title, text, needs, coins=0, gives=(), thanks="", after=(), requires=None):
    h = {"id": id, "giver": giver, "giver_name": giver_name, "location": location, "title": title, "text": text,
         "needs": [list(n) for n in needs], "after": list(after), "coins": coins, "gives": list(gives), "thanks": thanks}
    if requires:
        h["requires"] = requires
    helps.append(h)


aid("help.old_miner", "panas", "Дід Панас", "village", "Ліхтар старого шахтаря",
     "Колись я двадцять років ходив у шахту під Скелястим пагорбом. Мій старий ліхтар іще світить — та ґніт стерся, а скло тріснуло. "
     "Принеси три соснові шишки на розпал і моток пряжі на новий ґніт — полагоджу й віддам тобі. Без світла в печері — ні кроку.",
     [("pine_cone", 3), ("yarn", 1)], coins=30, gives=["miner_lantern"],
     thanks="Ось, світить як новий! Бережи його. І кажуть, у глибині печери кристали співають…")
aid("help.vineyard", "res_64", "Богдан Ткачук, винар", "farm", "Спрага виноградника",
     "Літо видалося сухе, лози в'януть, а наш насос зламався. Принеси три глеки криничної води з колодязя на фермі й оберемок сіна — замульчувати коріння. "
     "Тоді відчиню тобі виноградник: збирай, скільки донесеш!",
     [("water_jar", 3), ("hay", 1)], coins=35, gives=["grape_juice"],
     thanks="Лози ожили! Ворота виноградника для тебе завжди відчинені.")
aid("help.cellar_key", "res_70", "Ірина Кравець, барменка", "bar_in", "Закуска до вечора вікторини",
     "У п'ятницю вікторина, а закуски — нуль. Дві паляниці й головка сиру врятують вечір! А я… віддам тобі ключ від льоху. Там давно ніхто не був, "
     "кажуть, за бочками є прохід кудись далі.",
     [("bread", 2), ("cheese", 1)], coins=20, gives=["cellar_key"],
     thanks="Рятівник! Ось ключ. Тільки лампу візьми — у льоху темно, як у бочці.")
aid("help.tower_key", "res_16", "Матвій Гончар, голова громади", "townhall_in", "Свято біля вежі",
     "Водонапірній вежі сто років! На святі я хочу прочитати щось гарне й подарувати квіти найстаршій мешканці. Принеси книжку з бібліотеки й букет — "
     "а я довірю тобі ключ від вежі. З її майданчика видно все містечко.",
     [("book", 1), ("bouquet", 1)], coins=25, gives=["tower_key"],
     thanks="Від імені громади — дякую! Ключ твій. Тільки не лізь на бак, будь ласка.")
aid("help.wool_1", "res_67", "Роман Гончар, сировар", "creamery_in", "Перша стрижка",
     "Овець треба постригти до спеки, а в мене руки зайняті сиром. Принеси чотири жмені вовни з ферми — і навчу тебе прясти.",
     [("wool", 4)], coins=20, gives=["mittens"],
     thanks="Добра вовна! Ось тобі рукавички — з твоєї ж вовни, до речі.")
aid("help.wool_2", "res_67", "Роман Гончар, сировар", "creamery_in", "Пряжа для ярмарку",
     "На ярмарок треба пряжі — три мотки. Колесо он там, вовна — на фермі. Впораєшся?",
     [("yarn", 3)], coins=30, gives=["scarf"], after=["help.wool_1"],
     thanks="Рівненька, ніби машинна! Тримай шарф — у нас вітряно.")
aid("help.backpack", "res_67", "Роман Гончар, сировар", "creamery_in", "Рюкзак для мандрівника",
     "Ти стільки носиш туди-сюди, що тобі потрібен справжній рюкзак. Принеси дві головки свого сиру й банку меду — "
     "продам на ярмарку, а з виторгу пошию тобі рюкзак із міцної вовняної тканини.",
     [("cheese", 2), ("honey", 1)], coins=20, gives=["backpack"], after=["help.wool_2"],
     thanks="Ось! Двадцять кишеньок для двадцяти пригод.")
aid("help.baker", "res_48", "Остап Сидоренко, пекар", "bakery_in", "Борошно до свята врожаю",
     "Млин стоїть, а мені на свято врожаю треба напекти короваїв. Три мішечки борошна — і я твій боржник!",
     [("flour", 3)], coins=40, gives=["pie"],
     thanks="Коровай буде на все місто! А цей пиріг — тобі, гарячий.")
aid("help.librarian", "res_66", "Наталія Гончар, бібліотекарка", "library_in", "Небо для читальні",
     "Хочу прикрасити читальню мапою неба. Перемалюй зорі в телескоп на площі й принеси пір'їну — підпишемо сузір'я старим чорнилом.",
     [("star_chart", 1), ("feather", 1)], coins=25, gives=["postcard"],
     thanks="Тепер діти читатимуть під зорями. Дякую!")
aid("help.kitten", "yarynka", "Яринка", "vet_in", "Кошеня біля ветклініки",
     "Біля ветклініки сидить кошеня, таке худеньке! Лікарка каже, його треба нагодувати. Принесеш молока й рибку? Будь ласочка!",
     [("milk", 1), ("#fish", 1)], coins=15, gives=["wish_charm"],
     thanks="Воно поїло й заснуло! Я назву його Розломчик. Тримай мій оберіг — на щастя.")
aid("help.radio", "res_10", "Олег Бондар, ведучий", "radio_in", "Ранковий ефір",
     "О шостій ранку ефір, а кавоварка в студії зламалася. Дві кави навинос — і я тобі подарую платівку з автографом!",
     [("coffee", 2)], coins=15, gives=["record"],
     thanks="Доброго ранку, Липове! …Це я вже в ефірі тренуюся. Дякую!")
aid("help.farm", "res_40", "Остап Петренко, фермер", "farm", "Зимові запаси",
     "Узимку худобі треба багато сіна, а мені самому не встигнути. Три оберемки сіна й глек води — і я поділюся медом з пасіки.",
     [("hay", 3), ("water_jar", 1)], coins=30, gives=["honey"],
     thanks="Корови тобі вклоняються. Ну, жують, але це те саме.")
aid("help.church_flowers", "olena", "Олена", "church_in", "Квіти до храмового свята",
     "На свято святого Миколая я прикрашаю костел. Два букети — і вівтар засяє.",
     [("bouquet", 2)], coins=30, gives=["wish_charm"],
     thanks="Як гарно! Отець Михайло сказав, що це найкрасивіший вівтар за десять років.")
aid("help.newsroom", "res_30", "Ніна Олійник, редакторка", "newsroom_in", "Конкурс листівок",
     "Газета оголошує конкурс «Липове в листівках». Принеси дві листівки з ратуші — надрукуємо найкращі на першій шпальті.",
     [("postcard", 2)], coins=25, gives=["book"],
     thanks="Чудові! Одна з них піде в недільний номер.")
aid("help.stable", "res_56", "Богдан Шевченко, конюх", "hippodrome", "Морква для Буревія",
     "Буревій перед забігом нервує, а заспокоюється тільки морквою. Три морквини й оберемок сіна — і я покажу тобі стайню зсередини.",
     [("carrot", 3), ("hay", 1)], coins=30, gives=["horseshoe"],
     thanks="Буревій тебе запам'ятав. Тримай підкову з його копита — справжню, на щастя.")

# ---- places opened by help or by a guide ----------------------------------------------------------------------
GATES = {
    "cave": {"items": ["miner_lantern"],
             "hint": "Без ліхтаря в печері не видно власних рук. Дід Панас колись ходив у шахту — може, в нього лишився ліхтар?"},
    "bar_cellar": {"items": ["cellar_key"],
                   "hint": "Люк замкнений на важкий замок. Ключ, кажуть, у барменки Ірини — вона якраз шукає, чим пригостити гостей вікторини."},
    "water_tower_in": {"items": ["tower_key"],
                       "hint": "Двері вежі замкнені. Ключ у голови громади — зайди до ратуші, він готує свято."},
    "hippodrome": {"items": ["race_pass"],
                   "hint": "На вході перевіряють перепустки. Касу іподрому видно на дошці оголошень біля поля."},
    "vineyard": {"helped": ["help.vineyard"],
                 "hint": "Ворота виноградника зачинені — лози сохнуть. Винар Богдан шукає помічника біля криниці на фермі."},
}
for loc in locations:
    if loc["id"] in GATES:
        loc["requires"] = GATES[loc["id"]]

# ---- the journalist's questions -----------------------------------------------------------------------------------
interviews = [
    {"q": "Що вам найбільше подобається в Липовому?", "answers": ["Ранкова кава й липи на площі", "Люди — тут усі вітаються", "Тиша вечорами", "Пекарня. Чесно, тільки пекарня"]},
    {"q": "Яка ваша улюблена пора року?", "answers": ["Весна — все цвіте", "Літо, бо річка й суниці", "Осінь — листя й какао", "Зима, коли сніг рипить"]},
    {"q": "Чи вірите ви, що в печері співають кристали?", "answers": ["Чула на власні вуха!", "Це вітер у щілинах", "Хочу перевірити сам", "Співають, але фальшиво"]},
    {"q": "Що б ви змінили в містечку?", "answers": ["Більше лавок у парку", "Кінотеатр під відкритим небом", "Нічого — хай буде як є", "Щоб автобус ходив частіше"]},
    {"q": "Ваш рецепт ідеального вихідного?", "answers": ["Риболовля на світанку", "Книжка й плед", "Прогулянка лісом", "Спати до обіду"]},
    {"q": "Хто, на вашу думку, пече найкращий хліб?", "answers": ["Наша пекарня, звісно", "Моя бабуся", "Я сам, просто ще не пробував", "Хлібзавод «Колос»"]},
    {"q": "Що ви скажете котові, який спить на вашій лавці?", "answers": ["Посуваюся й сідаю поруч", "Пригощаю рибкою", "Нічого — це його лавка", "Фотографую для газети"]},
    {"q": "Яку пісню замовили б на «Липове FM»?", "answers": ["Щось про весну", "Стару, як у дитинстві", "Гучну, щоб танцювати", "Колискову для всього міста"]},
    {"q": "Що для вас означає дім?", "answers": ["Місце, де чекають", "Запах чаю на кухні", "Кіт на підвіконні", "Усе Липове"]},
    {"q": "Чи бачили ви золоту рибку в ставку?", "answers": ["Бачив, але бажання не скажу", "Ні, але вірю", "Бачив сома — схоже?", "Я її впіймав і відпустив"]},
    {"q": "Ваша порада новоприбулим?", "answers": ["Познайомтеся з сусідами", "Сходіть на поле на світанку", "Не годуйте кота з бару — він хитрий", "Читайте «Липовий вісник»!"]},
    {"q": "Куди б ви повели гостя з іншого міста?", "answers": ["На оглядовий майданчик вежі", "На іподром", "У ліс по гриби", "У кав'ярню «Липа»"]},
]

# ---- collections of the new things -----------------------------------------------------------------------------
collections += [
    {"id": "col.farm", "name": "Дари ферми", "items": ["milk", "eggs", "wool", "honey", "hay"], "reward": "beehive"},
    {"id": "col.bakery", "name": "Пекарня", "items": ["bread", "bun", "pie", "flour"], "reward": "plate_stack"},
    {"id": "col.crafts", "name": "Рукоділля", "items": ["yarn", "scarf", "mittens"], "reward": "sewing_machine"},
    {"id": "col.luck", "name": "На щастя", "items": ["wish_charm", "horseshoe", "clover4"], "reward": "hourglass"},
    {"id": "col.harvest", "name": "Урожай", "items": ["wheat_ear", "grapes", "carrot", "potato", "corn"], "reward": "vegetable_patch"},
    {"id": "col.town", "name": "Сувеніри Липового", "items": ["postcard", "star_chart", "record", "book"], "reward": "photo_wall"},
]
