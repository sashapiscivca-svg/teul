# The full moons in Kyiv time, 2020–2060 (Meeus, Astronomical Algorithms, ch. 49, with the main periodic terms):
# prints the Rust table for crates/teul-core/src/holidays.rs (FULL_MOONS). Run: python3 scripts/gen_full_moons.py
import math, datetime

def full_moon_jde(k):
    k = k + 0.5
    T = k / 1236.85
    jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T**2 - 0.000000150 * T**3 + 0.00000000073 * T**4
    E = 1 - 0.002516 * T - 0.0000074 * T**2
    M = math.radians(2.5534 + 29.10535670 * k - 0.0000014 * T**2)
    Mp = math.radians(201.5643 + 385.81693528 * k + 0.0107582 * T**2)
    F = math.radians(160.7108 + 390.67050284 * k - 0.0016118 * T**2)
    Om = math.radians(124.7746 - 1.56375588 * k + 0.0020672 * T**2)
    c = (-0.40614 * math.sin(Mp) + 0.17302 * E * math.sin(M) + 0.01614 * math.sin(2 * Mp) + 0.01043 * math.sin(2 * F)
         + 0.00734 * E * math.sin(Mp - M) - 0.00515 * E * math.sin(Mp + M) + 0.00209 * E * E * math.sin(2 * M)
         - 0.00111 * math.sin(Mp - 2 * F) - 0.00057 * math.sin(Mp + 2 * F) + 0.00056 * E * math.sin(2 * Mp + M)
         - 0.00042 * math.sin(3 * Mp) + 0.00042 * E * math.sin(M + 2 * F) + 0.00038 * E * math.sin(M - 2 * F)
         - 0.00024 * E * math.sin(2 * Mp - M) - 0.00017 * math.sin(Om))
    return jde + c

def kyiv(jde):
    utc = datetime.datetime(2000, 1, 1, 12) + datetime.timedelta(days=jde - 2451545.0 - 69 / 86400)
    # summer time from the last Sunday of March to the last Sunday of October
    y = utc.year
    def last_sunday(m):
        d = datetime.datetime(y, m, 31)
        return d - datetime.timedelta(days=(d.weekday() + 1) % 7)
    off = 3 if last_sunday(3).replace(hour=1) <= utc < last_sunday(10).replace(hour=1) else 2
    return utc + datetime.timedelta(hours=off)

by_year = {}
k = math.floor((2019.9 - 2000) * 12.3685)
while True:
    t = kyiv(full_moon_jde(k))
    k += 1
    if t.year < 2020:
        continue
    if t.year > 2060:
        break
    by_year.setdefault(t.year, []).append((t.month, t.day))
print("const FULL_MOONS: &[(i64, &[(u8, u8)])] = &[")
for y, ds in sorted(by_year.items()):
    print(f"    ({y}, &[{', '.join(f'({m}, {d})' for m, d in ds)}]),")
print("];")
