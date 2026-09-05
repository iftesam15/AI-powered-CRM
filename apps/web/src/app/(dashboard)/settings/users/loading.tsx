import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 border-b pb-5">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-[52ch] max-w-full" />
      </div>
      <Skeleton className="h-9 w-full max-w-2xl" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
