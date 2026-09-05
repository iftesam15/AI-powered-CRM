import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeletons mirror the real layout so the page does not reflow when data lands.
 */
export default function DashboardLoading() {
  return (
    <>
      <div className="space-y-2 border-b pb-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>

      <Skeleton className="h-40 rounded-lg" />
    </>
  );
}
