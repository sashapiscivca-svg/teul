use teul_core::content::{Content, Layer};
use teul_core::unlock::Unlock;

fn base() -> Content {
    Content::from_packs(&[include_str!("../../../content/base/pack.json")]).expect("the base pack is valid")
}

#[test]
fn the_base_pack_loads_and_is_rich_enough_for_a_first_playtest() {
    let c = base();
    assert!(c.items.len() >= 36, "got {}", c.items.len());
    let cats: std::collections::BTreeSet<_> = c.items.values().map(|i| i.category.as_str()).collect();
    for cat in ["seating", "tables", "storage", "lighting", "decor", "plants", "rugs", "wall"] {
        assert!(cats.contains(cat), "missing category {cat}");
    }
    assert!(c.styles.values().filter(|s| s.kind == "floor").count() >= 3);
    assert!(c.styles.values().filter(|s| s.kind == "wall").count() >= 3);
    assert!(c.expansions.len() >= 3);
    assert!(c.start_room.w >= 5);
}

#[test]
fn the_base_pack_mixes_free_bought_action_and_token_items() {
    let c = base();
    let has = |f: &dyn Fn(&Unlock) -> bool| c.items.values().any(|i| f(&i.acquire));
    assert!(has(&|u| matches!(u, Unlock::Free)));
    assert!(has(&|u| matches!(u, Unlock::Coins(_))));
    assert!(has(&|u| matches!(u, Unlock::Action { .. })));
    // no token prices any more: nothing grants tokens (the home pays nothing), so nothing may cost them
    fn tokens(u: &Unlock) -> bool {
        match u {
            Unlock::Token { .. } => true,
            Unlock::All(v) | Unlock::Any(v) => v.iter().any(tokens),
            _ => false,
        }
    }
    assert!(!c.items.values().any(|i| tokens(&i.acquire)), "a token price could never be paid");
}

#[test]
fn every_item_has_a_model_and_the_layers_are_all_represented() {
    let c = base();
    assert!(c.items.values().all(|i| !i.model.is_empty()), "every item needs a visual model");
    assert!(c.items.values().any(|i| i.rules.provides_surface));
    for layer in [Layer::Floor, Layer::Wall, Layer::Surface, Layer::Rug] {
        assert!(c.items.values().any(|i| i.layer == layer), "no item on layer {layer:?}");
    }
}

#[test]
fn every_gate_in_the_pack_can_actually_be_reached() {
    // An item gated behind an action must be able to perform that action on something obtainable
    // without that very item, otherwise the gate is a dead end.
    let c = base();
    fn gates(u: &Unlock, out: &mut Vec<String>) {
        match u {
            Unlock::Action { kind, .. } => out.push(kind.clone()),
            Unlock::All(v) | Unlock::Any(v) => v.iter().for_each(|x| gates(x, out)),
            _ => {}
        }
    }
    for item in c.items.values() {
        let mut needed = Vec::new();
        gates(&item.acquire, &mut needed);
        for action in needed {
            let reachable = c.items.values().any(|other| {
                other.id != item.id && other.actions.contains(&action) && !matches!(other.acquire, Unlock::Action { ref kind, .. } if *kind == action)
            });
            assert!(reachable, "'{}' needs action '{action}' but nothing obtainable provides it", item.id);
        }
    }
}

#[test]
fn a_new_player_can_afford_the_first_purchases_through_play() {
    let c = base();
    assert!(c.start_coins >= 100, "a first purchase should be possible at once");
    // the home is a place to live, not to earn: nothing done in one's own room pays (no coins, no tokens);
    // coins come from helping the town's people
    assert!(c.rewards.is_empty(), "everyday things at home must not pay: {:?}", c.rewards.iter().map(|r| &r.action).collect::<Vec<_>>());
}

#[test]
fn a_first_session_works_end_to_end_with_the_real_pack() {
    use std::sync::Arc;
    use teul_core::core::{Command, Core, NewWorld};
    use teul_core::event::EventKind;
    use teul_core::storage::MemoryStorage;
    use teul_core::time::WorldTime;

    let mut c = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 1, epoch_unix_secs: 0 }, Arc::new(base())).unwrap();
    let mut minute = 0u64;
    let mut now = || {
        minute += 1;
        WorldTime(minute)
    };
    assert_eq!(c.wallet().coins, 300);

    c.apply_all(now(), Command::Acquire { item: "fern".into() }).unwrap();
    let placed = c.apply_all(now(), Command::Place { item: "fern".into(), x: 0, y: 0, rot: 0, wall: None, on: None }).unwrap();
    let fern = match placed[0].kind {
        EventKind::Placed { pid, .. } => pid,
        _ => unreachable!(),
    };
    let before = c.wallet().coins;
    for _ in 0..5 {
        c.apply_all(now(), Command::Perform { action: "water_plant".into(), pid: Some(fern) }).unwrap();
    }
    assert_eq!(c.wallet().coins, before, "watering a plant pays nothing");

    c.apply_all(now(), Command::Acquire { item: "sofa3".into() }).unwrap();
    assert_eq!(c.wallet().coins, before - 180);
    c.apply_all(now(), Command::Place { item: "sofa3".into(), x: 1, y: 0, rot: 0, wall: None, on: None }).unwrap();
    c.apply_all(now(), Command::Recolor { pid: 1, slot: "body".into(), color: "#d9534f".into() }).unwrap();

    let shop = c.shop_view(now());
    assert!(shop.iter().any(|e| e.id == "bean_bag"), "the shop lists the catalog");
    assert_eq!(c.room_view().placements.len(), 2);
}


