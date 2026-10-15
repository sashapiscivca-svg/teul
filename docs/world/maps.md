# Maps

[Українською](maps.uk.md)

**In short.** Maps («Мапи») is an app on the hero's own smartphone and on the home computer, like ordinary maps on a phone rather than a game map. It is a clean street map of Lypove (Липове) and its surroundings, drawn from the same world data the town is made of: cells, buildings, landmarks and the roads between maps. It has street names, place pins, the hero's blue dot, search, a place card with photos, a description and opening hours by day, a walking route, the taxi fare and a taxi call, and layers: traffic, weather and today's events. Everything works offline, because it is all local data.

## What's on the map

- **Overview** (`maps/model.ts::layoutAtlas`). The 74×114 town lies in the centre. Each outdoor map sits by the edge its road leads from: the forest to the north, the field to the west, the farm, dump and cemetery to the east, the racecourse beyond the field, the vineyard beyond the farm. Maps do not overlap, and the roads between them are drawn. Rooms, the cave and the rift worlds are not on the overview. A room is shown by the door of its building, the home by the door of the current address.
- **Look.** Floors have calm colours: the roadway is white with a kerb, pavements are light, grass and parks are green, water is light blue. Buildings are grey, forest trees are soft green crowns.
- **Named streets** (`scripts/map_streets.py`). Holovna, Sadova and Novobudovna had names before. The other roadways got landmarks `<name>_street`: Lypova, Shkilna, Richkova, Nova, Lisova (leads to the forest), Rynkova and Naberezhna. The name is written along the street where the street is on screen.
- **Pins.** The colour and icon of a pin depend on the kind of place: food, shops, health, leisure, cinema, faith, services. From far away only the main pins are visible, closer in — all of them, and closer still the names appear. Labels never overlap.
- **The blue dot** is the hero, and a beam shows where they are heading.
- **My home.** Other people's homes are not on the map, but your own is: a turquoise pin with a house icon by the door of the current address (`myHomePlace`). It carries the home's name if one was given in Home Plan («План дому»), is found by searching for "home", and the taxi from its card takes you home. The same is on the paper map.
- **Controls.** Drag the map with a finger, pinch with two fingers to zoom. With a mouse, drag and turn the wheel; a double click zooms in. There are "+", "−" and "Where am I" buttons.

## Search and the place card

- **Search** (`placeIndex`, `search`) looks by name, by kind of place and by synonyms: "coffee" finds the café, "pharmacy" the hospital, "post" or "laptop" the post office. It also knows what is sold inside (the labels of the room's stations), the streets, the lake and the park, the outskirts and people: a person's name leads to the place where they work.
- **Card.** It shows the name and kind of the place, "Open" or "Closed" and when that will change: "closes at 20:00", "opens tomorrow at 08:00", "opens on Monday at 08:00" (`openStatus`, `nextChange`). The hours come from whoever works there: from the first shift of the day to the last, with a night shift running past midnight. Where nobody works, as in the park, it is always open.
- **Photos.** Below the status there are a few real shots of the place today: "Outside" in daylight, "Inside" with the people who work there (if the building has a room), and "Evening" with the lights on. They are taken by the same camera as the newspaper photos (`paperphoto.ts`), but in colour. The scene is the same as in the world: season, weather, holidays. Photos cycle one after another, and a tap shows a photo full-screen. The shots are cached for the day.
- **Description.** A few sentences about the place: what it is like and why people go there (`SiteDef.about`, texts in `scripts/site_about.py`, in English in `scripts/lang/en/part6.json`). The generator checks that every place except homes has a description.
- **Opening hours.** They unfold under a single line with today's hours. It is the week day by day (`weekHours`), with today highlighted and days off marked in red.
- Then comes what is here, who works here and what is happening here today.
- **"Who works when"** (the clock button at the side). A list of all places that have hours: open ones first, each with "closes at…" or "opens…". A toggle "Open now / All"; a tap opens the place card.
- **The paper map** also says under the place name whether it is open now and when that will change.
- **"Route"** (`walkRoute`). The walking route is built with A* search over the real cells. Pavements are the cheapest for it, grass costs more, and there is no way through water or buildings. Between maps the route goes through exits and roads. The card shows how many minutes it takes on foot (the hero walks three cells a second). The taxi is shown with the trip duration, how many minutes until the car arrives, the fare and the reason for the fare. The "Call a taxi" button takes you there.
- You cannot call a taxi from home: the card asks you to step outside first. If the place is very close, the card suggests walking.

## Layers

- **Traffic.** Each named street is coloured by how many cars are on it: green, yellow or red. Cars are visible as dots, but only on the map where the hero currently is.
- **Weather.** Rain, snow, fog or clouds are visible on the map. A badge names the weather now and for the day, in words and without numbers.
- **Today** (`happenings`). Shows a holiday on the square, the market until 18:00, cinema showings, the flea market at the dump at weekends and the next race at the racecourse. The list can be tapped and the map will show the place.

## Where in the code

`app/src/maps/model.ts` (overview, projection, routes, search, hours by day, events), `app/src/ui/maps.ts` (`MapsSheet`), `app/src/paperphoto.ts` (the photo camera), `app/src/ui/papermap.ts` (hours on the paper map), `scripts/site_about.py`, `app/src/ui/phone.ts` (the Maps app), `app/src/ui/media/desktop.ts` (the Maps icon), `app/src/game.ts` (`mapsSheet`, `taxiQuotes`), `scripts/map_streets.py`. Tests: `app/test/maps.test.ts`, `app/e2e/maps.mjs`.
