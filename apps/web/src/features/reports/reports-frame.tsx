'use client';

import { type ReportName, reportCsvPath } from '@lintel/api-contracts';
import {
  Button,
  ErrorState,
  PageHeader,
  pageEnter,
  SkeletonGroup,
  SkeletonText,
} from '@lintel/design-system/web';
import { Download } from 'lucide-react';
import { motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { InsightFilterBar } from '@/features/insights/insight-filter-bar';
import { useFilterOptions } from '@/features/insights/use-filter-options';
import { insightSearch, useInsightFilters } from '@/features/insights/use-insight-filters';
import { useSession } from '@/features/session/session-provider';
import { todayIn } from '@/lib/format/dates';
import { ReportTabs } from './report-tabs';

const SECTIONS: readonly { report: ReportName; label: string; title: string }[] = [
  { report: 'delivery', label: 'Delivery', title: 'delivery reliability' },
  { report: 'workload', label: 'Workload', title: 'workload and capacity' },
  { report: 'leave', label: 'Leave', title: 'leave taken' },
  { report: 'approvals', label: 'Approvals', title: 'approvals turnaround' },
  { report: 'estimates', label: 'Estimates', title: 'estimate accuracy' },
  { report: 'rework', label: 'Rework', title: 'rework rate' },
  { report: 'delays', label: 'Delays', title: 'approval delays' },
];

/**
 * The Reports area: one header, the shared filters (kept in the URL and
 * carried across the tabs) and a CSV download of the open report. The
 * server decides what each person may see; this frame only explains it.
 */
export function ReportsFrame({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const { user, can } = useSession();
  const today = todayIn(user.timeZone);
  const { filters, update, clear } = useInsightFilters();
  const options = useFilterOptions();
  const business = can('dashboard.view_business');
  const managesProjects = options.projects.length > 0;
  const allowed = business || user.role === 'project_manager' || managesProjects;
  // Until the project list arrives, someone who is neither leadership nor a manager is undecided.
  const deciding = !allowed && options.loading;
  const current = SECTIONS.find((section) => pathname.startsWith(`/reports/${section.report}`));
  const search = insightSearch(filters);
  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-6 px-5 py-6 md:px-10 md:py-9">
      <motion.div {...pageEnter}>
        <PageHeader
          title="Reports"
          description={
            business
              ? 'How reliably the studio delivers, how full people are, leave taken, how fast decisions are made and what history teaches about estimates, rework and waiting — counted from the records.'
              : allowed
                ? 'Delivery, workload, decisions, estimates, rework and waiting for the projects you manage, counted from the records.'
                : undefined
          }
        />
      </motion.div>
      {deciding ? (
        <SkeletonGroup label="Checking what you can see">
          <SkeletonText lines={3} />
        </SkeletonGroup>
      ) : !allowed ? (
        <ErrorState
          kind="forbidden"
          title="Reports are for the studio’s leadership and project managers"
          message="Your own work is on Today and your projects are under Projects. Ask a studio administrator if you need reports."
        />
      ) : (
        <>
          <ReportTabs
            activeKey={current?.report ?? null}
            items={SECTIONS.map((section) => ({
              href: `/reports/${section.report}${search}`,
              label: section.label,
              active: current?.report === section.report,
            }))}
          />
          <InsightFilterBar
            filters={filters}
            onChange={update}
            onClear={clear}
            options={options}
            today={today}
            defaultPeriodLabel="Last 90 days"
            ahead={current?.report === 'workload'}
            actions={
              current && (
                <Button asChild variant="secondary" size="md">
                  <a
                    href={`/api${reportCsvPath(current.report)}${search}`}
                    download
                    aria-label={`Download the ${current.title} report as CSV`}
                  >
                    <Download aria-hidden className="size-4" />
                    <span className="max-sm:hidden">Download CSV</span>
                    <span className="sm:hidden">CSV</span>
                  </a>
                </Button>
              )
            }
          />
          <div className="min-w-0">{children}</div>
        </>
      )}
    </div>
  );
}
