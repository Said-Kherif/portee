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

export function IconForward({ size = 18 }: IIconProps) {
  return (
    <Svg size={size}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  )
}

export function IconRepeat({ size = 18 }: IIconProps) {
  return (
    <Svg size={size}>
      <path d="M17 2l3 3-3 3" />
      <path d="M4 11V9a4 4 0 0 1 4-4h12" />
      <path d="M7 22l-3-3 3-3" />
      <path d="M20 13v2a4 4 0 0 1-4 4H4" />
    </Svg>
  )
}

export function IconSpeaker({ size = 20 }: IIconProps) {
  return (
    <Svg size={size}>
      <path d="M11 5L6 9H3v6h3l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </Svg>
  )
}

export function IconStar({ size = 16, filled = true }: IIconProps & { filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.6l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.17l-5.7 2.99 1.09-6.35-4.62-4.5 6.38-.93z" />
    </svg>
  )
}

export function IconBolt({ size = 20 }: IIconProps) {
  return (
    <Svg size={size}>
      <path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z" />
    </Svg>
  )
}

export function IconTrophy({ size = 14 }: IIconProps) {
  return (
    <Svg size={size}>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </Svg>
  )
}

export function IconLock({ size = 16 }: IIconProps) {
  return (
    <Svg size={size}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  )
}

export function IconCrown({ size = 22 }: IIconProps) {
  return (
    <Svg size={size}>
      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
    </Svg>
  )
}

export function IconBook({ size = 18 }: IIconProps) {
  return (
    <Svg size={size}>
      <path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2z" />
      <path d="M4 20a2 2 0 0 0 2 2h13v-4" />
    </Svg>
  )
}

export function IconFlag({ size = 20 }: IIconProps) {
  return (
    <Svg size={size}>
      <path d="M5 21V4" />
      <path d="M5 4h12l-2.5 4L17 12H5" />
    </Svg>
  )
}

export function IconKeys({ size = 20 }: IIconProps) {
  return (
    <Svg size={size}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 12v8M15 12v8" />
      <path d="M7.5 4v8h3V4M13.5 4v8h3V4" />
    </Svg>
  )
}
