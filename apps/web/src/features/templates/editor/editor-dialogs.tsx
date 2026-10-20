'use client';

import type { TemplateDetail } from '@lintel/api-contracts';
import { Button, Dialog, useToast } from '@lintel/design-system/web';
import { useRouter } from 'next/navigation';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { draftOf } from '../template-types';
import { useArchiveTemplate } from '../use-template-admin';
import { PublishDialog } from './publish-dialog';
import { VersionHistory } from './version-history';

interface EditorDialogsProps {
  readonly dialog: 'publish' | 'history' | 'archive' | 'removeStage' | null;
  readonly onClose: () => void;
  readonly detail: TemplateDetail;
  readonly publishing: boolean;
  readonly onPublish: (notes: string | null) => void;
  readonly stageName: string;
  readonly onRemoveStage: () => void;
}

/** The editor's confirmations and side panels, one at a time. */
export function EditorDialogs({
  dialog,
  onClose,
  detail,
  publishing,
  onPublish,
  stageName,
  onRemoveStage,
}: EditorDialogsProps) {
  const router = useRouter();
  const toast = useToast();
  const fail = useFailureToast();
  const archive = useArchiveTemplate(detail.id);
  const close = (open: boolean) => !open && onClose();
  return (
    <>
      <PublishDialog
        key={draftOf(detail)?.version ?? 'new'}
        open={dialog === 'publish'}
        onOpenChange={close}
        detail={detail}
        pending={publishing}
        onPublish={onPublish}
      />
      <VersionHistory open={dialog === 'history'} onOpenChange={close} detail={detail} />
      <Dialog
        open={dialog === 'archive'}
        onOpenChange={close}
        size="sm"
        title="Archive this template?"
        description="New projects can no longer start from it. Projects already using it are not affected, and its history is kept."
        footer={
          <>
            <Button variant="quiet" onClick={onClose}>
              Keep it
            </Button>
            <Button
              variant="danger"
              pending={archive.isPending}
              onClick={() =>
                archive.mutate(undefined, {
                  onSuccess: () => {
                    toast({
                      tone: 'success',
                      title: 'Template archived',
                      description: detail.name,
                    });
                    router.push('/templates');
                  },
                  onError: (error) => fail(error, 'archive the template'),
                })
              }
            >
              Archive template
            </Button>
          </>
        }
      />
      <Dialog
        open={dialog === 'removeStage'}
        onOpenChange={close}
        size="sm"
        title={`Remove ${stageName || 'this stage'}?`}
        description="Its milestones and tasks go too, and other tasks stop waiting for them. Nothing is saved until you save the draft."
        footer={
          <>
            <Button variant="quiet" onClick={onClose}>
              Keep it
            </Button>
            <Button variant="danger" onClick={onRemoveStage}>
              Remove stage
            </Button>
          </>
        }
      />
    </>
  );
}
