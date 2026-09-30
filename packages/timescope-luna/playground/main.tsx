import { createSignal, render, Show } from '@luna_ui/luna';
import { Timescope } from '@timescope/luna';
import { type Decimal, type TimescopeRange } from 'timescope';

function App() {
  const [time, setTime] = createSignal<Decimal | null>(null);
  const [zoom, setZoom] = createSignal<number>(-22);
  const [timeAnimating, setTimeAnimating] = createSignal<Decimal | null>(null);
  const [timeChanging, setTimeChanging] = createSignal<Decimal | null>(null);
  const [selectionRange, setSelectionRange] = createSignal<TimescopeRange<Decimal> | null>(null);
  const [selectionRangeChanging, setSelectionRangeChanging] = createSignal<TimescopeRange<Decimal> | null>(null);

  const [v, setV] = createSignal(false);

  return (
    <div>
      <button onclick={() => setV((v) => !v)}>Toggle</button>
      <Show when={v}>
        {() => (
          <Timescope
            style="height: 80px"
            time={time}
            zoom={zoom}
            selectionRange={selectionRange}
            onTimeAnimating={setTimeAnimating}
            onTimeChanging={setTimeChanging}
            onTimeChanged={setTime}
            onSelectionRangeChanged={setSelectionRange}
            onSelectionRangeChanging={setSelectionRangeChanging}
          />
        )}
      </Show>
      <pre>
        {() => `
          time: ${time()}
          timeChanging: ${timeChanging()}
          timeAnimating: ${timeAnimating()}
          selectionRange: ${selectionRange()}
          selectionRangeChanging: ${selectionRangeChanging()}
        `}
      </pre>
    </div>
  );
}

const app = document.getElementById('app');
if (app) {
  render(app, <App />);
}
