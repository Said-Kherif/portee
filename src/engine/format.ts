export function seconds(ms: number, digits = 1): string {
  return `${(ms / 1000).toFixed(digits).replace('.', ',')} s`
}

export function percent(ratio: number): string {
  return `${Math.round(ratio * 100)} %`
}
