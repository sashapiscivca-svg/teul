# The road: driving school, licence, cars, offences

[Українською](drive.uk.md)

**In short.**
- **Licence:** at the driving school there are lessons with an instructor, a theory exam and a practical exam, then a driving licence on your key ring.
- **Car:** at the garage (СТО, a service station) you buy a used car, fuel it and have it serviced.
- **Offences** punch holes in your licence coupon. A full coupon, or driving without a licence, means a night in the police station cell, and the newspaper writes about it.
- **Finds:** coins sometimes turn up on the road.

The core decides everything; input is recorded in the log.

## Driving school (`driving_in`)

- **Lessons:** four, one per day, when the instructor is in (`Lesson`).
- **Theory:** 5 questions of the day, 4 must be right (`Theory`).
- **Practical:** a route through town with checkpoints (`StartExam`/`EndExam`). One small mistake is forgiven; serious mistakes or giving up mean failing.
- **Result:** the `driver_licence` licence.

## The garage (`sto_in`)

- **Buying:** three used cars (650 / 1150 / 1700), `BuyCar`. The car waits in the lot next to the garage.
- **Service:** refuelling at the pump or from a jerry can (`Refuel`), oil, tyres, repairs (`Service`).
- **Wear:** the car wears with mileage (oil, tyres, dents). A broken car will not start (`CarBroken`).

## Driving

- **Route and traffic.** You drive along the town's roads together with other cars. The client takes road tiles from the map, not from coordinates. Pedestrians cross at zebra crossings.
- **A trip.** `StartDrive` → `Park`. Mileage is capped by the trip's duration, so you cannot spin up the odometer.
- **Cars face nose-first** (test `app/test/facing.test.ts`): bonnet, grille, headlights, red tail lights.
- **Offences** (`Violation`, seven kinds): speeding in town and near the school, not giving way to a pedestrian on a zebra crossing, driving on the pavement or the grass, hitting a fence or a prop, driving without a licence.
  - Whether anyone saw it is decided by the seed for each kind.
  - A noticed offence means a fine on the spot (`PayFine`) or a debt at the police station.
- **Coupon:** five holes; it is forgiven after 90 days.
- **The cell.** A full coupon or having no licence means a night in the police station cell (`Arrested`):
  - you are released at 7:00 if arrested in the evening or at night, otherwise after 3 hours;
  - the car is towed to the impound lot;
  - the licence is taken away for 3 days, and then both exams must be taken again.

  In the cell you cannot travel or take a taxi (`Jailed`), the screen is darker, and your cellmate talks.
- **Newspaper:** "Police Blotter", "Roads".

## Coins on the road

The core decides where (`road_coins`, from the seed and the day): rarely, a little, and each coin can be picked up only once (`PickCoin`); there are none at home. A coin glints, or a crumpled banknote lies there.

## Where in the code

- Core: `crates/teul-core/src/drive.rs` (`DriveState`, `driver_stories`, `road_coins`).
- Content: `scripts/driving_items.py`, `driving.py`, `driving_world.py` (zebra crossings and signs), buildings in `town_growth.py`.
- Client: `app/src/drive/rules.ts` (physics, watching for offences), `app/src/drive/desk.ts` (dialogues, the licence with its coupon), `game.ts` (`driveStep`, `roadMovers`, `checkJail`).
