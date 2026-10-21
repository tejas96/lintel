'use client';

import { Button, PageHeader, pageEnter, TabPanel, Tabs } from '@lintel/design-system/web';
import { CalendarPlus, Siren } from 'lucide-react';
import { motion } from 'motion/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { FirstRunTip } from '@/features/guidance/first-run-tip';
import { useSession } from '@/features/session/session-provider';
import { todayIn } from '@/lib/format/dates';
import { MyLeave } from './my-leave';
import { OthersLeave } from './others-leave';
import { RecordAbsenceSheet } from './record-absence-sheet';
import { RequestLeaveSheet } from './request-leave-sheet';
import { useLeaveList, useLeaveTypes } from './use-leave';

type LeaveTab = 'mine' | 'to-decide' | 'team';

function parseTab(value: string | null, allowed: readonly LeaveTab[]): LeaveTab {
  return allowed.find((tab) => tab === value) ?? 'mine';
}

/**
 * Leave for everyone: your own time off; for approvers, the requests waiting
 * on them and their team's leave; for managers, recording an urgent absence.
 */
export function LeaveView() {
  const { user, can } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const today = todayIn(user.timeZone);
  const types = useLeaveTypes();
  const approves = can('leave.approve_team', 'leave.approve_any');
  const seesTeam = approves || can('capacity.view_team');
  const allowed: LeaveTab[] = [
    'mine',
    ...(approves ? ['to-decide' as const] : []),
    ...(seesTeam ? ['team' as const] : []),
  ];
  const tab = parseTab(params.get('view'), allowed);
  const toDecide = useLeaveList('to_decide', approves);
  const [requesting, setRequesting] = useState(false);
  const [recording, setRecording] = useState(false);
  const waiting = toDecide.data?.totalItems;

  const select = (next: LeaveTab) =>
    router.replace(next === 'mine' ? pathname : `${pathname}?view=${next}`, { scroll: false });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-5 py-6 md:px-10 md:py-9">
      <motion.div {...pageEnter}>
        <PageHeader
          title="Leave"
          description={
            approves
              ? 'Your time off, and the requests that wait on your decision.'
              : 'Your time off, what’s left this year, and requests on their way to approval.'
          }
          actions={
            <>
              {can('leave.record_absence') && (
                <Button
                  leadingIcon={<Siren aria-hidden />}
                  onClick={() => setRecording(true)}
                  disabled={!types.data}
                >
                  Record an absence
                </Button>
              )}
              <Button
                variant="primary"
                leadingIcon={<CalendarPlus aria-hidden />}
                onClick={() => setRequesting(true)}
                disabled={!types.data}
              >
                Request leave
              </Button>
            </>
          }
        />
      </motion.div>
      <FirstRunTip tip="leave" />
      {allowed.length > 1 ? (
        <Tabs
          label="Whose leave"
          value={tab}
          onValueChange={select}
          items={[
            { value: 'mine', label: 'Mine' },
            ...(approves
              ? [
                  {
                    value: 'to-decide' as const,
                    label: 'To decide',
                    ...(waiting ? { count: waiting } : {}),
                  },
                ]
              : []),
            ...(seesTeam ? [{ value: 'team' as const, label: 'Team' }] : []),
          ]}
        >
          <TabPanel value="mine" className="pt-6 outline-none">
            <MyLeave today={today} />
          </TabPanel>
          <TabPanel value="to-decide" className="pt-6 outline-none">
            <OthersLeave scope="to_decide" today={today} />
          </TabPanel>
          <TabPanel value="team" className="pt-6 outline-none">
            <OthersLeave scope="team" today={today} />
          </TabPanel>
        </Tabs>
      ) : (
        <MyLeave today={today} />
      )}
      {types.data && (
        <RequestLeaveSheet
          open={requesting}
          onOpenChange={setRequesting}
          types={types.data}
          today={today}
        />
      )}
      {types.data && can('leave.record_absence') && (
        <RecordAbsenceSheet
          open={recording}
          onOpenChange={setRecording}
          types={types.data}
          today={today}
        />
      )}
    </div>
  );
}
