import { Accessor, createEffect, createSignal, render, Show } from '@luna_ui/luna';
import { Decimal, Timescope } from '@timescope/luna';
import { TimescopeRange } from 'timescope';

function App() {
  const [time, setTime] = createSignal<Decimal | null>(null);
  const [zoom, setZoom] = createSignal<number>(-22);
  const [timeAnimating, setTimeAnimating] = createSignal<Decimal | null>(null);
  const [timeChanging, setTimeChanging] = createSignal<Decimal | null>(null);
  const [selectedRange, setSelectedRange] = createSignal<TimescopeRange<Decimal> | null>(null);
  const [selectedRangeChanging, setSelectedRangeChanging] = createSignal<TimescopeRange<Decimal> | null>(null);

  const [v, setV] = createSignal(false);

  return (
    <div>
      <button onclick={() => setV((v) => !v)}>Toggle</button>
      <Show when={v}>
        {() => (
          <Timescope
            time={time}
            zoom={zoom}
            selectedRange={selectedRange}
            onTimeAnimating={setTimeAnimating}
            onTimeChanging={setTimeChanging}
            onTimeChanged={setTime}
            onSelectedRangeChanged={setSelectedRange}
            onSelectedRangeChanging={setSelectedRangeChanging}
          />
        )}
      </Show>
      <pre>
        {() => `
          time: ${time()}
          timeChanging: ${timeChanging()}
          timeAnimating: ${timeAnimating()}
          selectedRangeChanged: ${selectedRange()}
          selectedRangeChanging: ${selectedRangeChanging()}
        `}
      </pre>
    </div>
  );
}

const app = document.getElementById('app');
if (app) {
  render(app, <App />);
}
