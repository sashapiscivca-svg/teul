# Rooms of a living town: a friend's home one is invited to for dinner (a warm kitchen-dining room: the table laid,
# a dresser of plates, a stove, an armchair by the fire), and the library's leaking roof (buckets under the drops,
# gone once the town has mended it). Run inside gen_base_content.py after interiors.py (it uses Inside, rooms).

R = Inside("guest_home", "У гостях", "home_new1", 13, 10, "floor.oak", "wall.cream", 5)
R.invite_only = True
# the kitchen along the back wall, the table laid in the middle, the fire and an armchair by it
R.prop("counter", 0, 0)
R.prop("counter_sink", 1, 0)
R.prop("stove", 2, 0)
R.prop("fridge", 3, 0)
R.prop("wall_cabinet", 0, 0, wall="north")
R.prop("wall_cabinet", 1, 0, wall="north")
R.prop("cabinet_glass", 7, 0)
R.prop("cabinet_glass", 8, 0)
R.prop("round_dining", 4, 3)
for (x, y, rot) in ((4, 2, 0), (5, 2, 0), (4, 5, 2), (5, 5, 2)):
    R.prop("dining_chair_wood", x, y, rot=rot)
R.prop("rug_small", 4, 3)
R.prop("fireplace", 10, 0)
R.prop("armchair", 12, 2, rot=1)
R.prop("floor_lamp", 12, 3)
R.prop("sofa2", 9, 7, rot=2)
R.prop("coffee_table", 9, 5)
R.prop("bookshelf", 0, 4, rot=3)
R.prop("fern", 0, 8)
R.prop("window_tall", 12, 5, wall="east")
R.prop("painting_tall", 0, 2, wall="west")
R.prop("wall_clock", 5, 0, wall="north")
R.post((3, 2), (6, 2), (3, 5), (6, 5), (11, 4))
rooms.append(R)
guest = R.build()
guest["invite_only"] = True
locations.append(guest)

# the library: a bucket or two under the drips while the roof is leaking
for room in rooms:
    if room.id == "library_in":
        for (x, y) in ((6, 6), (1, 7)):
            n = len(room.props)
            if room.prop("leak_bucket", x, y, must=False):
                room.props[n]["unflag"] = "project:proj.library_roof:done"
