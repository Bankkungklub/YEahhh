import { distanceSq } from "./vector.js";

export function circleIntersects(a, b, padding = 0) {
  const radius = a.radius + b.radius + padding;
  return distanceSq(a, b) <= radius * radius;
}

export function getFirstCircleHit(source, candidates, excludedId = null) {
  let best = null;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    if (!candidate || candidate.id === excludedId || candidate.state === "dead") {
      continue;
    }
    if (!circleIntersects(source, candidate)) {
      continue;
    }

    const hitDistance = distanceSq(source, candidate);
    if (hitDistance < bestDistance || (hitDistance === bestDistance && candidate.id < best.id)) {
      best = candidate;
      bestDistance = hitDistance;
    }
  }

  return best;
}

export function wouldOverlapAny(circle, candidates, padding = 0) {
  for (const candidate of candidates) {
    if (candidate.state === "dead") {
      continue;
    }
    if (circleIntersects(circle, candidate, padding)) {
      return true;
    }
  }
  return false;
}
