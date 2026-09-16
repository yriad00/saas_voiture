export default function ContractDetailLoading() {
  return (
    <div className="space-y-6" aria-label="Chargement du contrat">
      <div className="flex items-start justify-between gap-4 border-b pb-5">
        <div className="space-y-2">
          <div className="fh-skeleton h-5 w-44" />
          <div className="fh-skeleton h-8 w-56" />
          <div className="fh-skeleton h-4 w-72" />
        </div>
        <div className="fh-skeleton h-9 w-32 rounded-md" />
      </div>
      <div className="fh-skeleton h-20 w-full rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => <div key={index} className="space-y-3 rounded-xl border bg-card p-5"><div className="fh-skeleton h-5 w-28" /><div className="fh-skeleton h-4 w-40" /><div className="fh-skeleton h-4 w-24" /></div>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="space-y-3 rounded-xl border bg-card p-5"><div className="fh-skeleton h-5 w-36" /><div className="fh-skeleton h-16 w-full" /><div className="fh-skeleton h-4 w-48" /></div>)}
      </div>
    </div>
  );
}
