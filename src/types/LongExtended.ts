import Long from 'long';

export function fromBits(lowBits: number, highBits: number, unsigned?: boolean): number {
    return Long.fromBits(lowBits, highBits, unsigned).toNumber();
}

export { fromString } from 'long';
