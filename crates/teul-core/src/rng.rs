//! Stateless, random-access randomness. Every value is a pure function of its inputs,
//! so any moment of the world can be computed without replaying earlier draws.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Domain(pub u32);

fn mix(z: u64) -> u64 {
    let mut z = z.wrapping_add(0x9E37_79B9_7F4A_7C15);
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^ (z >> 31)
}

pub fn rand(seed: u64, domain: Domain, id: u64, tick: u64) -> u64 {
    let h = mix(seed);
    let h = mix(h ^ u64::from(domain.0));
    let h = mix(h ^ id);
    mix(h ^ tick)
}

/// Uniform value in `0..n` without modulo bias. `n` must be non-zero.
pub fn rand_below(seed: u64, domain: Domain, id: u64, tick: u64, n: u64) -> u64 {
    assert!(n > 0, "rand_below requires n > 0");
    ((u128::from(rand(seed, domain, id, tick)) * u128::from(n)) >> 64) as u64
}

/// True with probability `permille / 1000`.
pub fn chance_permille(seed: u64, domain: Domain, id: u64, tick: u64, permille: u64) -> bool {
    rand_below(seed, domain, id, tick, 1000) < permille
}

/// FNV-1a, used for state fingerprints in determinism tests.
pub fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in bytes {
        h ^= u64::from(*b);
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    h
}

#[cfg(test)]
mod tests {
    use super::*;

    const D: Domain = Domain(7);

    #[test]
    fn same_inputs_give_same_output() {
        assert_eq!(rand(42, D, 1, 100), rand(42, D, 1, 100));
    }

    #[test]
    fn every_input_changes_the_output() {
        let base = rand(42, D, 1, 100);
        assert_ne!(base, rand(43, D, 1, 100));
        assert_ne!(base, rand(42, Domain(8), 1, 100));
        assert_ne!(base, rand(42, D, 2, 100));
        assert_ne!(base, rand(42, D, 1, 101));
    }

    #[test]
    fn golden_values_never_change() {
        // If this fails, the generated world has changed. That needs a new world_version.
        assert_eq!(rand(0, Domain(0), 0, 0), GOLDEN_0);
        assert_eq!(rand(42, D, 1, 100), GOLDEN_1);
    }

    #[test]
    fn rand_below_stays_in_range_and_covers_it() {
        let mut seen = [0u32; 10];
        for tick in 0..10_000 {
            let v = rand_below(1, D, 0, tick, 10);
            assert!(v < 10);
            seen[v as usize] += 1;
        }
        assert!(seen.iter().all(|&c| (800..1200).contains(&c)), "{seen:?}");
    }

    #[test]
    fn chance_permille_edges() {
        assert!((0..1000).all(|t| !chance_permille(1, D, 0, t, 0)));
        assert!((0..1000).all(|t| chance_permille(1, D, 0, t, 1000)));
    }

    #[test]
    #[should_panic]
    fn rand_below_rejects_zero() {
        rand_below(1, D, 0, 0, 0);
    }

    #[test]
    fn fnv_matches_known_vectors() {
        assert_eq!(fnv1a64(b""), 0xcbf2_9ce4_8422_2325);
        assert_eq!(fnv1a64(b"a"), 0xaf63_dc4c_8601_ec8c);
    }

    #[test]
    fn golden_derived_draws_never_change() {
        // Derived draws feed every generated schedule; changing how `rand` is mapped onto a range
        // or a probability changes the world and needs a new world_version.
        let below: Vec<u64> = (0..8).map(|tick| rand_below(42, D, 1, tick, 10)).collect();
        assert_eq!(below, [3, 3, 1, 6, 0, 0, 4, 8]);
        let chances: Vec<bool> = (0..8).map(|tick| chance_permille(42, D, 1, tick, 500)).collect();
        assert_eq!(chances, [true, true, true, false, true, true, true, false]);
    }

    const GOLDEN_0: u64 = 2391539541053276776;
    const GOLDEN_1: u64 = 10886820840780275425;
}