#[test]
fn every_location_is_coherent_props_fit_and_places_are_reachable() {
    let c = base();
    assert!(c.front.is_some(), "the front door opens somewhere");
    assert!(c.locations.len() >= 2, "a village and a forest at least");
    // two props may share cells when the town never shows them together: stages of one project and what it
    // builds (`project:x:stage1`, `project:x:done`), or the old thing and what replaces it (flag / unflag)
    let apart = |a: &teul_core::npc::LocationProp, b: &teul_core::npc::LocationProp| {
        let project = |f: &Option<String>| f.as_deref().and_then(|f| f.strip_prefix("project:")).map(|f| f.split(':').next().unwrap_or("").to_string());
        // the stages of one building site, the wear of one building, the stops of the ice-cream cart (growth.rs)
        let grown = |f: &Option<String>| {
            let f = f.as_deref()?;
            let mut it = f.splitn(3, ':');
            match (it.next()?, it.next()?) {
                ("grow", id) => Some(format!("grow:{id}")),
                ("wear", id) => Some(format!("wear:{id}")),
                ("cart", _) => Some("cart".to_string()),
                _ => None,
            }
        };
        let worn = |base: &Option<String>, v: &Option<String>| match (base.as_deref().and_then(|f| f.strip_prefix("worn:")), v.as_deref().and_then(|f| f.strip_prefix("wear:"))) {
            (Some(id), Some(w)) => w.starts_with(&format!("{id}:")),
            _ => false,
        };
        (a.flag.is_some() && a.flag == b.unflag)
            || (b.flag.is_some() && b.flag == a.unflag)
            || (a.flag != b.flag && project(&a.flag).is_some() && project(&a.flag) == project(&b.flag))
            || (a.flag != b.flag && grown(&a.flag).is_some() && grown(&a.flag) == grown(&b.flag))
            || worn(&a.unflag, &b.flag)
            || worn(&b.unflag, &a.flag)
    };
    for v in c.locations.values() {
        let mut taken: std::collections::BTreeMap<(i32, i32), Vec<&teul_core::npc::LocationProp>> = std::collections::BTreeMap::new();
        for p in &v.props {
            let def = &c.items[&p.item];
            if let Some(side) = p.wall {
                // a thing on a wall runs along the room's own wall
                use teul_core::room::WallSide;
                let (along_x, edge_ok) = match side {
                    WallSide::North => (true, p.y == 0),
                    WallSide::South => (true, p.y == v.h - 1),
                    WallSide::West => (false, p.x == 0),
                    WallSide::East => (false, p.x == v.w - 1),
                };
                let end = if along_x { p.x + def.footprint.w as i32 } else { p.y + def.footprint.w as i32 };
                assert!(edge_ok && end <= if along_x { v.w } else { v.h }, "{} is not on a wall of {}", p.item, v.id);
                continue;
            }
            let (w, d) = if p.rot % 2 == 1 { (def.footprint.d, def.footprint.w) } else { (def.footprint.w, def.footprint.d) };
            for dx in 0..w as i32 {
                for dy in 0..d as i32 {
                    let cell = (p.x + dx, p.y + dy);
                    assert!(cell.0 >= 0 && cell.1 >= 0 && cell.0 < v.w && cell.1 < v.h, "{} sticks out of {}", p.item, v.id);
                    if def.layer != Layer::Rug {
                        let here = taken.entry(cell).or_default();
                        if let Some(other) = here.iter().find(|o| !apart(o, p)) {
                            panic!("{}: {} and {} overlap at {cell:?}", v.id, p.item, other.item);
                        }
                        here.push(p);
                    }
                }
            }
        }
        let tile = |x: i32, y: i32| v.legend[&v.tiles[y as usize].chars().nth(x as usize).unwrap().to_string()].clone();
        // no road, sidewalk, path or deck runs under a building
        for p in &v.props {
            let def = &c.items[&p.item];
            // (a house on piles or a boat stands on the water as it should)
            if def.category != "village" || def.footprint.w * def.footprint.d < 6 || def.tags.iter().any(|t| t == "afloat") {
                continue;
            }
            let (w, d) = if p.rot % 2 == 1 { (def.footprint.d, def.footprint.w) } else { (def.footprint.w, def.footprint.d) };
            for dx in 0..w as i32 {
                for dy in 0..d as i32 {
                    let t = tile(p.x + dx, p.y + dy);
                    assert!(!["floor.cobble", "floor.plaza", "floor.dirt", "floor.deck", "floor.gravel", "floor.water"].contains(&t.as_str()), "{}: {} stands on {t}", v.id, p.item);
                }
            }
        }
        for place in &v.places {
            let free = (place.x..place.x + place.w)
                .flat_map(|x| (place.y..place.y + place.h).map(move |y| (x, y)))
                .filter(|&(x, y)| !taken.contains_key(&(x, y)) && tile(x, y) != "floor.water")
                .count();
            assert!(free > 0, "place {} has nowhere to stand", place.id);
        }
        if let Some(entry) = v.entry {
            assert!(!taken.contains_key(&entry), "the entry is blocked");
        }
        for exit in &v.exits {
            let back = &c.locations[&exit.to];
            // a room inside a building is entered through the building's door
            assert!(back.exits.iter().any(|e| e.to == v.id) || v.inside.is_some(), "the way from {} to {} has no way back", v.id, exit.to);
        }
        for &post in &v.posts {
            assert!(!taken.contains_key(&post), "{}: a post at {post:?} is under {}", v.id, taken[&post][0].item);
        }
    }
    // every public building can be entered, and each has its room furnished and its people's places
    for site in c.sites.values().filter(|s| s.building.is_some() && !["home", "farm", "sawmill"].contains(&s.kind.as_str())) {
        let room = c.locations.values().find(|l| l.inside.as_deref() == Some(site.id.as_str()));
        let room = room.unwrap_or_else(|| panic!("{} cannot be entered", site.id));
        assert!(room.props.len() >= 10, "{} is bare inside", room.id);
        assert!(room.posts.len() >= 4, "{} has too few places for its people", room.id);
        assert!(room.exits.iter().any(|e| e.at == (site.x, site.y)), "{} does not lead back out to its door", room.id);
    }
    assert!(c.npcs.len() >= 8);
    for npc in c.npcs.values() {
        assert!(npc.lines.len() >= 12, "{} has too few lines", npc.id);
        assert!(npc.gifts.len() >= 2, "{} gives too little back", npc.id);
        assert!(!npc.chatter.is_empty() && !npc.greet.is_empty(), "{} has nothing to say to others", npc.id);
    }
}

