export const G = {
  brace: '',
  gClef: '',
  fClef: '',
  head: { w: '', h: '', q: '', e: '' },
  rest: { w: '', h: '', q: '', e: '' },
  flagUp: '',
  flagDown: '',
  sharp: '',
  flat: '',
  natural: '',
  dot: '',
  timeSig: (n: number): string => String.fromCodePoint(0xe080 + n),
}
