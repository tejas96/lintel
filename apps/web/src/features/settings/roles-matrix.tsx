'use client';

import { cn, ErrorState, SkeletonGroup, SkeletonText, useToast } from '@lintel/design-system/web';
import { CAPABILITIES, type Capability, ROLE_LABELS, type Role } from '@lintel/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Lock } from 'lucide-react';
import { api, expectStatus } from '@/lib/api/api-client';
import { describeError } from '@/lib/api/describe-error';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';

const AREAS: Readonly<Record<string, string>> = {
  organization: 'Studio',
  users: 'People',
  roles: 'Roles',
  projects: 'Projects',
  templates: 'Templates',
  tasks: 'Tasks',
  deliverables: 'Deliverables',
  scope_changes: 'Scope changes',
  leave: 'Leave',
  capacity: 'Capacity',
  rewards: 'Rewards',
  dashboard: 'Dashboard',
  audit: 'Audit log',
  files: 'Files',
  site_updates: 'Site updates',
};

function describeCapability(capability: Capability): { area: string; action: string } {
  const [area = '', action = ''] = capability.split('.');
  const words = action.replace(/_/g, ' ');
  return { area: AREAS[area] ?? area, action: words.charAt(0).toUpperCase() + words.slice(1) };
}

/** Who can do what. The owner always keeps everything. */
export function RolesMatrix() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  const roles = useQuery({
    queryKey: queryKeys.roles,
    queryFn: () => expectStatus(api.platform.getRoleCapabilities(), 200),
  });
  const update = useMutation({
    mutationFn: (input: { role: Role; capabilities: Capability[] }) =>
      expectStatus(
        api.platform.updateRoleCapabilities({
          params: { role: input.role },
          body: { capabilities: input.capabilities },
        }),
        200,
      ),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles });
      toast({ tone: 'success', title: `${ROLE_LABELS[saved.role]} access updated` });
    },
    onError: (error) => fail(error, 'change the access', [queryKeys.roles]),
  });
  if (roles.isPending)
    return (
      <SkeletonGroup label="Loading roles">
        <SkeletonText lines={8} />
      </SkeletonGroup>
    );
  if (roles.isError)
    return (
      <ErrorState
        {...describeError(roles.error, { resource: 'collection' })}
        onRetry={() => roles.refetch()}
      />
    );
  const toggle = (role: Role, capability: Capability, held: boolean) => {
    const current = roles.data.find((entry) => entry.role === role)?.capabilities ?? [];
    update.mutate({
      role,
      capabilities: held ? current.filter((item) => item !== capability) : [...current, capability],
    });
  };
  return (
    <div className="overflow-x-auto rounded-lg border border-hairline bg-raised">
      <table className="w-full min-w-[46rem] border-separate border-spacing-0">
        <caption className="sr-only">Capabilities by role</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 border-b border-hairline bg-raised px-4 py-3 text-left type-label font-medium text-ink-faint"
            >
              Can
            </th>
            {roles.data.map((entry) => (
              <th
                key={entry.role}
                scope="col"
                className="border-b border-hairline px-2 py-3 text-center type-label font-medium text-ink-muted"
              >
                {ROLE_LABELS[entry.role]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CAPABILITIES.map((capability) => {
            const { area, action } = describeCapability(capability);
            return (
              <tr key={capability} className="hover:bg-sunken/40">
                <th
                  scope="row"
                  className="sticky left-0 border-b border-hairline/70 bg-raised px-4 py-2 text-left font-normal"
                >
                  <span className="type-body-sm text-ink">{action}</span>
                  <span className="ml-2 type-body-sm text-ink-faint">{area}</span>
                </th>
                {roles.data.map((entry) => {
                  const held = entry.capabilities.includes(capability);
                  const locked = entry.role === 'owner';
                  return (
                    <td
                      key={entry.role}
                      className="border-b border-hairline/70 px-2 py-1 text-center"
                    >
                      <button
                        type="button"
                        aria-pressed={held}
                        aria-label={`${ROLE_LABELS[entry.role]}: ${action} (${area})`}
                        disabled={locked || update.isPending}
                        onClick={() => toggle(entry.role, capability, held)}
                        className={cn(
                          'inline-flex size-9 items-center justify-center rounded-md transition-colors',
                          held
                            ? 'text-accent hover:bg-accent-soft'
                            : 'text-ink-faint/40 hover:bg-sunken',
                          locked && 'cursor-not-allowed',
                        )}
                      >
                        {locked ? (
                          <Lock aria-hidden className="size-3.5 text-ink-faint" />
                        ) : held ? (
                          <Check aria-hidden className="size-4" />
                        ) : (
                          <span aria-hidden className="size-1.5 rounded-full bg-current" />
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
