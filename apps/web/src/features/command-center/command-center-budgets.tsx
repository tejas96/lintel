'use client';

import type { PortfolioProfitability } from '@lintel/api-contracts';
import { Card, CardHeader, listItemEnter, StatusPill } from '@lintel/design-system/web';
import { motion } from 'motion/react';
import Link from 'next/link';
import { BudgetBar } from '@/features/finances/budget-bar';
import {
  describeMargin,
  formatMoney,
  MARGIN_PRESENTATION,
} from '@/features/finances/finance-presentation';
import { ProjectChip } from '@/features/tasks/task-presentation';

function Figure({
  label,
  value,
  detail = null,
}: {
  readonly label: string;
  readonly value: string;
  readonly detail?: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="type-body-sm text-ink-muted">{label}</dt>
      <dd className="truncate font-mono text-[1.0625rem] text-ink tabular-nums">{value}</dd>
      {detail && <dd className="type-body-sm text-ink-faint">{detail}</dd>}
    </div>
  );
}

/** Budget against recorded cost across the projects in view, most attention first. */
export function CommandCenterBudgets({
  portfolio,
}: {
  readonly portfolio: PortfolioProfitability;
}) {
  const money = (minor: number | null) =>
    minor === null ? '—' : formatMoney(minor, portfolio.currency);
  const attention = [
    portfolio.projectsOverBudget > 0 && `${portfolio.projectsOverBudget} over budget`,
    portfolio.projectsThinMargin > 0 && `${portfolio.projectsThinMargin} with a thin margin`,
  ].filter(Boolean);
  return (
    <Card>
      <CardHeader
        title="Budgets"
        description={
          portfolio.projectsWithBudget === 0
            ? 'No project in this view has a budget yet.'
            : `Recorded cost against budget on ${portfolio.projectsWithBudget} ${portfolio.projectsWithBudget === 1 ? 'project' : 'projects'}${attention.length > 0 ? `: ${attention.join(', ')}` : ''}.`
        }
        action={
          portfolio.projectsWithBudget > 0 && (
            <StatusPill
              tone={MARGIN_PRESENTATION[portfolio.indicator].tone}
              glyph={MARGIN_PRESENTATION[portfolio.indicator].glyph}
              label={MARGIN_PRESENTATION[portfolio.indicator].label}
              size="sm"
            />
          )
        }
      />
      {portfolio.projectsWithBudget > 0 && (
        <dl className="grid grid-cols-3 gap-4 border-b border-hairline px-5 pb-4">
          <Figure label="Budget" value={money(portfolio.budgetMinor)} />
          <Figure label="Recorded cost" value={money(portfolio.recordedCostMinor)} />
          <Figure
            label="Remaining"
            value={money(portfolio.remainingMinor)}
            detail={describeMargin(portfolio.marginRatio)}
          />
        </dl>
      )}
      <ul className="flex flex-col px-2 py-2">
        {portfolio.projects.map((row, index) => {
          const margin = MARGIN_PRESENTATION[row.indicator];
          return (
            <motion.li
              key={row.project.id}
              {...listItemEnter(index)}
              className="relative flex flex-col gap-2 rounded-md px-3 py-3 hover:bg-sunken/60"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link
                  href={`/projects/${row.project.id}`}
                  className="lt-stretched-link min-w-0 flex-1 rounded-sm"
                >
                  <ProjectChip project={row.project} className="text-ink" />
                </Link>
                <StatusPill
                  tone={margin.tone}
                  glyph={margin.glyph}
                  label={margin.label}
                  size="sm"
                />
              </div>
              <BudgetBar
                budgetMinor={row.budgetMinor}
                recordedCostMinor={row.recordedCostMinor}
                indicator={row.indicator}
                size="sm"
              />
              <p className="flex flex-wrap justify-between gap-x-4 type-body-sm text-ink-muted">
                <span className="font-mono tabular-nums">
                  {money(row.recordedCostMinor)}
                  <span className="text-ink-faint"> of {money(row.budgetMinor)}</span>
                </span>
                {row.remainingMinor !== null && (
                  <span className="font-mono tabular-nums">
                    {row.remainingMinor < 0
                      ? `${money(-row.remainingMinor)} over`
                      : `${money(row.remainingMinor)} left`}
                  </span>
                )}
              </p>
            </motion.li>
          );
        })}
      </ul>
    </Card>
  );
}
