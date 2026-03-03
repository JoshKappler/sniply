export default function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden animate-pulse">
      {/* Hero image placeholder */}
      <div className="bg-gray-200 h-[200px]" />

      {/* Card body */}
      <div className="p-5 space-y-3">
        {/* Name */}
        <div className="h-5 bg-gray-200 rounded-md w-3/5" />

        {/* Stars + reviews */}
        <div className="flex items-center gap-2">
          <div className="h-4 bg-gray-200 rounded-md w-24" />
          <div className="h-4 bg-gray-200 rounded-md w-20" />
        </div>

        {/* Location */}
        <div className="h-4 bg-gray-200 rounded-md w-2/5" />

        {/* Badges row */}
        <div className="flex gap-2 pt-1">
          <div className="h-6 bg-gray-200 rounded-full w-24" />
          <div className="h-6 bg-gray-200 rounded-full w-16" />
        </div>

        {/* Specialty tags */}
        <div className="flex gap-1.5">
          <div className="h-5 bg-gray-200 rounded-full w-16" />
          <div className="h-5 bg-gray-200 rounded-full w-20" />
          <div className="h-5 bg-gray-200 rounded-full w-14" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
