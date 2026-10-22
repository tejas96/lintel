'use client';

import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  pageEnter,
  ResponsiveTable,
  Select,
  SkeletonGroup,
  SkeletonText,
} from '@lintel/design-system/web';
import { ROLE_LABELS, ROLES, type Role } from '@lintel/domain';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { useDeferredValue, useMemo, useState } from 'react';
import { useSession } from '@/features/session/session-provider';
import { api, expectStatus } from '@/lib/api/api-client';
import { describeError } from '@/lib/api/describe-error';
import { queryKeys } from '@/lib/query/query-keys';
import { AddPersonDialog } from './add-person-dialog';
import { EditPersonSheet } from './edit-person-sheet';
import { peopleColumns } from './people-columns';

type StatusFilter = 'active' | 'deactivated' | 'all';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'deactivated', label: 'Deactivated' },
  { value: 'all', label: 'Everyone' },
] as const;

/** "10 people in the studio. Open anyone to change their role, team or manager." */
function describeDirectory(count: number, status: StatusFilter, manages: boolean): string {
  const noun = count === 1 ? 'person' : 'people';
  const where = { active: ' in the studio', deactivated: ' deactivated', all: '' }[status];
  const hint = manages ? ' Open anyone to change their role, team or manager.' : '';
  return `${count} ${noun}${where}.${hint}`;
}

/** The studio directory: everyone, their role, team and who they report to. */
export function PeopleView() {
  const { can } = useSession();
  const manages = can('users.manage');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | 'any'>('any');
  const [teamId, setTeamId] = useState('any');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  const deferred = useDeferredValue(search.trim());
  const teams = useQuery({
    queryKey: queryKeys.teams,
    queryFn: () => expectStatus(api.teams.listTeams({ query: { status: 'active' } }), 200),
  });
  const query = {
    page: 1,
    pageSize: 100,
    status,
    ...(deferred ? { search: deferred } : {}),
    ...(role !== 'any' ? { role } : {}),
    ...(teamId !== 'any' ? { teamId } : {}),
  };
  const people = useQuery({
    queryKey: queryKeys.people(query),
    queryFn: () => expectStatus(api.people.listPeople({ query }), 200),
    placeholderData: keepPreviousData,
  });
  const columns = useMemo(
    () => peopleColumns(manages ? (person) => setEditing({ open: true, id: person.id }) : null),
    [manages],
  );
  const selected = people.data?.items.find((person) => person.id === editing.id) ?? null;

  return (
    <div className="mx-auto flex w-full max-w-[84rem] flex-col gap-7 px-5 py-6 md:px-10 md:py-9">
      <motion.div {...pageEnter}>
        <PageHeader
          title="People"
          description={
            people.data
              ? describeDirectory(people.data.totalItems, status, manages)
              : 'Everyone in the studio.'
          }
          actions={
            manages && (
              <Button
                variant="primary"
                leadingIcon={<UserPlus aria-hidden />}
                onClick={() => setAdding(true)}
              >
                Add a person
              </Button>
            )
          }
        />
      </motion.div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-80">
          <Input
            type="search"
            aria-label="Search people"
            placeholder="Search by name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            leading={<Search aria-hidden />}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select
            label="Role"
            value={role}
            onValueChange={setRole}
            options={[
              { value: 'any', label: 'Every role' },
              ...ROLES.map((value) => ({ value, label: ROLE_LABELS[value] })),
            ]}
            className="sm:w-44"
          />
          <Select
            label="Team"
            value={teamId}
            onValueChange={setTeamId}
            options={[
              { value: 'any', label: 'Every team' },
              ...(teams.data ?? []).map((team) => ({
                value: team.id,
                label: `${team.name} (${team.memberCount})`,
              })),
            ]}
            className="sm:w-44"
          />
          {manages && (
            <Select
              label="Status"
              value={status}
              onValueChange={setStatus}
              options={STATUS_OPTIONS}
              className="col-span-2 sm:w-40"
            />
          )}
        </div>
      </div>
      {people.isPending && (
        <SkeletonGroup label="Loading people">
          <SkeletonText lines={8} />
        </SkeletonGroup>
      )}
      {people.isError && !people.data && (
        <ErrorState
          {...describeError(people.error, { resource: 'collection' })}
          onRetry={() => people.refetch()}
        />
      )}
      {people.data && people.data.items.length === 0 && (
        <EmptyState
          drawing="chair"
          title="Nobody matches"
          description="Try a different name, or clear the role, team and status filters."
        />
      )}
      {people.data && people.data.items.length > 0 && (
        <ResponsiveTable
          caption="Studio people"
          columns={columns}
          rows={people.data.items}
          rowKey={(person) => person.id}
          className={people.isPlaceholderData ? 'opacity-60' : undefined}
        />
      )}
      {manages && (
        <>
          <AddPersonDialog open={adding} onOpenChange={setAdding} teams={teams.data ?? []} />
          <EditPersonSheet
            person={selected}
            open={editing.open}
            onOpenChange={(open) => setEditing((current) => ({ ...current, open }))}
            teams={teams.data ?? []}
            onRefresh={() => void people.refetch()}
          />
        </>
      )}
    </div>
  );
}
