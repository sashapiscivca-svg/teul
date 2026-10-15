// Smoke test: load the real wasm build in Node and play a few commands against the base pack.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const require = createRequire(import.meta.url);
const { Engine } = require(path.join(root, "target/wasm-node/teul_wasm.js"));

const pack = readFileSync(path.join(root, "content/base/pack.json"), "utf8");
const engine = new Engine(JSON.stringify([pack]), 1, 7, 1_700_000_000, "[]");

const assert = (cond, msg) => {
  if (!cond) {
    console.error("SMOKE FAILED:", msg);
    process.exit(1);
  }
};

assert(JSON.parse(engine.wallet_view()).coins === 150, "start coins");
assert(JSON.parse(engine.command(10, '{"type":"acquire","item":"fern"}')).ok, "acquire fern");
assert(JSON.parse(engine.command(11, '{"type":"place","item":"fern","x":1,"y":1,"rot":0}')).ok, "place fern");
assert(JSON.parse(engine.room_view()).placements.length === 1, "one placement");
const locked = JSON.parse(engine.command(12, '{"type":"acquire","item":"bed"}'));
assert(!locked.ok && locked.error.kind === "locked", "bed is locked");
assert(JSON.parse(engine.command(13, "garbage")).error.kind === "bad_command", "bad json is reported");

const events = engine.drain_events();
const again = new Engine(JSON.stringify([pack]), 1, 7, 1_700_000_000, events);
assert(again.room_view() === engine.room_view(), "reload reproduces the room");

let threw = false;
try {
  new Engine("nonsense", 1, 1, 0, "[]");
} catch (e) {
  threw = true;
}
assert(threw, "a bad pack list throws from the constructor");
console.log("SMOKE OK");
