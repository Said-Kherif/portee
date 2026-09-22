import type { ReactNode } from 'react'

interface IIconProps {
  size?: number
}

function Svg({ size, strokeWidth = 2, children }: IIconProps & { strokeWidth?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export function IconBack({ size = 20 }: IIconProps) {
  return (
    <Svg size={size}>
      <path d="M15 6l-6 6 6 6" />
    </Svg>
  )
}

export function IconClose({ size = 18 }: IIconProps) {
  return (
    <Svg size={size}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  )
}

export function IconChart({ size = 22 }: IIconProps) {
  return (
    <Svg size={size}>
      <path d="M5 20v-7M12 20V5M19 20v-11" />
    </Svg>
  )
}

export function IconSliders({ size = 22 }: IIconProps) {
  return (
    <Svg size={size}>
      <path d="M4 7h9M19 7h1M4 17h3M13 17h7" />
      <circle cx="16" cy="7" r="2.5" />
      <circle cx="10" cy="17" r="2.5" />
    </Svg>
  )
}

export function IconCheck({ size = 16 }: IIconProps) {
  return (
    <Svg size={size} strokeWidth={2.5}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </Svg>
  )
}

export function IconFlame({ size = 16 }: IIconProps) {
  return (
    <Svg size={size}>
      <path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-1.5.5-2.5 1-3 .5 1.5 1.5 2 2 2 0-3-1-5 1-8z" />
    </Svg>
  )
}
