'use client';

import { motion } from 'motion/react';
import { cn } from '../lib/cn';
import { dataTransition } from '../motion/presets';

export type LoadStatus = 'available' | 'balanced' | 'stretched' | 'overloaded';

const SIZES = {
  xs: { box: 24, text: 'text-[0.625rem]' },
  sm: { box: 32, text: 'text-[0.75rem]' },
  md: { box: 40, text: 'text-[0.875rem]' },
  lg: { box: 56, text: 'text-[1.125rem]' },
} as const;

const LOAD_COLOR: Readonly<Record<LoadStatus, string>> = {
  available: 'text-done-solid',
  balanced: 'text-on-track-solid',
  stretched: 'text-at-risk-solid',
  overloaded: 'text-overdue-solid',
};

export const LOAD_LABELS: Readonly<Record<LoadStatus, string>> = {
  available: 'Has room',
  balanced: 'Balanced',
  stretched: 'Stretched',
  overloaded: 'Overloaded',
};

export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

interface AvatarProps {
  readonly name: string;
  /** 0–359; each person keeps a stable hue. */
  readonly hue: number;
  readonly size?: keyof typeof SIZES;
  /** Booked share of capacity (1 = full). Draws a load ring around the avatar. */
  readonly load?: { readonly utilization: number; readonly status: LoadStatus };
  readonly className?: string;
  /** Decorative when the name is printed next to it. */
  readonly decorative?: boolean;
}

export function Avatar({
  name,
  hue,
  size = 'sm',
  load,
  className,
  decorative = false,
}: AvatarProps) {
  const { box, text } = SIZES[size];
  const label = load
    ? `${name}, ${Math.round(load.utilization * 100)}% booked, ${LOAD_LABELS[load.status].toLowerCase()}`
    : name;
  const face = (
    <span
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-wide',
        text,
      )}
      style={{
        width: load ? box - 8 : box,
        height: load ? box - 8 : box,
        backgroundColor: `light-dark(oklch(91% 0.04 ${hue}), oklch(35% 0.055 ${hue}))`,
        color: `light-dark(oklch(36% 0.085 ${hue}), oklch(90% 0.05 ${hue}))`,
      }}
    >
      {initialsOf(name)}
    </span>
  );
  const accessibility = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label };
  if (!load) {
    return (
      <span
        {...accessibility}
        title={decorative ? undefined : name}
        className={cn('inline-flex', className)}
      >
        {face}
      </span>
    );
  }
  return (
    <span
      {...accessibility}
      title={decorative ? undefined : label}
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: box, height: box }}
    >
      <LoadRing size={box} utilization={load.utilization} status={load.status} />
      {face}
    </span>
  );
}

function LoadRing({
  size,
  utilization,
  status,
}: {
  size: number;
  utilization: number;
  status: LoadStatus;
}) {
  const stroke = 2.5;
  const radius = size / 2 - stroke / 2;
  const share = Math.max(0, Math.min(utilization, 1));
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${size} ${size}`}
      className={cn('absolute inset-0 -rotate-90', LOAD_COLOR[status])}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        className="stroke-hairline"
        strokeWidth={stroke}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: share }}
        transition={dataTransition}
      />
    </svg>
  );
}

interface AvatarStackProps {
  readonly people: readonly {
    readonly id: string;
    readonly fullName: string;
    readonly avatarHue: number;
  }[];
  readonly max?: number;
  readonly size?: 'xs' | 'sm';
  readonly className?: string;
}

export function AvatarStack({ people, max = 4, size = 'sm', className }: AvatarStackProps) {
  const shown = people.slice(0, max);
  const hidden = people.length - shown.length;
  const names = people.map((person) => person.fullName).join(', ');
  return (
    <span
      role="img"
      aria-label={names}
      title={names}
      className={cn('inline-flex items-center', className)}
    >
      {shown.map((person, index) => (
        <span
          key={person.id}
          className={cn('rounded-full ring-2 ring-surface', index > 0 && '-ml-2')}
        >
          <Avatar name={person.fullName} hue={person.avatarHue} size={size} decorative />
        </span>
      ))}
      {hidden > 0 && (
        <span
          aria-hidden
          className={cn(
            '-ml-2 inline-flex items-center justify-center rounded-full bg-sunken font-semibold text-ink-muted ring-2 ring-surface',
            size === 'xs' ? 'size-6 text-[0.625rem]' : 'size-8 text-[0.75rem]',
          )}
        >
          +{hidden}
        </span>
      )}
    </span>
  );
}
