export default function AgencyLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="fh-skeleton h-7 w-48" />
          <div className="fh-skeleton h-4 w-64" />
        </div>
        <div className="fh-skeleton h-9 w-36 rounded-md" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="fh-skeleton h-[88px] rounded-lg" />
        ))}
      </div>

      {/* Table */}
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="fh-skeleton h-8 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="fh-skeleton h-10 w-full" style={{ opacity: 1 - i * 0.12 }} />
        ))}
      </div>
    </div>
  );
}
