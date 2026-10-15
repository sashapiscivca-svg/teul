use serde::{Deserialize, Serialize};

pub const MINUTES_PER_DAY: u64 = 1440;
pub const DAYS_PER_SEASON: u64 = 28;
pub const SEASONS_PER_YEAR: u64 = 4;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct WorldTime(pub u64);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Season {
    Spring,
    Summer,
    Autumn,
    Winter,
}

impl WorldTime {
    pub fn day(self) -> u64 {
        self.0 / MINUTES_PER_DAY
    }

    pub fn minute_of_day(self) -> u64 {
        self.0 % MINUTES_PER_DAY
    }



}

/// The real calendar the world lives by: seasons follow the months (spring from 1 March, summer from 1 June,
/// autumn from 1 September, winter from 1 December), not a game clock. It knows the date of the world's first
/// day; integer arithmetic only, so it is the same everywhere.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Calendar {
    /// Days since 1970-01-01 of the world's first (local) day.
    pub first_day: i64,
}

/// (year, month 1..=12, day 1..=31) of a day counted from 1970-01-01 (Howard Hinnant's civil_from_days).
pub fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// Days from 1970-01-01 to a date (the inverse of `civil_from_days`).
pub fn days_from_civil(y: i64, m: u32, d: u32) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = i64::from(if m > 2 { m - 3 } else { m + 9 });
    let doy = (153 * mp + 2) / 5 + i64::from(d) - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

impl Calendar {
    /// From the world's epoch: the Unix time of its first local midnight. Its local noon falls on the same UTC
    /// date in any time zone within twelve hours of Greenwich, so the date is right without knowing the zone.
    pub fn from_epoch(epoch_unix_secs: i64) -> Self {
        Calendar { first_day: (epoch_unix_secs + 43_200).div_euclid(86_400) }
    }

    /// The real date of a world time, as days since 1970-01-01 (for `holidays::day_info`).
    pub fn date(self, t: WorldTime) -> i64 {
        self.first_day + t.day() as i64
    }

    /// The calendar date of `t`: (year, month 1..=12, day 1..=31).
    pub fn ymd(self, t: WorldTime) -> (i64, u32, u32) {
        civil_from_days(self.date(t))
    }

    /// Months counted from year 0 (year * 12 + month - 1): consecutive months differ by one.
    pub fn month_index(self, t: WorldTime) -> i64 {
        let (y, m, _) = self.ymd(t);
        y * 12 + i64::from(m) - 1
    }

    pub fn season(self, t: WorldTime) -> Season {
        let (_, m, _) = civil_from_days(self.date(t));
        match m {
            3..=5 => Season::Spring,
            6..=8 => Season::Summer,
            9..=11 => Season::Autumn,
            _ => Season::Winter,
        }
    }

    /// The first day of the season `t` falls in, and the first day of the next one.
    fn season_bounds(self, t: WorldTime) -> (i64, i64) {
        let (y, m, _) = civil_from_days(self.date(t));
        let (sy, sm) = match m {
            3..=5 => (y, 3),
            6..=8 => (y, 6),
            9..=11 => (y, 9),
            12 => (y, 12),
            _ => (y - 1, 12),
        };
        let start = days_from_civil(sy, sm, 1);
        let end = if sm == 12 { days_from_civil(sy + 1, 3, 1) } else { days_from_civil(sy, sm + 3, 1) };
        (start, end)
    }

    pub fn day_of_season(self, t: WorldTime) -> u64 {
        (self.date(t) - self.season_bounds(t).0) as u64
    }

    /// Which quarter of its season `t` is in, 0..=3 (early, mid, late...).
    pub fn phase(self, t: WorldTime) -> u8 {
        let (start, end) = self.season_bounds(t);
        (((self.date(t) - start) * 4) / (end - start)).clamp(0, 3) as u8
    }

