import { Button, EmptyState } from '@lintel/design-system/web';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas">
      <EmptyState
        drawing="plan"
        title="This page isn’t on the plan"
        description="The address may be mistyped, or the page has moved. Today has everything that needs you."
        actions={
          <Button asChild variant="primary">
            <Link href="/today">Go to Today</Link>
          </Button>
        }
      />
    </main>
  );
}
