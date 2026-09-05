import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, MapPin, Building2, Users, CreditCard } from "lucide-react";
import { getAgencyDetail } from "@/lib/services/agencies";
import { requireSuperAdmin } from "@/lib/auth/session";
import { StatusActions } from "./status-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgencyStatusBadge, Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function AgencyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;
  const detail = await getAgencyDetail(id);
  if (!detail) notFound();

  const { agency, owner, members, subscription, settings } = detail;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/super-admin/agencies">
          <ArrowLeft /> Back to agencies
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-lg font-semibold text-primary">
            {agency.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{agency.name}</h1>
              <AgencyStatusBadge status={agency.status} />
            </div>
            <p className="text-sm text-muted-foreground">/{agency.slug}</p>
          </div>
        </div>
        <StatusActions agencyId={agency.id} current={agency.status} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Overview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4" /> Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Info icon={Mail} label="Email" value={agency.email} />
            <Info icon={Phone} label="Phone" value={agency.phone} />
            <Info icon={MapPin} label="City" value={[agency.city, agency.country].filter(Boolean).join(", ") || null} />
            <Info label="Currency" value={agency.currency} />
            <Info label="Timezone" value={agency.timezone} />
            <Info label="Created" value={formatDate(agency.created_at)} />
            {settings && <Info label="Tax rate" value={`${settings.tax_rate}%`} />}
            {settings && (
              <Info label="Default deposit" value={formatCurrency(Number(settings.default_deposit), agency.currency)} />
            )}
            {agency.address && (
              <div className="sm:col-span-2">
                <Info icon={MapPin} label="Address" value={agency.address} />
              </div>
            )}
            {agency.notes && (
              <div className="sm:col-span-2 rounded-md bg-muted/50 p-3 text-sm">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Internal notes</p>
                {agency.notes}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscription + owner */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="size-4" /> Subscription
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {subscription ? (
                <>
                  <Row label="Plan" value={subscription.planName ?? "—"} />
                  <Row
                    label="Status"
                    value={<Badge variant="secondary">{subscription.status}</Badge>}
                  />
                  <Row label="Amount" value={formatCurrency(Number(subscription.amount), agency.currency)} />
                  <Row label="Started" value={formatDate(subscription.started_at)} />
                  <Row label="Ends" value={formatDate(subscription.ends_at)} />
                </>
              ) : (
                <p className="text-muted-foreground">No subscription.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Owner</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {owner ? (
                <>
                  <p className="font-medium">{owner.name ?? "—"}</p>
                  <p className="text-muted-foreground">{owner.email}</p>
                  {owner.phone && <p className="text-muted-foreground">{owner.phone}</p>}
                </>
              ) : (
                <p className="text-muted-foreground">No owner assigned.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" /> Users ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{m.email}</TableCell>
                  <TableCell>{m.roleName}</TableCell>
                  <TableCell>
                    <Badge variant={m.status === "active" ? "success" : "secondary"}>{m.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon?: typeof Mail; label: string; value: string | null }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="size-3.5" />} {label}
      </p>
      <p className="mt-0.5 text-sm">{value ?? "—"}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
