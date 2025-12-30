<script lang="ts">
  import { Timescope } from '$lib';
  import type { Decimal } from '$lib';
  import type { TimescopeRange } from 'timescope';

  let time: Decimal | null = null;
  let timeChanging: Decimal | null = null;
  let timeAnimating: Decimal | null = null;
  let selectedRangeChanging: TimescopeRange<Decimal> | null = null;
</script>

<Timescope
  bind:time
  on:timechanging={(e) => (timeChanging = e.detail)}
  on:timeanimating={(e) => (timeAnimating = e.detail)}
  on:selectedrangechanging={(e) => (selectedRangeChanging = e.detail)}
/>

<pre>time: {time?.toString()}</pre>
<pre>timeChanging: {timeChanging?.toString()}</pre>
<pre>timeAnimating: {timeAnimating?.toString()}</pre>
<pre>selectedRangeChanging: {selectedRangeChanging?.toString()}</pre>
