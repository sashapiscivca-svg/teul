# Boxed games on a shelf in the café, the library and the hostel: one sits down with whoever is there for a game.
# Run inside gen_base_content.py after interiors.py and faiths.py (it needs `rooms`).

for _rid in ("cafe_in", "library_in", "hostel_in"):
    _R = next((r for r in rooms if r.id == _rid), None)
    if not _R:
        continue
    _placed = False
    # along the walls first (a shelf stands against one), clear of the door
    _cells = [(x, y) for y in range(1, _R.h - 2) for x in range(_R.w) if x in (0, _R.w - 1) or y == 1]
    _posts = {tuple(p) for p in _R.posts}
    for _x, _y in _cells:
        if (_x, _y) in _posts:
            continue
        if _R.prop("game_shelf", _x, _y, must=False):
            _placed = True
            break
    assert _placed, f"no room for the games shelf in {_rid}"