    /// Whole years since the world's first day.
    pub fn year(self, t: WorldTime) -> u64 {
        t.day() / 365
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BeforeEpoch;

/// Converts shell-supplied Unix seconds into world minutes. The core never reads a clock itself.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorldClock {
    pub epoch_unix_secs: i64,
}

impl WorldClock {
    pub fn world_time(&self, unix_secs: i64) -> Result<WorldTime, BeforeEpoch> {
        let delta = unix_secs.checked_sub(self.epoch_unix_secs).ok_or(BeforeEpoch)?;
        if delta < 0 {
            return Err(BeforeEpoch);
        }
        Ok(WorldTime(delta as u64 / 60))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Local midnight in Kyiv (UTC+3 in October) of a date, as the shell gives it.
    fn kyiv_midnight(days_since_1970: i64) -> i64 {
        days_since_1970 * 86_400 - 3 * 3_600
    }

    #[test]
    fn the_season_is_the_real_one() {
        // 2026-10-10 is day 20_736 since 1970-01-01
        let cal = Calendar::from_epoch(kyiv_midnight(20_736));
        assert_eq!(cal.season(WorldTime(0)), Season::Autumn);
        // 2026-10-10 is the 40th day of autumn (from 1 September): its second week of four
        assert_eq!(cal.day_of_season(WorldTime(0)), 39);
        assert_eq!(cal.phase(WorldTime(0)), 1);
        // 52 days on: 2026-12-01, winter's first day
        assert_eq!(cal.season(WorldTime(51 * MINUTES_PER_DAY)), Season::Autumn);
        assert_eq!(cal.season(WorldTime(52 * MINUTES_PER_DAY)), Season::Winter);
        assert_eq!(cal.day_of_season(WorldTime(52 * MINUTES_PER_DAY)), 0);
        // 2027-02-28 is still winter, 2027-03-01 is spring
        assert_eq!(cal.season(WorldTime(141 * MINUTES_PER_DAY)), Season::Winter);
        assert_eq!(cal.season(WorldTime(142 * MINUTES_PER_DAY)), Season::Spring);
        assert_eq!(cal.phase(WorldTime(141 * MINUTES_PER_DAY)), 3);
    }

    #[test]
    fn a_year_passes_with_the_real_one() {
        let cal = Calendar::from_epoch(kyiv_midnight(20_736));
        assert_eq!(cal.year(WorldTime(364 * MINUTES_PER_DAY)), 0);
        assert_eq!(cal.year(WorldTime(365 * MINUTES_PER_DAY)), 1);
    }

    #[test]
    fn far_time_zones_keep_the_local_date() {
        // local midnight of 2026-06-01 at UTC+12 and at UTC-11
        assert_eq!(Calendar::from_epoch(20_605 * 86_400 - 12 * 3_600).season(WorldTime(0)), Season::Summer);
        assert_eq!(Calendar::from_epoch(20_605 * 86_400 + 11 * 3_600).season(WorldTime(0)), Season::Summer);
    }

    #[test]
    fn splits_a_timestamp_into_day_and_minute() {
        let t = WorldTime(MINUTES_PER_DAY * 30 + 125);
        assert_eq!(t.day(), 30);
        assert_eq!(t.minute_of_day(), 125);
    }

    #[test]
    fn dates_go_there_and_back() {
        for z in [-1_000_000, -1, 0, 1, 20_736, 59, 60, 11_016, 2_932_896] {
            let (y, m, d) = civil_from_days(z);
            assert_eq!(days_from_civil(y, m, d), z, "{z}");
        }
        assert_eq!(civil_from_days(20_736), (2026, 10, 10));
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(11_016), (2000, 2, 29));
    }

    #[test]
    fn clock_converts_unix_seconds_to_world_minutes() {
        let clock = WorldClock { epoch_unix_secs: 1_000 };
        assert_eq!(clock.world_time(1_000), Ok(WorldTime(0)));
        assert_eq!(clock.world_time(1_000 + 125), Ok(WorldTime(2)));
    }

    #[test]
    fn clock_rejects_times_before_the_epoch() {
        let clock = WorldClock { epoch_unix_secs: 1_000 };
        assert_eq!(clock.world_time(999), Err(BeforeEpoch));
        assert_eq!(clock.world_time(i64::MIN), Err(BeforeEpoch));
    }
}
