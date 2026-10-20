'use client';

import type { RewardPolicy } from '@lintel/api-contracts';
import { Badge, Button, listItemEnter, StatusPill } from '@lintel/design-system/web';
import { Pause, Pencil, Play, PlayCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { CRITERIA, describeCriterion } from './criterion-definitions';
import { formatAmount } from './reward-presentation';

interface PolicyCardProps {
  readonly policy: RewardPolicy;
  readonly index: number;
  readonly onEdit: () => void;
  readonly onRun: () => void;
  readonly onToggle: () => void;
  readonly toggling: boolean;
}

/** A policy as its rules read aloud: who, how often, what has to be true, and how much. */
export function PolicyCard({ policy, index, onEdit, onRun, onToggle, toggling }: PolicyCardProps) {
  return (
    <motion.li
      {...listItemEnter(index)}
      className="flex flex-col gap-5 rounded-lg border border-hairline bg-raised p-5 sm:p-6"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="type-title-lg text-ink">{policy.name}</h3>
            <StatusPill
              tone={policy.isActive ? 'onTrack' : 'neutral'}
              glyph={policy.isActive ? 'onTrack' : 'cancelled'}
              label={policy.isActive ? 'Active' : 'Paused'}
              size="sm"
            />
          </div>
          {policy.description && (
            <p className="max-w-prose type-body-sm text-ink-muted">{policy.description}</p>
          )}
          <p className="flex flex-wrap gap-1.5">
            <Badge>{policy.scope === 'team' ? 'Each team' : 'Each person'}</Badge>
            <Badge>{policy.period === 'monthly' ? 'Monthly' : 'Quarterly'}</Badge>
          </p>
        </div>
        <p className="font-display text-[1.75rem] leading-8 text-ink tabular-nums">
          {formatAmount(policy.amountMinor, policy.currency)}
        </p>
      </header>
      <ol className="flex flex-col gap-2">
        {policy.criteria.map((criterion) => (
          <li key={criterion.type} className="flex flex-col gap-0.5 border-l-2 border-rule pl-3">
            <span className="type-body-sm font-medium text-ink">
              {CRITERIA[criterion.type].label}
            </span>
            <span className="type-body-sm text-ink-muted">{describeCriterion(criterion)}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2 border-t border-hairline pt-4">
        <Button size="sm" leadingIcon={<Pencil aria-hidden />} onClick={onEdit}>
          Edit
        </Button>
        {policy.isActive && (
          <Button size="sm" leadingIcon={<PlayCircle aria-hidden />} onClick={onRun}>
            Run evaluation
          </Button>
        )}
        <Button
          size="sm"
          variant="quiet"
          pending={toggling}
          leadingIcon={policy.isActive ? <Pause aria-hidden /> : <Play aria-hidden />}
          onClick={onToggle}
        >
          {policy.isActive ? 'Pause' : 'Turn on'}
        </Button>
      </div>
    </motion.li>
  );
}