#[test]
fn everything_in_the_album_and_every_request_can_be_found_somewhere() {
    let c = base();
    let mut findable = std::collections::BTreeSet::new();
    for s in c.spots.values() {
        findable.extend(s.gives.iter().map(|g| g.item.clone()));
    }
    for f in c.fishing.values() {
        findable.extend(f.fish.iter().map(|g| g.item.clone()));
    }
    // places to use and help also bring things into the world
    for st in c.stations.values() {
        findable.extend(st.gives.iter().map(|(i, _)| i.clone()));
    }
    for h in c.helps.values() {
        findable.extend(h.gives.iter().cloned());
    }
    for col in c.collections.values() {
        for i in &col.items {
            assert!(findable.contains(i), "{} of {} is nowhere to be found", i, col.id);
        }
    }
    for npc in c.npcs.values() {
        assert!(npc.asks.len() >= 2, "{} asks for nothing", npc.id);
        let asks = npc.asks.iter().chain(npc.story.iter().filter_map(|ch| ch.ask.as_ref()));
        for ask in asks {
            for (key, _) in &ask.items {
                let ok = findable.iter().any(|i| teul_core::daily::answers(&c, i, key)) || c.items.get(key).is_some_and(|d| !d.hidden);
                assert!(ok, "{} asks for {key}, which cannot be had", npc.id);
            }
        }
    }
    assert!(c.paper.len() >= 15);
}

#[test]
fn the_town_has_work_and_the_garden_can_be_sown() {
    let c = base();
    assert!(c.work.len() >= 6, "shifts at the town's places");
    assert!(c.plants.len() >= 10, "a garden worth sowing");
    for p in c.plants.values() {
        assert!(c.stations.values().any(|s| s.gives.iter().any(|(g, _)| *g == p.seed)), "the seed of '{}' can be bought somewhere", p.id);
    }
    for w in c.work.values() {
        assert!(w.employer.as_ref().is_some_and(|e| c.residents.contains_key(e)), "'{}' is run by someone who lives here", w.id);
    }
    assert!(c.items.values().any(|i| i.tags.iter().any(|t| t == "plot")), "something to plant in");
    assert!(c.items.values().any(|i| i.tags.iter().any(|t| t == "instrument")), "something to play");
    assert!(c.items.values().any(|i| i.tags.iter().any(|t| t == "easel")), "something to paint at");
}

