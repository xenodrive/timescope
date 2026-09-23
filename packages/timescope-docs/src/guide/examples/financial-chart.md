<script setup>
import Example from './financial-chart.vue';
</script>

# Financial Chart

Combine BTC/USDT candles, moving averages, and traded volume. This example loads market data from the public Binance data API and requires network access to that endpoint.

## Try it

Zoom from the yearly overview into shorter intervals. Compare price and volume at the same time and observe the candle interval changing with resolution.

<Example />

## Code

<!-- example-code -->

## How it works

- The loader translates requested ranges and resolutions into market API parameters. Timescope uses seconds; the API uses milliseconds.
- Extra historical candles provide context for moving averages as well as chart connections.
- Marks draw the candle bodies and high/low ranges; links draw the moving averages. Named price and volume Domains keep their units separate.
- A timer invalidates the unfinished candle so it can be fetched again. The initial load fits the view to one year.

### Cleanup

Register this with your application's teardown lifecycle:

```ts
clearInterval(refresh);
timescope.dispose();
market.dispose?.();
```

## Next steps

Start with [Dynamic Loader](./dynamic-loader) for the loading contract and [Marks & Links](./marks-and-links) for drawing primitives. See [Domains](/api/timescope-options#domains) for scaling.
