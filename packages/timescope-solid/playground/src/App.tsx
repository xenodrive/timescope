import { createSignal } from 'solid-js';
import { Decimal, type TimescopeRange } from 'timescope';
import { Timescope } from '../../src';

const options = { style: { height: '80px' } };

export function App() {
  const [time, setTime] = createSignal<Decimal | null>(null);
  const [zoom] = createSignal<number>(-22);
  const [timeAnimating, setTimeAnimating] = createSignal<Decimal | null>(null);
  const [timeChanging, setTimeChanging] = createSignal<Decimal | null>(null);
  const [selectionRange, setSelectionRange] = createSignal<TimescopeRange<Decimal> | null>(null);
  const [selectionRangeChanging, setSelectionRangeChanging] = createSignal<TimescopeRange<Decimal> | null>(null);

  return (
    <>
      <Timescope
        options={options}
        time={time()}
        zoom={zoom()}
        selectionRange={selectionRange()}
        onTimeAnimating={setTimeAnimating}
        onTimeChanging={setTimeChanging}
        onTimeChanged={setTime}
        onSelectionRangeChanged={setSelectionRange}
        onSelectionRangeChanging={setSelectionRangeChanging}
      />
      <pre>
        time: {time()?.toString()}
        <br />
        timeChanging: {timeChanging()?.toString()}
        <br />
        timeAnimating: {timeAnimating()?.toString()}
        <br />
        selectionRangeChanging: {selectionRangeChanging()?.toString()}
        <br />
      </pre>
    </>
  );
}
