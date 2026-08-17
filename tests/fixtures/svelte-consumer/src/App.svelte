<script lang="ts">
  import { Timescope } from '@timescope/svelte';

  type IsAny<T> = 0 extends 1 & T ? true : false;
  const componentIsTyped: IsAny<typeof Timescope> = false;
</script>

<Timescope zoom={0} />
