//! How the core holds up over a long save: a year of daily play with the real pack, then opening it,
//! a command and every view, timed. Run with
//! `cargo test --release -p teul-core --test perf -- --ignored --nocapture`.

use std::sync::Arc;
use std::time::Instant;

use teul_core::content::Content;
use teul_core::core::{Command, Core, NewWorld};
use teul_core::storage::{MemoryStorage, Storage};
use teul_core::time::WorldTime;

fn content() -> Arc<Content> {
    Arc::new(Content::from_packs(&[include_str!("../../../content/base/pack.json")]).expect("the base pack is valid"))
}

/// A day of play: out to the village, gathering, stations, a building or two, fishing, talking, home, the
/// pocket into the chest, cooking, moving furniture; the bills once a month. Commands that fail are skipped.
pub fn play(core: &mut Core<MemoryStorage>, content: &Content, days: u64) -> usize {
    let village = content.front.clone().unwrap_or_else(|| "village".into());
    let spots: Vec<String> = content.spot_location.iter().filter(|(_, l)| **l == village).map(|(s, _)| s.clone()).collect();
    let fishing: Vec<String> = content.fishing_location.iter().filter(|(_, l)| **l == village).map(|(s, _)| s.clone()).collect();
    let stations_at = |loc: &str| content.stations.values().filter(|s| s.location == loc).map(|s| s.id.clone()).collect::<Vec<_>>();
    let interiors: Vec<String> = content.locations.iter().filter(|(_, l)| l.inside.is_some()).map(|(id, _)| id.clone()).collect();
    let npcs: Vec<String> = content.npcs.keys().cloned().collect();
    let recipes: Vec<String> = content.recipes.keys().cloned().collect();
    let mut ok = 0usize;
    for d in 0..days {
        let mut t = d * 1440 + 8 * 60;
        let mut run = |core: &mut Core<MemoryStorage>, cmd: Command, t: &mut u64| {
            if core.apply_logged(WorldTime(*t), cmd).is_ok() {
                ok += 1;
            }
            *t += 1;
        };
        run(core, Command::Travel { to: village.clone() }, &mut t);
        for s in spots.iter().take(8) {
            run(core, Command::Gather { spot: s.clone() }, &mut t);
        }
        for st in stations_at(&village).into_iter().take(4) {
            run(core, Command::Use { station: st }, &mut t);
        }
        for k in 0..2 {
            let inside = &interiors[((d as usize) * 2 + k) % interiors.len()];
            run(core, Command::Travel { to: inside.clone() }, &mut t);
            for st in stations_at(inside).into_iter().take(2) {
                run(core, Command::Use { station: st }, &mut t);
            }
            run(core, Command::Travel { to: village.clone() }, &mut t);
        }
        for f in fishing.iter().take(1) {
            for _ in 0..3 {
                run(core, Command::Fish { place: f.clone() }, &mut t);
            }
        }
        for n in &npcs {
            run(core, Command::Talk { npc: n.clone() }, &mut t);
            run(core, Command::Deliver { npc: n.clone() }, &mut t);
        }
        if d % 30 == 2 {
            run(core, Command::Travel { to: "utility_in".into() }, &mut t);
            run(core, Command::PayAll, &mut t);
        }
        run(core, Command::Travel { to: "home".into() }, &mut t);
        let pocket = core.pocket_view();
        for (item, n) in pocket.items {
            run(core, Command::Stash { item, n }, &mut t);
        }
        for r in recipes.iter().take(2) {
            run(core, Command::Cook { recipe: r.clone() }, &mut t);
        }
        // a little rearranging
        let room = core.room_view();
        for (i, p) in room.placements.iter().take(6).enumerate() {
            let rot = ((d as usize + i) % 4) as u8;
            run(core, Command::Rotate { pid: p.pid, rot }, &mut t);
        }
        run(core, Command::SetSetting { key: "time_mode".into(), value: if d % 2 == 0 { "real".into() } else { "fixed".into() } }, &mut t);
    }
    ok
}

fn new_world(content: Arc<Content>) -> Core<MemoryStorage> {
    let mut storage = MemoryStorage::new();
    storage.meta_set(teul_core::core::META_SECRET, "123456789").unwrap();
    // the world's first day (days since 1970): a browser test sets it a year back from today, so the log is all in the past
    let epoch_day: i64 = std::env::var("TEUL_PERF_EPOCH_DAY").ok().and_then(|v| v.parse().ok()).unwrap_or(20_513);
    Core::bootstrap(storage, 1, NewWorld { seed: 7, epoch_unix_secs: epoch_day * 86_400 }, content).unwrap()
}

fn ms(t: Instant) -> f64 {
    t.elapsed().as_secs_f64() * 1000.0
}

#[test]
#[ignore]
fn a_year_of_play_opens_and_answers_fast() {
    let c = content();
    for days in [30u64, 180, 365] {
        let mut core = new_world(c.clone());
        let t0 = Instant::now();
        let inputs = play(&mut core, &c, days);
        let build = ms(t0);
        let end = WorldTime(days * 1440 + 20 * 60);
        let snap = core.latest_snapshot();
        let storage = core.into_storage();
        let all = storage.events_after(None).unwrap();
        let events = all.len();
        if let Ok(dir) = std::env::var("TEUL_PERF_DUMP") {
            std::fs::write(format!("{dir}/events-{days}.json"), serde_json::to_string(&all).unwrap()).unwrap();
            if let Some(snap) = &snap {
                let tail: Vec<_> = all.iter().filter(|e| e.sort_key() > snap.through).collect();
                std::fs::write(format!("{dir}/snapshot-{days}.json"), serde_json::to_string(snap).unwrap()).unwrap();
                std::fs::write(format!("{dir}/tail-{days}.json"), serde_json::to_string(&tail).unwrap()).unwrap();
                std::fs::write(format!("{dir}/covered-{days}.txt"), (all.len() - tail.len()).to_string()).unwrap();
            }
        }
        // open: as the shell does it at every start
        let t = Instant::now();
        let mut core = Core::open_with(storage, 1, c.clone()).unwrap();
        let open = ms(t);
        let integrity = core.integrity().clone();
        let mut timings: Vec<(&str, f64)> = Vec::new();
        macro_rules! time {
            ($name:expr, $e:expr) => {{
                let t = Instant::now();
                let v = $e;
                timings.push(($name, ms(t)));
                std::hint::black_box(v);
            }};
        }
        time!("life_view (first)", core.life_view(end));
        time!("life_view (again)", core.life_view(end));
        time!("life_view (+1 min)", core.life_view(WorldTime(end.0 + 1)));
        time!("room_view", core.room_view());
        time!("stations_view", core.stations_view(end));
        time!("pocket_view", core.pocket_view());
        time!("paper_view", core.paper_view(end));
        time!("daily_view", core.daily_view(end));
        time!("npc_view", core.npc_view(end));
        time!("shop_view", core.shop_view(end));
        time!("helps_view", core.helps_view(end));
        time!("bills_view", core.bills_view(end));
        time!("command", core.apply_logged(end, Command::SetSetting { key: "time_mode".into(), value: "real".into() }));
        println!(
            "{days:>3} days: {inputs} inputs, {events} events; build {build:.0} ms; OPEN {open:.1} ms (tampered {}, inputs {})",
            integrity.tampered, integrity.inputs
        );
        for (n, v) in timings {
            println!("    {n:<20} {v:>8.2} ms");
        }
    }
}
