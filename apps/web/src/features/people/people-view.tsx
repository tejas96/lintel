'use client';

import type { DirectoryEntry } from '@lintel/api-contracts';
import {
  Avatar,
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
  type TableColumn,
} from '@lintel/design-system/web';
import { ROLE_LABELS, ROLES, type Role } from '@lintel/domain';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { useDeferredValue, useState } from 'react';
import { useSession } from '@/features/session/session-provider';
import { api, expectStatus } from '@/lib/api/api-client';
import { describeError } from '@/lib/api/describe-error';
import { formatRelativeInstant } from '@/lib/format/dates';
import { queryKeys } from '@/lib/query/query-keys';
import { AddPersonDialog } from './add-person-dialog';

const COLUMNS: TableColumn<DirectoryEntry>[] = [
  {
    key: 'person',
    header: 'Person',
    primary: true,
    cell: (person) => (
      <span className="flex items-center gap-3">
        <Avatar name={person.fullName} hue={person.avatarHue} size="sm" decorative />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-ink">{person.fullName}</span>
          <span className="truncate type-body-sm text-ink-faint">
            {person.designation ?? ROLE_LABELS[person.role]}
          </span>
        </span>
      </span>
    ),
  },
  {
    key: 'role',
    header: 'Role',
    cell: (person) => <span className="text-ink-muted">{ROLE_LABELS[person.role]}</span>,
  },
  {
    key: 'team',
    header: 'Team',
    cell: (person) => <span className="text-ink-muted">{person.team?.name ?? 'No team'}</span>,
  },
  {
    key: 'reports',
    header: 'Reports to',
    hideOnPhone: true,
    cell: (person) => (
      <span className="text-ink-muted">{person.reportsTo?.fullName ?? 'Nobody'}</span>
    ),
  },
  {
    key: 'phone',
    header: 'Phone',
    hideOnPhone: true,
    cell: (person) => (
      <span className="font-mono text-[0.8125rem] text-ink-muted">{person.maskedPhone}</span>
    ),
  },
  {
    key: 'active',
    header: 'Last active',
    align: 'end',
    cell: (person) => (
      <span className="text-ink-faint">
        {person.status === 'deactivated'
          ? 'Deactivated'
          : person.lastActiveAt
            ? formatRelativeInstant(person.lastActiveAt)
            : 'Not yet'}
      </span>
    ),
  },
];

/** The studio directory: everyone, their role, team and who they report to. */
export function PeopleView() {
  const { can } = useSession();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | 'any'>('any');
  const [teamId, setTeamId] = useState('any');
  const [adding, setAdding] = useState(false);
  const deferred = useDeferredValue(search.trim());
  const teams = useQuery({
    queryKey: queryKeys.teams,
    queryFn: () => expectStatus(api.people.listTeams(), 200),
  });
  const query = {
    page: 1,
    pageSize: 100,
    status: 'active' as const,
    ...(deferred ? { search: deferred } : {}),
    ...(role !== 'any' ? { role } : {}),
    ...(teamId !== 'any' ? { teamId } : {}),
  };
  const people = useQuery({
    queryKey: queryKeys.people(query),
    queryFn: () => expectStatus(api.people.listPeople({ query }), 200),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="mx-auto flex w-full max-w-[84rem] flex-col gap-7 px-5 py-6 md:px-10 md:py-9">
      <motion.div {...pageEnter}>
        <PageHeader
          title="People"
          description={
            people.data
              ? `${people.data.totalItems} ${people.data.totalItems === 1 ? 'person' : 'people'} in the studio.`
              : 'Everyone in the studio.'
          }
          actions={
            can('users.manage') && (
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
            className="sm:w-48"
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
            className="sm:w-48"
          />
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
          description="Try a different name, or clear the role and team filters."
        />
      )}
      {people.data && people.data.items.length > 0 && (
        <ResponsiveTable
          caption="Studio people"
          columns={COLUMNS}
          rows={people.data.items}
          rowKey={(person) => person.id}
          className={people.isPlaceholderData ? 'opacity-60' : undefined}
        />
      )}
      {can('users.manage') && (
        <AddPersonDialog open={adding} onOpenChange={setAdding} teams={teams.data ?? []} />
      )}
    </div>
  );
}
