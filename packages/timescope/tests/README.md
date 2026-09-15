# Test contracts

Run `pnpm test` from `packages/timescope`. This runs the type checker and all
`tests/**/*.spec.ts` files; the playground's Vite root is not used.

## Ownership

| Directory    | Contract                                                                      |
| ------------ | ----------------------------------------------------------------------------- |
| `api/`       | Public options, TypeScript completions, lifetime                              |
| `data/`      | Acquisition, mutation, invalidation, resolution, aggregation                  |
| `charts/`    | Visible geometry, chunk continuity, selected fields, tooltips                 |
| `scales/`    | Domain bounds, coordinate relationships, axes and scale transitions           |
| `rendering/` | Publication, frame synchronization, transport ownership, renderer integration |
| `viewport/`  | Time inputs, time axes, coordinate precision and interaction                  |

## Adding or changing a test

- One test expresses one observable promise or mathematical property. Use
  `it.each` for different inputs to that same promise.
- Give a regression a general name and a minimal fixture. A bug's original
  timestamp, canvas size or sequence of internal calls is not itself a contract.
- Check a contract at its owning boundary. Integration tests check connections
  between boundaries rather than repeating every lower-level case.
- Prefer real sources, series and domains. Mock external I/O, clocks and Canvas
  where needed; avoid reconstructing private caches or projection state for
  higher-level tests.
- Compare algorithms against simple independent reference calculations. For
  equivalent renderings, compare positions or sampled curves rather than
  requiring identical command segmentation.
- Exact values belong in tests for arithmetic, boundaries and explicit options.
  Node layouts, allocation counts, object reuse, default tick counts, scheduling
  thresholds and internal error wording do not belong in correctness tests.
- Call counts are meaningful when calls are the observable effect: for example,
  a deferred source must not load during movement. They should not describe an
  internal optimization strategy.
- Test both publication and cancellation in async scenarios. Finish or dispose
  pending work even if an assertion fails.

## Behavior awaiting a specification decision

The following historical expectations were removed rather than promoted to
contracts. Decide the intended behavior before adding replacement expectations:

- Marks composite alpha against the background, while links handle fill opacity
  differently. What differences, if any, should users observe?
- A shrinking automatic domain retains previous bounds when new data has a
  single value. What should a constant range show, and should that depend on
  viewing history?
- Reusing old link geometry when a new projection is constant currently collapses
  it to a line. Define the intended transition before requiring that shape.
- Pixel-to-time conversion rounds to the resolution's decimal precision. The
  coordinate tests require pixel round-trips, but do not prescribe whether every
  fractional-pixel timestamp must survive an exact Decimal round-trip.

Performance measurements belong in benchmarks; do not retain an implementation
strategy solely because an old test asserted its allocation or traversal count.
