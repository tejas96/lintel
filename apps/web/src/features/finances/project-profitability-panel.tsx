'use client';

import type { ProjectDetail, ProjectProfitability } from '@lintel/api-contracts';
import {
  Button,
  Card,
  CardHeader,
  ErrorState,
  easing,
  SkeletonText,
  StatusPill,
  seconds,
  useCalmMotion,
} from '@lintel/design-system/web';
import { PROJECT_COST_CATEGORY_LABELS } from '@lintel/domain';
import { Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { describeError } from '@/lib/api/describe-error';
import { BudgetBar } from './budget-bar';
import { CostLedger } from './cost-ledger';
import { describeMargin, formatMoney, MARGIN_PRESENTATION } from './finance-presentation';
import { RecordCostSheet } from './record-cost-sheet';
import { useProjectProfitability } from './use-project-finances';

function Categories({ data }: { readonly data: ProjectProfitability }) {
  const calm = useCalmMotion();
  const largest = Math.max(1, ...data.byCategory.map((row) => row.amountMinor));
  return (
    <ul aria-label="Recorded cost by category" className="flex flex-col gap-2">
      {data.byCategory.map((row, index) => (
        <li
          key={row.category}
          className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3"
        >
          <span className="type-body-sm text-ink-muted">
            {PROJECT_COST_CATEGORY_LABELS[row.category]}
          </span>
          <span aria-hidden className="h-1 overflow-hidden rounded-full bg-sunken">
            <motion.span
              className="block h-full origin-left rounded-full bg-ink-faint"
              style={{ width: `${(row.amountMinor / largest) * 100}%` }}
              initial={calm ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{
                duration: seconds('data'),
                ease: easing('outExpo'),
                delay: index * 0.04,
              }}
            />
          </span>
          <span className="font-mono text-[0.8125rem] text-ink tabular-nums">
            {formatMoney(row.amountMinor, data.currency)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Summary({ data }: { readonly data: ProjectProfitability }) {
  const margin = MARGIN_PRESENTATION[data.indicator];
  const money = (minor: number) => formatMoney(minor, data.currency);
  const remaining = data.remainingMinor;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="type-body-sm text-ink-muted">
            {remaining !== null && remaining < 0 ? 'Over budget by' : 'Budget remaining'}
          </p>
          <p className="type-display-md text-ink tabular-nums">
            {remaining === null ? '—' : money(Math.abs(remaining))}
          </p>
        </div>
        <StatusPill tone={margin.tone} glyph={margin.glyph} label={margin.label} size="sm" />
      </div>
      <BudgetBar
        budgetMinor={data.budgetMinor}
        recordedCostMinor={data.recordedCostMinor}
        indicator={data.indicator}
      />
      <p className="flex flex-wrap justify-between gap-x-4 type-body-sm text-ink-muted">
        <span>
          <span className="font-mono text-ink tabular-nums">{money(data.recordedCostMinor)}</span>{' '}
          recorded
          {data.budgetMinor !== null && (
            <>
              {' of '}
              <span className="font-mono tabular-nums">{money(data.budgetMinor)}</span>
            </>
          )}
        </span>
        {describeMargin(data.marginRatio) && <span>{describeMargin(data.marginRatio)}</span>}
      </p>
    </div>
  );
}

/**
 * Budget against recorded cost for the project, with the cost ledger. Shown
 * only when the studio has profitability switched on and the person may see
 * the budget; otherwise it renders nothing.
 */
export function ProjectProfitabilityPanel({
  project,
  today,
}: {
  readonly project: ProjectDetail;
  readonly today: string;
}) {
  const { enabled, profitability } = useProjectProfitability(project);
  const [recording, setRecording] = useState(false);
  if (!enabled) return null;
  const data = profitability.data;
  return (
    <Card>
      <CardHeader
        title="Budget and cost"
        description={
          data && data.budgetMinor === null
            ? 'No budget is set for this project, so there is no margin yet.'
            : 'Recorded costs against the agreed budget.'
        }
        action={
          <Button
            size="sm"
            leadingIcon={<Plus aria-hidden />}
            onClick={() => setRecording(true)}
            disabled={!data}
          >
            Record cost
          </Button>
        }
      />
      <div className="flex flex-col gap-5 px-5 pb-5">
        {profitability.isPending && <SkeletonText lines={4} />}
        {profitability.isError && (
          <ErrorState
            size="section"
            {...describeError(profitability.error, { resource: 'item', noun: 'budget' })}
            onRetry={() => profitability.refetch()}
          />
        )}
        {data && (
          <div className="@container flex flex-col gap-6">
            <div className="grid gap-6 @lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] @lg:gap-8">
              <Summary data={data} />
              {data.entryCount > 0 && <Categories data={data} />}
            </div>
            {data.entryCount === 0 ? (
              <p className="rounded-md border border-dashed border-rule p-4 type-body-sm text-ink-muted">
                No costs recorded yet. Add consultant fees, materials and site work as they are
                spent, and the margin follows.
              </p>
            ) : (
              <CostLedger
                projectId={project.id}
                entries={data.entries}
                entryCount={data.entryCount}
                today={today}
              />
            )}
          </div>
        )}
      </div>
      <RecordCostSheet
        projectId={project.id}
        projectName={project.name}
        open={recording}
        onOpenChange={setRecording}
        today={today}
      />
    </Card>
  );
}
