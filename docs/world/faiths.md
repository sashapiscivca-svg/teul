# Faith: the church, the temple, the sacred grove

[Українською](faiths.uk.md)

**In short.** The town has three places of faith. St Nicholas' Church (костел святого Миколая) is Catholic, with Mass on Sundays. The Temple of the Quiet Lotus (Храм Тихого Лотоса) is small and Buddhist in spirit, with no images of the Buddha or of saints. The Old Circle (Старе коло) in the forest is a pagan sanctuary with a wooden idol, where people gather at the full moon. In the temple and the church everyone sits and stands facing the altar.

## The church (`church_in`)

The altar is by the north wall, with pews in two rows, stained glass, an organ and a candle stand. Believers go to Mass on Sundays 9:20–11:00, and some of the elderly also on weekday evenings (`life.rs`). Stations: light a candle, listen to the organ. Church holidays are quiet dates in the calendar without town decorations.

## The Temple of the Quiet Lotus (`temple_in`, by the park)

- **Building:** red columns, a two-tiered roof with upturned eaves, a golden spire, coloured prayer flags, stone lanterns at the entrance, a bench.
- **Inside:**
  - a low altar beneath an eight-spoked wheel;
  - an incense burner;
  - offering tables;
  - cushions on straw mats, turned towards the altar;
  - a gong;
  - prayer wheels;
  - lotus lanterns and lotus scrolls.
- **Keeper:** Lina Tao (Ліна Тао), 6:00–20:00.
- **Offerings.** Bowls of fruit, rice and flowers appear on days with the `offerings` flag: at the full moon and on two or three more days a week, chosen by the world seed. On those days there are people in the temple during the day: two or three sit cross-legged on cushions, one stands by a table with palms together (`faiths.ts::templeFigures`).
- **Stations:**

| Station | What |
|---|---|
| `st.temple.buy_incense` | Take incense (3 coins) |
| `st.temple.incense` | Light incense |
| `st.temple.offer_fruit` | Leave an offering ("Let the heavy float away and the good come back") |
| `st.temple.offer_flowers` | Lay flowers |
| `st.temple.gong` | Strike the gong |
| `st.temple.wheels` | Turn the prayer wheels |

At the temple and grove stations the hero puts their palms together (the `pray` pose), and on a cushion sits cross-legged (the `lotus` pose).

## The Old Circle (forest, `grove_site`)

- **What is there:** a clearing east of the fire lookout tower. A four-faced oak idol, a ring of standing stones, a stone hearth, posts tied with ribbons, torches.
- **Full moon:**
  - a fire burns in the hearth (the `ritual_hearth_lit` prop with the `full_moon` flag) and the torches are lit;
  - from 20:00 to 1:00 nine people in linen shirts stand in a circle facing the fire, palms together, singing and slowly moving round (`riteFigures`);
  - the hero can join the circle (`st.grove.circle`, `days: "full_moon"`, 20–24).
- **Other stations:**
  - bow to the idol;
  - tie a wishing ribbon (ribbons are sold at the hardware store, «Господарчий»).

## Where in the code

- Content: `scripts/faiths_items.py`, `scripts/faiths_world.py`, `scripts/faiths.py`, the church in `interiors.py`, `town_items.py`.
- Core: `holidays::full_moon`, the `full_moon`/`offerings` flags in `town.rs::town_flags`, `days: "full_moon"` in `economy.rs`.
- Client: `app/src/faiths.ts`, the `pray`/`lotus` poses in `character.ts`, `seats.ts::sittingPose`, `FACE_ALTAR` in `game.ts`.
