'use client';

import type { TemplateSummary } from '@lintel/api-contracts';
import {
  Button,
  Dialog,
  Field,
  Input,
  SegmentedControl,
  Select,
  Textarea,
  useToast,
} from '@lintel/design-system/web';
import { PROJECT_TYPE_LABELS, PROJECT_TYPES, type ProjectType } from '@lintel/domain';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { isApiError } from '@/lib/api/api-error';
import { useFailureToast } from '@/lib/query/use-failure-toast';
import { useCreateTemplate } from './use-template-admin';

interface NewTemplateDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Templates whose published version can be copied. */
  readonly templates: readonly TemplateSummary[];
}

/** Start a template from the built-in preset for a project type, or copy one you have. */
export function NewTemplateDialog({ open, onOpenChange, templates }: NewTemplateDialogProps) {
  const router = useRouter();
  const toast = useToast();
  const fail = useFailureToast();
  const create = useCreateTemplate();
  const copyable = templates.filter((template) => template.publishedVersion !== null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('residential_interior');
  const [source, setSource] = useState<'preset' | 'copy'>('preset');
  const [chosenCopy, setCopyFrom] = useState<string | undefined>(undefined);
  // The list may arrive after the dialog first renders; default to its first template.
  const copyFrom = chosenCopy ?? copyable[0]?.id;
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const copied = copyable.find((template) => template.id === copyFrom);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setErrors({ name: 'Name the template, for example “Villa interiors”.' });
      return;
    }
    create.mutate(
      {
        name: name.trim(),
        description: description.trim() || null,
        projectType,
        copyFromVersionId: source === 'copy' ? (copied?.publishedVersion?.id ?? null) : null,
      },
      {
        onSuccess: (detail) => {
          toast({
            tone: 'success',
            title: 'Template created',
            description: 'Its first draft is ready to edit.',
          });
          onOpenChange(false);
          router.push(`/templates/${detail.id}`);
        },
        onError: (error) => {
          if (isApiError(error)) setErrors(error.fieldErrors());
          fail(error, 'create the template');
        },
      },
    );
  };

  return (
    <Dialog
      autoFocusField
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="New workflow template"
      description="It starts as a draft. Nothing changes for projects until you publish it."
      footer={
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="new-template" variant="primary" pending={create.isPending}>
            Create draft
          </Button>
        </>
      }
    >
      <form id="new-template" onSubmit={submit} className="flex flex-col gap-4 py-2">
        <Field label="Name" error={errors.name} required>
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} />
        </Field>
        <Field
          label="Description"
          hint="Optional. Helps people pick the right one for a new project."
        >
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            maxLength={1000}
          />
        </Field>
        <Field label="Kind of project">
          <Select
            value={projectType}
            onValueChange={setProjectType}
            options={PROJECT_TYPES.map((type) => ({
              value: type,
              label: PROJECT_TYPE_LABELS[type],
            }))}
          />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="type-label text-ink-muted">Start from</span>
          <SegmentedControl
            label="Start from"
            value={source}
            onValueChange={setSource}
            options={[
              { value: 'preset', label: 'Lintel’s starting point' },
              { value: 'copy', label: 'A copy of a template' },
            ]}
            size="sm"
            className="self-start"
          />
          {source === 'preset' ? (
            <p className="type-body-sm text-ink-muted">
              Typical stages, tasks and checklists for{' '}
              {PROJECT_TYPE_LABELS[projectType].toLowerCase()} projects. Change anything before
              publishing.
            </p>
          ) : copyable.length === 0 ? (
            <p className="type-body-sm text-ink-muted">
              No template has a published version to copy yet.
            </p>
          ) : (
            <Field
              label="Template to copy"
              hint={
                copied?.publishedVersion
                  ? `Copies version ${copied.publishedVersion.versionNumber}: ${copied.publishedVersion.stageCount} stages, ${copied.publishedVersion.taskCount} tasks.`
                  : undefined
              }
              error={errors.copyFromVersionId}
            >
              <Select
                value={copyFrom}
                onValueChange={setCopyFrom}
                options={copyable.map((template) => ({ value: template.id, label: template.name }))}
              />
            </Field>
          )}
        </div>
      </form>
    </Dialog>
  );
}
