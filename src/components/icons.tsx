import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

function Svg({
  size,
  className,
  children,
}: IconProps & {children: React.ReactNode}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden>
      {children}
    </svg>
  );
}

export function IconSearch({size = 18, className}: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </Svg>
  );
}

export function IconX({size = 14, className}: IconProps) {
  return (
    <Svg size={size} className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  );
}

export function IconCopy({size = 12, className}: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  );
}

export function IconPlus({size = 14, className}: IconProps) {
  return (
    <Svg size={size} className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  );
}

export function IconPencil({size = 12, className}: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </Svg>
  );
}

export function IconTrash({size = 12, className}: IconProps) {
  return (
    <Svg size={size} className={className}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </Svg>
  );
}

export function IconDownload({size = 14, className}: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </Svg>
  );
}

export function IconUpload({size = 14, className}: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </Svg>
  );
}

export function IconChevronLeft({size = 12, className}: IconProps) {
  return (
    <Svg size={size} className={className}>
      <polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

export function IconChevronRight({size = 12, className}: IconProps) {
  return (
    <Svg size={size} className={className}>
      <polyline points="9 18 15 12 9 6" />
    </Svg>
  );
}

export function IconLayers({size = 12, className}: IconProps) {
  return (
    <Svg size={size} className={className}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </Svg>
  );
}

export function IconGrip({size = 12, className}: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="9" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
      <circle cx="15" cy="6" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="18" r="1" />
    </Svg>
  );
}

export function IconExternal({size = 11, className}: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </Svg>
  );
}
