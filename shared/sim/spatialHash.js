export function createSpatialHash({ cellSize = 360 } = {}) {
  const safeCellSize = Math.max(1, Math.floor(Number(cellSize) || 360));
  const cells = new Map();
  let inserted = 0;

  function insertCircle(entity) {
    if (!entity || !Number.isFinite(entity.x) || !Number.isFinite(entity.y)) {
      return false;
    }
    const radius = getRadius(entity);
    const range = getCellRange(entity.x, entity.y, radius, safeCellSize);
    for (let cellX = range.minX; cellX <= range.maxX; cellX += 1) {
      for (let cellY = range.minY; cellY <= range.maxY; cellY += 1) {
        const key = getCellKey(cellX, cellY);
        let bucket = cells.get(key);
        if (!bucket) {
          bucket = new Map();
          cells.set(key, bucket);
        }
        bucket.set(entity.id, entity);
      }
    }
    inserted += 1;
    return true;
  }

  function queryCircle(x, y, radius = 0) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return [];
    }
    const range = getCellRange(x, y, Math.max(0, Number(radius) || 0), safeCellSize);
    const results = new Map();
    for (let cellX = range.minX; cellX <= range.maxX; cellX += 1) {
      for (let cellY = range.minY; cellY <= range.maxY; cellY += 1) {
        const bucket = cells.get(getCellKey(cellX, cellY));
        if (!bucket) {
          continue;
        }
        for (const [id, entity] of bucket) {
          results.set(id, entity);
        }
      }
    }
    return [...results.values()];
  }

  function getStats() {
    return {
      cellSize: safeCellSize,
      cells: cells.size,
      inserted
    };
  }

  return {
    cellSize: safeCellSize,
    cells,
    insertCircle,
    queryCircle,
    getStats
  };
}

export function buildSpatialHash(entities, options = {}) {
  const hash = createSpatialHash(options);
  for (const entity of entities) {
    hash.insertCircle(entity);
  }
  return hash;
}

function getCellRange(x, y, radius, cellSize) {
  return {
    minX: Math.floor((x - radius) / cellSize),
    maxX: Math.floor((x + radius) / cellSize),
    minY: Math.floor((y - radius) / cellSize),
    maxY: Math.floor((y + radius) / cellSize)
  };
}

function getCellKey(cellX, cellY) {
  return `${cellX}:${cellY}`;
}

function getRadius(entity) {
  return Math.max(0, Number(entity.radius) || 0);
}
