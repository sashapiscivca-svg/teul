use teul_core::content::Content;

fn base() -> Content {
    Content::from_packs(&[include_str!("../../../content/base/pack.json")]).expect("the base pack is valid")
}

fn count(c: &Content, loc: &str, item: &str) -> usize {
    c.locations[loc].props.iter().filter(|p| p.item == item).count()
}

#[test]
fn a_big_wheat_field_with_wind_turbines_and_a_shelter_belt_round_it() {
    let c = base();
    let f = &c.locations["fields"];
    let wheat = count(&c, "fields", "wheat_a") + count(&c, "fields", "wheat_b");
    assert!(wheat * 4 >= 1200, "the field is big: {} cells of wheat", wheat * 4);
    assert!(count(&c, "fields", "wind_turbine") >= 5);
    // trees close to every side of the map, except where the road comes in
    let trees: Vec<_> = f.props.iter().filter(|p| p.item.starts_with("tree_")).collect();
    for (name, near) in [
        ("west", Box::new(|x: i32, _y: i32| x < 4) as Box<dyn Fn(i32, i32) -> bool>),
        ("east", Box::new(|x: i32, _y: i32| x >= 60)),
        ("north", Box::new(|_x: i32, y: i32| y < 4)),
        ("south", Box::new(|_x: i32, y: i32| y >= 44)),
    ] {
        assert!(trees.iter().filter(|p| near(p.x, p.y)).count() >= 12, "the belt is thin on the {name}");
    }
    assert!(f.exits.iter().any(|e| e.to == "village"));
}

#[test]
fn the_power_goes_from_the_turbines_along_wires_to_the_fenced_substation_and_the_streets() {
    let c = base();
    let f = &c.locations["fields"];
    let v = &c.locations["village"];
    // every turbine has a wire from its foot
    for t in f.props.iter().filter(|p| p.item == "wind_turbine") {
        let foot = |(x, y, _): (i32, i32, i32)| (x - t.x * 100 - 100).abs() < 100 && (y - t.y * 100 - 100).abs() < 100;
        assert!(f.wires.iter().any(|w| foot(w.a) || foot(w.b)), "the turbine at {},{} is not wired", t.x, t.y);
    }
    // the line leaves the field at its east edge and comes into the village at its west edge
    assert!(f.wires.iter().any(|w| w.b.0 == f.w * 100 || w.a.0 == f.w * 100));
    assert!(v.wires.iter().any(|w| w.a.0 == 0 || w.b.0 == 0));
    // the substation stands inside a fence with a gate, and wires come to it
    let sub = v.props.iter().find(|p| p.item == "substation").expect("a substation in the village");
    let fence = v.props.iter().filter(|p| p.item == "mesh_fence" || p.item == "mesh_gate").count();
    assert!(fence >= 16, "fenced all round: {fence}");
    let at_sub = |(x, y, _): (i32, i32, i32)| x >= sub.x * 100 && x <= (sub.x + 4) * 100 && y >= sub.y * 100 && y <= (sub.y + 3) * 100;
    assert!(v.wires.iter().filter(|w| at_sub(w.a) || at_sub(w.b)).count() >= 4);
    assert!(count(&c, "village", "power_pole") + count(&c, "village", "pole_transformer") >= 25, "poles along the streets");
    assert!(v.wires.len() >= 50);
}

#[test]
fn gas_pipes_come_up_out_of_the_ground_here_and_there() {
    let c = base();
    let risers = count(&c, "village", "gas_riser");
    assert!(risers >= 6 && risers % 2 == 0, "each run comes up and goes back down: {risers}");
    assert!(count(&c, "village", "gas_pipe") >= risers * 2);
    assert_eq!(count(&c, "village", "gas_cabinet"), 1);
}

#[test]
fn no_gas_pipe_stands_by_a_door() {
    let c = base();
    let v = &c.locations["village"];
    for p in v.props.iter().filter(|p| p.item.starts_with("gas_")) {
        for s in &v.sites {
            assert!((p.x - s.x).abs() > 2 || (p.y - s.y).abs() > 2, "{} at {},{} blocks the door of {}", p.item, p.x, p.y, s.id);
        }
    }
}
