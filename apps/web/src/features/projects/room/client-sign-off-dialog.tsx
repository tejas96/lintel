'use client';

import type { ScopeChangeDetail } from '@lintel/api-contracts';
import {
  Button,
  DatePicker,
  Dialog,
  Field,
  Input,
  SegmentedControl,
  Textarea,
  useToast,
} from '@lintel/design-system/web';
import { CLIENT_SIGN_OFF_METHODS, type ClientSignOffMethod } from '@lintel/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, MessageSquareText, Phone, Users } from 'lucide-react';
import { useState } from 'react';
import { api, expectStatus } from '@/lib/api/api-client';
import { isApiError } from '@/lib/api/api-error';
import { queryKeys } from '@/lib/query/query-keys';
import { useFailureToast } from '@/lib/query/use-failure-toast';

const METHODS: Readonly<Record<ClientSignOffMethod, { label: string; icon: typeof Users }>> = {
  meeting: { label: 'Meeting', icon: Users },
  email: { label: 'Email', icon: Mail },
  call: { label: 'Call', icon: Phone },
  message: { label: 'Message', icon: MessageSquareText },
};

interface ClientSignOffDialogProps {
  readonly change: ScopeChangeDetail;
  readonly clientName: string;
  readonly today: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/** Records who at the client confirmed the change, when and how. Every record is kept. */
export function ClientSignOffDialog({
  change,
  clientName,
  today,
  open,
  onOpenChange,
}: ClientSignOffDialogProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fail = useFailureToast();
  const [name, setName] = useState(change.clientSignOffs[0]?.confirmedByName ?? clientName);
  const [method, setMethod] = useState<ClientSignOffMethod>('meeting');
  const [confirmedOn, setConfirmedOn] = useState<string | null>(today);
  const [note, setNote] = useState('');
  const record = useMutation({
    mutationFn: () =>
      expectStatus(
        api.planning.recordClientSignOff({
          params: { id: change.id },
          body: {
            confirmedByName: name.trim(),
            method,
            confirmedOn: confirmedOn ?? today,
            note: note.trim() === '' ? null : note.trim(),
          },
        }),
        201,
      ),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.scopeChanges(change.projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.approvals });
      toast({
        tone: 'success',
        title: 'Client sign-off recorded',
        description: `${updated.title} is ready for a decision.`,
      });
      onOpenChange(false);
    },
    onError: (error) => fail(error, 'record the sign-off'),
  });
  const errors = isApiError(record.error) ? record.error.fieldErrors() : {};
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      autoFocusField
      title="Record the client’s sign-off"
      description={`For “${change.title}”. Approval can go ahead once it is recorded.`}
      footer={
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            pending={record.isPending}
            disabled={name.trim().length < 2 || !confirmedOn}
            onClick={() => record.mutate()}
          >
            Record sign-off
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Who confirmed it" error={errors.confirmedByName} required>
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="type-body-sm font-medium text-ink">How</span>
          <SegmentedControl
            label="How the client confirmed it"
            value={method}
            onValueChange={setMethod}
            options={CLIENT_SIGN_OFF_METHODS.map((key) => {
              const { label, icon: Icon } = METHODS[key];
              return { value: key, label, icon: <Icon aria-hidden className="size-4" /> };
            })}
            className="max-w-full self-start overflow-x-auto"
          />
        </div>
        <Field label="When" error={errors.confirmedOn} required>
          <DatePicker value={confirmedOn} onValueChange={setConfirmedOn} today={today} />
        </Field>
        <Field
          label="Note"
          hint="Optional: the email subject, who was in the meeting, anything worth keeping."
        >
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={1000}
          />
        </Field>
      </div>
    </Dialog>
  );
}
