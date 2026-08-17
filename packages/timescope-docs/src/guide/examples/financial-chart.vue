---
title: Financial Chart
---

<template>
  <!-- #region html -->
  <div id="example-financial-chart"></div>
  <!-- #endregion html -->
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";

// #region code
import { Timescope } from "timescope";

// #region docs-ignore
onMounted(() => {
  // #endregion docs-ignore

  const priceData: {
    time: number;
    values: {
      open: number;
      high: number;
      low: number;
      close: number;
      ma: number | null;
    };
  }[] = [];
  const volumeData: { time: number; value: number }[] = [];

  let price = 100;
  let time = 0;

  for (let i = 0; i < 120; i++) {
    const open = price;
    const trend = (Math.random() - 0.48) * 2;
    const volatility = 0.5 + Math.random() * 1.5;

    const high = open + Math.random() * volatility;
    const low = open - Math.random() * volatility;
    const close = open + trend;

    const candleValue = {
      open,
      high: Math.max(high, open, close),
      low: Math.min(low, open, close),
      close,
    };

    priceData.push({ time, values: { ...candleValue, ma: null } });

    volumeData.push({
      time,
      value: 1000000 + Math.random() * 2000000,
    });

    price = close;
    time += 3600;
  }

  const period = 20;
  for (let i = 0; i < priceData.length; i++) {
    if (i >= period - 1) {
      const sum = priceData
        .slice(i - period + 1, i + 1)
        .reduce((acc, d) => acc + d.values.close, 0);
      priceData[i].values.ma = sum / period;
    }
  }

  const timescope = new Timescope({
    target: "#example-financial-chart",
    style: { height: "400px" },
    time: priceData[60]?.time || 0,
    zoom: -9,
    sources: {
      price: { immediate: true, data: priceData },
      volume: volumeData,
    },
    series: {
      stock: {
        data: {
          source: "price",
          domain: {
            unit: "$",
            range: {
              shrink: true,
              expand: true,
              default: [undefined, undefined],
            },
          },
        },
        chart: {
          marks: [
            {
              draw: "section",
              using: ["high", "low"],
              style: {
                lineColor: ({ values }) =>
                  values.open != null &&
                  values.close != null &&
                  values.open.lt(values.close)
                    ? "#10b981"
                    : "#ef4444",
                lineWidth: 1,
              },
            },
            {
              draw: "bar",
              using: ["open", "close"],
              style: ({ values }) =>
                values.open != null &&
                values.close != null &&
                values.open.lt(values.close)
                  ? {
                      lineColor: "#10b981",
                      fillColor: "#10b981",
                    }
                  : {
                      lineColor: "#ef4444",
                      fillColor: "#ef4444",
                    },
            },
          ],
          links: [
            {
              draw: "line",
              using: ["ma"],
              style: {
                lineColor: "#f59e0b",
              },
            },
          ],
        },
        tooltip: false,
        track: "price",
      },
      volume: {
        data: {
          source: "volume",
          color: "#8b5cf6",
          domain: { unit: "shares" },
        },
        chart: "bars:filled",
        tooltip: false,
        track: "volume",
      },
    },
    tracks: {
      price: {
        timeAxis: false,
        height: 300,
      },
      volume: {
        timeAxis: { relative: true },
        height: 100,
      },
    },
  });
  // #endregion code

  onBeforeUnmount(() => timescope?.dispose());
});
</script>
