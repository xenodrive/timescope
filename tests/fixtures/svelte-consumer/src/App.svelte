<script lang="ts">
  import { Timescope } from '@timescope/svelte';
  import type { Decimal } from 'timescope';

   const options = { showFps: false };
  let time = $state<Decimal | null | undefined>(undefined);
  let zoom = $state<number | undefined>(undefined);

  type IsAny<T> = 0 extends 1 & T ? true : false;
  const componentIsTyped: IsAny<typeof Timescope> = false;
</script>

<Timescope style="height: 80px" {options} bind:time bind:zoom initialFit={[0, 30]} renderThread="main" />
