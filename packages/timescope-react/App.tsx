import { Decimal, Timescope } from '@timescope/react';
import { useState } from 'react';
import { type TimescopeRange } from 'timescope';

function App() {
  const [time, setTime] = useState<Decimal | null>(null);
  const [timeChanging, setTimeChanging] = useState<Decimal | null>(null);
  const [timeAnimating, setTimeAnimating] = useState<Decimal | null>(null);
  const [selectionRangeChanging, setSelectionRangeChanging] = useState<TimescopeRange<Decimal> | null>(null);

  return (
    <>
      <Timescope
        time={time}
        onTimeChanged={setTime}
        onTimeChanging={setTimeChanging}
        onTimeAnimating={setTimeAnimating}
        onSelectionRangeChanging={setSelectionRangeChanging}
      />
      <pre>time: {time?.toString()}</pre>
      <pre>timeChanging: {timeChanging?.toString()}</pre>
      <pre>timeAnimating: {timeAnimating?.toString()}</pre>
      <pre>selectionRangeChanging: {selectionRangeChanging?.toString()}</pre>
    </>
  );
}

export default App;
