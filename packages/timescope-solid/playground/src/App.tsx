import { createSignal } from 'solid-js';
import { Decimal, type TimescopeRange } from 'timescope';
import { Timescope } from '../../src';

export function App() {
  const [time, setTime] = createSignal<Decimal | null>(null);
  const [zoom] = createSignal<number>(-22);
  const [timeAnimating, setTimeAnimating] = createSignal<Decimal | null>(null);
  const [timeChanging, setTimeChanging] = createSignal<Decimal | null>(null);
  const [selectedRangeChanged, setSelectedRangeChanged] = createSignal<TimescopeRange<Decimal> | null>(null);
  const [selectedRangeChanging, setSelectedRangeChanging] = createSignal<TimescopeRange<Decimal> | null>(null);

  return (
    <>
      <Timescope
        time={time()}
        zoom={zoom()}
        selectedRange={selectedRangeChanged()}
        onTimeAnimating={setTimeAnimating}
        onTimeChanging={setTimeChanging}
        onTimeChanged={setTime}
        onSelectedRangeChanged={setSelectedRangeChanged}
        onSelectedRangeChanging={setSelectedRangeChanging}
      />
      <pre>
        time: {time()?.toString()}
        <br />
        timeChanging: {timeChanging()?.toString()}
        <br />
        timeAnimating: {timeAnimating()?.toString()}
        <br />
        selectedRangeChanging: {selectedRangeChanging()?.toString()}
        <br />
      </pre>
    </>
  );
}
