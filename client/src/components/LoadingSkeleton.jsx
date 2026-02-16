function SkeletonLine({ className = '' }) {
  return <div className={`bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${className}`} />;
}

function TaskSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
          <SkeletonLine className="w-6 h-6 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonLine className="h-4 w-3/4" />
            <SkeletonLine className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <SkeletonLine className="h-8 w-48" />
      <SkeletonLine className="h-10 w-full" />
      <div className="space-y-3">
        <SkeletonLine className="h-4 w-full" />
        <SkeletonLine className="h-4 w-5/6" />
        <SkeletonLine className="h-4 w-4/6" />
      </div>
    </div>
  );
}

function LoadingSkeleton({ type = 'page' }) {
  if (type === 'tasks') return <TaskSkeleton />;
  return <PageSkeleton />;
}

export default LoadingSkeleton;
