import { Skeleton, SkeletonGroup } from '@lintel/design-system/web';

/** The shape of Today while the queue loads (visible only after 300 ms). */
export function TodaySkeleton() {
  return (
    <SkeletonGroup label="Loading your work for today" className="flex flex-col gap-8">
      <Skeleton className="h-72 w-full rounded-xl" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex items-center gap-3 py-2">
              <Skeleton className="size-4 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
              </div>
              <Skeleton className="h-9 w-20" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </SkeletonGroup>
  );
}
