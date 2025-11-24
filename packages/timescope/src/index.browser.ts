import { Decimal, Timescope } from './index.ts';

const globalScope = window as unknown as Record<string, unknown>;

globalScope.Decimal = Decimal;
globalScope.Timescope = Timescope;
