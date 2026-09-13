import { BinaryReader } from '@kikuchan/binary-reader';
import { Decimal } from '@kikuchan/decimal';

function readRiffChunk(r: BinaryReader) {
  const id = r.readString(4);
  if (!id) return undefined;
  const size = r.readUint32();
  const data = r.readBytes(size);

  return { id, size, data, r: new BinaryReader(data, { littleEndian: true }) };
}

export function loadWaveFile(data: Uint8Array) {
  let rate = 0;
  let channels = 0;
  let bits = 0;

  const r = new BinaryReader(data, { littleEndian: true });
  if (r.readString(4) !== 'RIFF') return false;
  r.skip(4); // bytes
  if (r.readString(4) !== 'WAVE') return false;

  // reading fmt
  const fmtChunk = readRiffChunk(r);
  if (!fmtChunk || fmtChunk.id !== 'fmt ') return false;
  if (fmtChunk.r.readUint16() !== 1) {
    console.error('Unsupported WAVE format');
    return false;
  }

  channels = fmtChunk.r.readUint16();
  rate = fmtChunk.r.readUint32();
  fmtChunk.r.skip(4 + 2);
  bits = fmtChunk.r.readUint16();

  let chunk: ReturnType<typeof readRiffChunk>;
  do {
    chunk = readRiffChunk(r);
    if (!chunk) return false;
  } while (chunk.id !== 'data');

  const samples: { time: Decimal; data: number[] }[] = [];
  for (let t = 0; !chunk.r.eof(); t++) {
    const data: number[] = [];
    for (let ch = 0; ch < channels; ch++) {
      data.push(bits === 16 ? chunk.r.readInt16le() / 32768 : (chunk.r.readUint8() - 128) / 128);
    }
    const time = Decimal(t).div(rate);

    samples.push({ time, data: channels === 1 ? [...data, ...data].slice(0, 2) : data });
  }

  return { rate, channels, bits, samples };
}
