<script lang="ts">
  import { Timescope } from '@timescope/svelte';
  import type { Decimal } from '@timescope/svelte';
  import type { TimescopeRange } from '@timescope/svelte';

  let time: Decimal | null = null;
  let timeChanging: Decimal | null = null;
  let timeAnimating: Decimal | null = null;
  let selectionRangeChanging: TimescopeRange<Decimal> | null = null;
  const options = { style: { height: '80px' } };
</script>

<Timescope
  {options}
  bind:time
  on:timechanging={(e) => (timeChanging = e.detail)}
  on:timeanimating={(e) => (timeAnimating = e.detail)}
  on:selectionrangechanging={(e) => (selectionRangeChanging = e.detail)} />

<pre>time: {time?.toString()}</pre>
<pre>timeChanging: {timeChanging?.toString()}</pre>
<pre>timeAnimating: {timeAnimating?.toString()}</pre>
<pre>selectionRangeChanging: {selectionRangeChanging?.toString()}</pre>
