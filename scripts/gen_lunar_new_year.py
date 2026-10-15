#!/usr/bin/env python3
"""The dates of the Lunar (Chinese) New Year, for holidays.rs (the core has no floats).

The new year falls on the day (Beijing time, UTC+8) of the second new moon after the December solstice, unless a
leap eleventh or twelfth month comes between (as in 2033): then the third. It always falls from 21 January to 20
February, so the new moon taken is the first one in that window after the solstice. New moons: Meeus, "Astronomical Algorithms",
ch. 49 (mean phase + the main periodic terms, good to a minute or two); the solstice from gen_solstices.py.
Prints a Rust table: (year, month, day).
Usage: python3 scripts/gen_lunar_new_year.py [from] [to]
"""
import math
import sys
from datetime import timedelta

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from gen_solstices import jde as season_jde, utc  # noqa: E402


def new_moon(k):
    t = k / 1236.85
    j = 2451550.09766 + 29.530588861 * k + 0.00015437 * t**2 - 0.000000150 * t**3 + 0.00000000073 * t**4
    e = 1 - 0.002516 * t - 0.0000074 * t**2
    m = math.radians(2.5534 + 29.10535670 * k - 0.0000014 * t**2)
    mp = math.radians(201.5643 + 385.81693528 * k + 0.0107582 * t**2 + 0.00001238 * t**3)
    f = math.radians(160.7108 + 390.67050284 * k - 0.0016118 * t**2)
    om = math.radians(124.7746 - 1.56375588 * k + 0.0020672 * t**2)
    j += (-0.40720 * math.sin(mp) + 0.17241 * e * math.sin(m) + 0.01608 * math.sin(2 * mp) + 0.01039 * math.sin(2 * f)
          + 0.00739 * e * math.sin(mp - m) - 0.00514 * e * math.sin(mp + m) + 0.00208 * e * e * math.sin(2 * m)
          - 0.00111 * math.sin(mp - 2 * f) - 0.00057 * math.sin(mp + 2 * f) + 0.00056 * e * math.sin(2 * mp + m)
          - 0.00042 * math.sin(3 * mp) + 0.00042 * e * math.sin(m + 2 * f) + 0.00038 * e * math.sin(m - 2 * f)
          - 0.00024 * e * math.sin(2 * mp - m) - 0.00017 * math.sin(om) - 0.00007 * math.sin(mp + 2 * m))
    return j


def beijing(j):
    return utc(j) + timedelta(hours=8)


def lunar_new_year(year):
    solstice = beijing(season_jde(year - 1, 3)).date()
    k = math.floor((year - 1 - 2000) * 12.3685 + 11)
    moons = []
    while len(moons) < 2 or moons[-1] < solstice.replace(year=year, month=1, day=21):
        d = beijing(new_moon(k)).date()
        if d > solstice:
            moons.append(d)
        k += 1
    return moons[-1]


if __name__ == "__main__":
    lo = int(sys.argv[1]) if len(sys.argv) > 1 else 2020
    hi = int(sys.argv[2]) if len(sys.argv) > 2 else 2060
    rows = [lunar_new_year(y) for y in range(lo, hi + 1)]
    for i in range(0, len(rows), 6):
        print("    " + " ".join(f"({d.year}, {d.month}, {d.day})," for d in rows[i:i + 6]))