#[test]
fn the_town_streets_are_one_network_and_its_landmarks_are_on_the_map() {
    let c = base();
    let v = &c.locations["village"];
    let road: std::collections::BTreeSet<(i32, i32)> =
        (0..v.h).flat_map(|y| (0..v.w).map(move |x| (x, y))).filter(|(x, y)| v.legend[&v.tiles[*y as usize].chars().nth(*x as usize).unwrap().to_string()] == "floor.cobble").collect();
    let start = *road.iter().next().expect("the town has streets");
    let mut seen = std::collections::BTreeSet::from([start]);
    let mut todo = vec![start];
    while let Some((x, y)) = todo.pop() {
        for n in [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)] {
            if road.contains(&n) && seen.insert(n) {
                todo.push(n);
            }
        }
    }
    let lost: Vec<_> = road.difference(&seen).take(5).collect();
    assert!(lost.is_empty(), "paving cut off from the streets: {lost:?}");
    // the named places everything else stands by
    for id in ["square_centre", "main_street", "park", "lake", "pier", "forest_edge", "to_fields", "to_cemetery", "outskirts_street", "door:donut_site", "door:sto_site", "door:driving_site", "door:hardware_site", "door:church_site"] {
        let l = v.landmark(id).unwrap_or_else(|| panic!("no landmark {id}"));
        assert!(l.x >= 0 && l.y >= 0 && l.x + l.w <= v.w && l.y + l.h <= v.h, "{id} is off the map");
    }
    // the water tower stands on the factories' edge, not in the middle of the town
    let tower = &c.sites["water_tower_site"];
    assert!(tower.x >= 56, "the water tower is back in the centre: {}", tower.x);
}

#[test]
fn the_forest_circle_gathers_only_on_the_full_moon_night_and_the_temple_is_open_to_all() {
    use teul_core::core::{Command, Core, NewWorld};
    use teul_core::storage::MemoryStorage;
    use teul_core::time::WorldTime;
    let content = std::sync::Arc::new(base());
    // a world that began on 2026-10-10: 26 October is a full moon (day 16), 18 October is not (day 8)
    let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: 1_760_054_400 }, content).unwrap();
    let at = |day: u64, minute: u64| WorldTime(day * 1440 + minute);
    let first = core.calendar().date(at(0, 0));
    let full = (teul_core::time::days_from_civil(2026, 10, 26) - first) as u64;
    core.apply_all(at(full, 18 * 60), Command::Travel { to: "forest".into() }).unwrap();
    let circle = |c: &Core<MemoryStorage>, t| c.stations_view(t).into_iter().find(|s| s.id == "st.grove.circle").map(|s| s.ok);
    assert_eq!(circle(&core, at(full, 21 * 60)), Some(true), "the circle on the full-moon night");
    assert_eq!(circle(&core, at(full, 12 * 60)), Some(false), "not at noon");
    assert_eq!(circle(&core, at(full - 8, 21 * 60)), Some(false), "not on an ordinary night");
    assert!(core.content().locations.contains_key("temple_in"));
    assert!(core.content().residents.values().any(|r| r.job.as_ref().is_some_and(|j| j.0 == "temple_site")));
}

#[test]
fn the_taxi_offers_each_place_once_and_says_which_are_shut() {
    use teul_core::core::{Core, NewWorld};
    use teul_core::storage::MemoryStorage;
    use teul_core::time::WorldTime;
    let core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: 1_760_054_400 }, std::sync::Arc::new(base())).unwrap();
    let now = WorldTime(12 * 60);
    let dests = core.taxi_dests(now);
    let mut seen = std::collections::BTreeSet::new();
    for d in &dests {
        assert!(seen.insert((d.location.clone(), d.name.clone())), "{} in {} offered twice", d.name, d.location);
    }
    // a place still shut (the hippodrome waits for the player's help) is told so, in the world's words
    let shut: Vec<_> = dests.iter().filter_map(|d| core.taxi_shut(d, now).map(|why| (d.location.clone(), why))).collect();
    assert!(shut.iter().any(|(l, why)| l == "hippodrome" && !why.is_empty()), "{shut:?}");
    assert!(dests.iter().filter(|d| d.location == "village").all(|d| core.taxi_shut(d, now).is_none()));
}
