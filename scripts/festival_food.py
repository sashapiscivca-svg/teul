# The Lunar New Year's pastries, sold at the bread stall on the square that day only (festival.rs). Run inside
# gen_base_content.py after economy.py (it needs `good`, `st`).

good("sesame_balls", "Кунжутні кульки", [b(22 + (i % 3) * 18, 30 + (i // 3) * 18, 0, 18, 18, 18, "ball", "ball") for i in range(5)] + [b(20, 26, 0, 60, 46, 4, "plate", "round")],
     {"ball": slot("autumn", 3), "plate": slot("fabric", 1)}, ("food", "sweet"))
good("nian_gao", "Рисовий пиріг няньгао", [b(26, 26, 0, 48, 48, 22, "cake", "cyl"), b(30, 30, 22, 40, 40, 4, "top", "cyl"), b(44, 44, 26, 12, 12, 6, "date", "ball")],
     {"cake": slot("autumn", 1), "top": slot("autumn", 3), "date": slot("fabric", 1)}, ("food", "sweet"))
good("moon_cake", "Місячний пряник", [b(28, 28, 0, 44, 44, 18, "cake", "cyl"), b(34, 34, 18, 32, 32, 3, "print", "cyl")],
     {"cake": slot("wood", 3), "print": slot("wood", 1)}, ("food", "sweet"))

LNY = {"days": ["lunar_new_year"], "hint": "Ці ласощі печуть лише на Місячний Новий рік."}
st("st.stall_bread.sesame_balls", "village", "stall_bread", "Купити кунжутні кульки", "Хрусткі зовні, тягучі всередині. «На солодкий рік!» — каже пекарка.", "buy",
   cost=5, gives=[("sesame_balls", 1)], per_day=2, hours=(9, 20), requires=LNY)
st("st.stall_bread.nian_gao", "village", "stall_bread", "Купити няньгао", "Липкий рисовий пиріг: що вище він, то вищим буде рік.", "buy",
   cost=7, gives=[("nian_gao", 1)], per_day=1, hours=(9, 20), requires=LNY)
st("st.stall_bread.moon_cake", "village", "stall_bread", "Купити місячний пряник", "З візерунком дракона на скоринці.", "buy",
   cost=6, gives=[("moon_cake", 1)], per_day=1, hours=(9, 20), requires=LNY)
