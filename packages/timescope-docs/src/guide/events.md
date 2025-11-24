# Events

Timescope emits events when time, zoom, or selection range changes. Events are emitted for both user interactions and programmatic updates.

## Event Flow

```mermaid
flowchart LR
  ui([User])
  prog[[Code]]
  TL[Timescope]
  L((Listeners))

  ui -- swipe / drag --> TL
  ui -- pinch / wheel --> TL
  prog -- APIs --> TL

  TL -- timechanging --> L
  TL -- timechanged --> L
  TL -- zoomchanging --> L
  TL -- zoomchanged --> L
  TL -- rangechanging --> L
  TL -- rangechanged --> L

  classDef node fill:#e8f0ff,stroke:#3553a5,color:#0b1e66;
  classDef listener fill:#ffe3f0,stroke:#b0003a,color:#4b001a;
  classDef user fill:#e7fff2,stroke:#0a7f5a,color:#084c39;
  classDef prog fill:#fff7e6,stroke:#8a5a00,color:#5a3b00;

  class TL node;
  class ui user;
  class prog prog;
  class L listener;

  linkStyle 3 stroke:#b0003a,stroke-width:2px;
  linkStyle 4 stroke:#b0003a,stroke-width:2px;
  linkStyle 5 stroke:#b0003a,stroke-width:2px;
  linkStyle 6 stroke:#b0003a,stroke-width:2px;
  linkStyle 7 stroke:#b0003a,stroke-width:2px;
  linkStyle 8 stroke:#b0003a,stroke-width:2px;
```

## Timescope Events

| Event | When |
|-------|------|
| `timechanging` | During time change |
| `timechanged` | Time change complete |
| `zoomchanging` | During zoom change |
| `zoomchanged` | Zoom change complete |
| `rangechanging` | During selection resize |
| `rangechanged` | Selection update complete |

```typescript
import { Timescope } from 'timescope';

const timescope = new Timescope({
  target: '#timescope',
  style: { height: '160px' },
});

timescope.on('timechanged', (e) => {
  console.log('Time:', e.value?.toString() ?? 'now');
});

timescope.on('zoomchanged', (e) => {
  console.log('Zoom:', e.value.toString());
});

timescope.on('rangechanged', (e) => {
  const payload = e.value ? e.value.map((t) => t.toString()) : 'none';
  console.log('Selection:', payload);
});
```

## Cleanup

Event listeners return a cleanup function:

```typescript
const unsubscribe = timescope.on('timechanged', (e) => {
  console.log(e.value);
});

// Later
unsubscribe();
```

## See Also

- [API Reference](/api/timescope) for complete event signatures
- [Examples](/guide/examples/) for practical usage
