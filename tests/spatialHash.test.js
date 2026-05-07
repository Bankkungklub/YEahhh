import test from "node:test";
import assert from "node:assert/strict";
import { buildSpatialHash, createSpatialHash } from "../shared/sim/spatialHash.js";

test("spatial hash returns entities near the query circle", () => {
  const hash = buildSpatialHash([
    { id: "near", x: 100, y: 100, radius: 10 },
    { id: "far", x: 1000, y: 1000, radius: 10 }
  ], { cellSize: 100 });

  assert.deepEqual(hash.queryCircle(100, 100, 20).map((entity) => entity.id), ["near"]);
});

test("spatial hash includes entities touching a cell boundary", () => {
  const hash = buildSpatialHash([
    { id: "edge", x: 199, y: 50, radius: 8 }
  ], { cellSize: 100 });

  assert.equal(hash.queryCircle(205, 50, 4).some((entity) => entity.id === "edge"), true);
});

test("spatial hash dedupes entities inserted across multiple cells", () => {
  const hash = buildSpatialHash([
    { id: "large", x: 100, y: 100, radius: 120 }
  ], { cellSize: 100 });

  assert.deepEqual(hash.queryCircle(100, 100, 160).map((entity) => entity.id), ["large"]);
});

test("spatial hash tolerates invalid radius and missing entities", () => {
  const hash = createSpatialHash({ cellSize: 100 });

  assert.equal(hash.insertCircle(null), false);
  assert.equal(hash.insertCircle({ id: "point", x: 0, y: 0 }), true);
  assert.equal(hash.queryCircle(Number.NaN, 0, 10).length, 0);
  assert.equal(hash.queryCircle(0, 0, 0)[0].id, "point");
});
