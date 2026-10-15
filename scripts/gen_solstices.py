#!/usr/bin/env python3
"""The local dates (Kyiv time) of the equinoxes and solstices, for holidays.rs (the core has no floats).

Meeus, "Astronomical Algorithms", ch. 27: mean JDE + periodic terms, accurate to about a minute for 2000–3000.
ΔT ≈ 70 s. Kyiv keeps EET (UTC+2) and EEST (UTC+3) from the last Sunday of March 01:00 UTC to the last Sunday of
October 01:00 UTC. Prints a Rust table: (year, [March day, June day, September day, December day]).
Usage: python3 scripts/gen_solstices.py [from] [to]
"""
import math
import sys
from datetime import datetime, timedelta, timezone

MEAN = [
    (2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057),
    (2451716.56767, 365241.62603, 0.00325, 0.00888, -0.00030),
    (2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078),
    (2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032),
]
TERMS = [
    (485, 324.96, 1934.136), (203, 337.23, 32964.467), (199, 342.08, 20.186), (182, 27.85, 445267.112),
    (156, 73.14, 45036.886), (136, 171.52, 22518.443), (77, 222.54, 65928.934), (74, 296.72, 3034.906),
    (70, 243.58, 9037.513), (58, 119.81, 33718.147), (52, 297.17, 150.678), (50, 21.02, 2281.226),
    (45, 247.54, 29929.562), (44, 325.15, 31555.956), (29, 60.93, 4443.417), (18, 155.12, 67555.328),
    (17, 288.79, 4562.452), (16, 198.04, 62894.029), (14, 199.76, 31436.921), (12, 95.39, 14577.848),
    (12, 287.11, 31931.756), (12, 320.81, 34777.259), (9, 227.73, 1222.114), (8, 15.45, 16859.074),
]


def jde(year, k):
    y = (year - 2000) / 1000
    a, b, c, d, e = MEAN[k]
    j0 = a + b * y + c * y**2 + d * y**3 + e * y**4
    t = (j0 - 2451545.0) / 36525
    w = math.radians(35999.373 * t - 2.47)
    dl = 1 + 0.0334 * math.cos(w) + 0.0007 * math.cos(2 * w)
    s = sum(A * math.cos(math.radians(B + C * t)) for A, B, C in TERMS)
    return j0 + 0.00001 * s / dl


def utc(j):
    # JD 2440587.5 is 1970-01-01 00:00 UTC; ΔT ≈ 70 s turns dynamical time into UT
    return datetime(1970, 1, 1, tzinfo=timezone.utc) + timedelta(days=j - 2440587.5) - timedelta(seconds=70)


def last_sunday(year, month):
    d = datetime(year, month + 1, 1, tzinfo=timezone.utc) - timedelta(days=1) if month < 12 else datetime(year, 12, 31, tzinfo=timezone.utc)
    return d - timedelta(days=(d.weekday() + 1) % 7)


def kyiv(t):
    start = last_sunday(t.year, 3).replace(hour=1)
    end = last_sunday(t.year, 10).replace(hour=1)
    return t + timedelta(hours=3 if start <= t < end else 2)


def days(year):
    return [kyiv(utc(jde(year, k))) for k in range(4)]


if __name__ == "__main__":
    lo = int(sys.argv[1]) if len(sys.argv) > 1 else 2020
    hi = int(sys.argv[2]) if len(sys.argv) > 2 else 2060
    for y in range(lo, hi + 1):
        ds = days(y)
        print(f"    ({y}, [{', '.join(str(d.day) for d in ds)}]), // {' '.join(d.strftime('%m-%d %H:%M') for d in ds)}")
