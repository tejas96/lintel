'use client';

import { Button, Field, Input, SegmentedControl, Select, Sheet } from '@lintel/design-system/web';
import { DOCUMENT_FOLDERS, type DocumentFolder, type DocumentVisibility } from '@lintel/domain';
import { LockKeyhole, Users } from 'lucide-react';
import { useState } from 'react';
import { FOLDER_ICONS, folderLabel } from './document-presentation';
import { FileDropZone } from './file-drop-zone';
import { useDocumentMutations } from './use-documents';

function titleFromName(name: string): string {
  return name
    .replace(/\.[a-z0-9]{1,5}$/i, '')
    .replace(/_+/g, ' ')
    .trim();
}

const FOLDER_OPTIONS = DOCUMENT_FOLDERS.map((value) => {
  const Icon = FOLDER_ICONS[value];
  return { value, label: folderLabel(value), icon: <Icon aria-hidden /> };
});

/**
 * Add a document: choose or drop one file, name it, file it in a folder and
 * say who may see it. The server checks the file's real type and size.
 */
export function UploadDocumentSheet({
  projectId,
  open,
  onOpenChange,
  canUploadConfidential,
  defaultFolder,
}: {
  readonly projectId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly canUploadConfidential: boolean;
  readonly defaultFolder: DocumentFolder;
}) {
  const { upload } = useDocumentMutations(projectId);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState<DocumentFolder>(defaultFolder);
  const [visibility, setVisibility] = useState<DocumentVisibility>('project');
  const [error, setError] = useState<string | null>(null);
  const reset = () => {
    setFile(null);
    setTitle('');
    setFolder(defaultFolder);
    setVisibility('project');
    setError(null);
  };
  const choose = (chosen: File) => {
    setFile(chosen);
    setError(null);
    if (!title.trim()) setTitle(titleFromName(chosen.name));
  };
  const submit = () => {
    if (!file) {
      setError('Choose a file to add.');
      return;
    }
    upload.mutate(
      { file, title: title.trim(), folder, visibility },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      },
    );
  };
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setFolder(defaultFolder);
        else reset();
        onOpenChange(next);
      }}
      title="Add a document"
      description="Drawings, contracts, mood boards and site photos for the whole project."
      footer={
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" pending={upload.isPending} onClick={submit}>
            Add document
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6 p-5 sm:p-6">
        <Field label="File" error={error} required>
          <FileDropZone file={file} onFile={choose} />
        </Field>
        <Field
          label="Title"
          hint="How the team will find it. Taken from the file name if left empty."
        >
          <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} />
        </Field>
        <Field label="Folder">
          <Select value={folder} onValueChange={setFolder} options={FOLDER_OPTIONS} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <p className="type-label text-ink-muted">Who can see it</p>
          <SegmentedControl
            label="Who can see it"
            value={visibility}
            onValueChange={setVisibility}
            options={[
              { value: 'project', label: 'Everyone on the project', icon: <Users aria-hidden /> },
              ...(canUploadConfidential
                ? [
                    {
                      value: 'confidential' as const,
                      label: 'Confidential',
                      icon: <LockKeyhole aria-hidden />,
                    },
                  ]
                : []),
            ]}
            className="self-start"
          />
          <p className="type-body-sm text-ink-faint">
            {canUploadConfidential
              ? 'Confidential documents, and their names, are visible only to project managers, the owner and administrators.'
              : 'Only the project manager can add confidential documents.'}
          </p>
        </div>
      </div>
    </Sheet>
  );
}
