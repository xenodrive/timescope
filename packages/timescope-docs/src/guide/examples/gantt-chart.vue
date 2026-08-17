---
title: Gantt Chart
---

<template>
  <!-- #region html -->
  <div id="example-gantt-chart"></div>
  <!-- #endregion html -->
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";

// #region code
import { Timescope } from "timescope";

// #region docs-ignore
onMounted(() => {
  // #endregion docs-ignore

  const DAY = 24 * 60 * 60;
  const phaseColors = {
    planning: "#60a5fa",
    design: "#a78bfa",
    development: "#34d399",
    testing: "#fbbf24",
    deployment: "#f87171",
  };
  type Phase = keyof typeof phaseColors;
  const tasks: { task: string; start: number; end: number; phase: Phase }[] = [
    { task: "Planning", start: 0, end: 5, phase: "planning" },
    { task: "Requirements", start: 5, end: 12, phase: "planning" },
    { task: "Design", start: 12, end: 22, phase: "design" },
    { task: "Database Schema", start: 22, end: 28, phase: "design" },
    { task: "Backend API", start: 28, end: 45, phase: "development" },
    { task: "Frontend UI", start: 32, end: 50, phase: "development" },
    { task: "Integration", start: 50, end: 58, phase: "development" },
    { task: "Unit Testing", start: 45, end: 55, phase: "testing" },
    { task: "System Testing", start: 58, end: 68, phase: "testing" },
    { task: "UAT", start: 68, end: 75, phase: "testing" },
    { task: "Deployment", start: 75, end: 80, phase: "deployment" },
  ];

  const timescope = new Timescope({
    target: "#example-gantt-chart",
    style: { height: "240px" },
    time: 40 * DAY,
    zoom: -12,
    sources: {
      tasks: {
        data: tasks,
        decoder: (data: typeof tasks) =>
          data.map((task, lane) => ({
            times: {
              start: task.start * DAY,
              middle: ((task.start + task.end) / 2) * DAY,
              end: task.end * DAY,
            },
            values: { lane: (lane % 5) + 1 },
            data: task,
          })),
      },
    },
    series: {
      gantt: {
        data: {
          source: "tasks",
          domain: { range: [0, 6] },
        },
        chart: {
          marks: [
            {
              draw: "bar",
              using: ["lane@start", "lane@end"],
              style: {
                size: 20,
                radius: 4,
                fillColor: ({ data }) => phaseColors[data.phase],
                fillOpacity: 0.8,
                lineWidth: 2,
                lineColor: ({ data }) => phaseColors[data.phase],
              },
            },
            {
              draw: "text",
              using: "lane@middle",
              style: {
                size: 14,
                text: ({ data }) => data.task,
                textColor: "#1f2937",
                textOutline: true,
                textOutlineColor: "white",
                textOutlineWidth: 3,
              },
            },
          ],
        },
      },
    },
    tracks: {
      default: {
        timeAxis: {
          relative: true,
          timeFormat: ({ time }) => `${time.div(DAY).toFixed(0)} d`,
        },
      },
    },
  });
  // #endregion code

  onBeforeUnmount(() => timescope?.dispose());
});
</script>
