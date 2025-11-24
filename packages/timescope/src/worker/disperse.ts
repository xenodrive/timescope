import { Vector2f } from '#src/core/vector';

type Label = {
  id: number;

  sideX: unknown;

  box: {
    width: number;
    height: number;
  };

  point: Vector2f;

  force?: Vector2f;
};

function boxOverlaps(a: Label, b: Label) {
  const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);
  const w = overlap(a.point.x, a.point.x + a.box.width + 2, b.point.x, b.point.x + b.box.width + 2);
  const h = overlap(a.point.y, a.point.y + a.box.height + 2, b.point.y, b.point.y + b.box.height + 2);
  if (w <= 0 || h <= 0) return null;

  const d = Math.hypot(w, h);
  return { w, h, d };
}

const LOOP_LIMIT = 100;

/** @internal */
export function disperse(labels_: Label[], minY: number, maxY: number) {
  let energy = 0;
  let loop = 0;
  const work = new Vector2f(0, 0);
  do {
    energy = 0;
    const labels = labels_.map((p) => ({
      ...p,
      force: (p?.force ?? new Vector2f(0.01 * p.id, 0)).set(0.01 * p.id, 0),
    })) as (Label & { force: Vector2f })[];

    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const p = labels[i];
        const q = labels[j];
        if (p === q || p.sideX !== q.sideX) continue;

        const overlapped = boxOverlaps(p, q);
        if (!overlapped) continue;

        const dist = p.point.distanceTo(q.point);
        if (dist === 0) {
          const f = [0, overlapped.h / 2];
          p.force.sub(f);
          q.force.add(f);
        } else {
          const v = work
            .set(...q.point.values)
            .sub(p.point)
            .normalize();
          const f = [(overlapped.w / 2) * v.x, (overlapped.h / 2) * v.y];

          p.force.sub(f);
          q.force.add(f);
        }
      }
    }

    labels.forEach((p) => {
      const v = work.set(p.point.x, 0);
      p.force.sub(v.normalize().scale(0.2));
    });

    for (let i = 0; i < labels.length; i++) {
      const p = labels[i];
      p.point.add(p.force);

      if (p.point.x < 0) {
        p.force.x += p.point.x;
        p.point.x -= p.point.x;
      }
      if (p.point.y - p.box.height / 2 < 0 + minY) {
        p.force.y += p.point.y - p.box.height / 2 - minY;
        p.point.y -= p.point.y - p.box.height / 2 - minY;
      }
      if (p.point.y + p.box.height / 2 + 1 > maxY) {
        p.force.y += p.point.y + p.box.height / 2 + 1 - maxY;
        p.point.y -= p.point.y + p.box.height / 2 + 1 - maxY;
      }

      energy += p.force.norm ** 2;
    }
  } while (energy > 1 && loop++ < LOOP_LIMIT);

  return loop < LOOP_LIMIT;
}
