/* eslint-disable @typescript-eslint/no-explicit-any */
import { formatCurrency, formatDate } from "@/lib/utils";

type ContractPrintDocumentProps = {
  agency: any;
  agencyExtra: Record<string, unknown>;
  contract: any;
  extras: any[];
  deposit: any;
  signatures: any[];
};

function value(value: unknown, fallback = "—") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function money(valueToFormat: unknown, currency = "MAD") {
  return formatCurrency(Number(valueToFormat ?? 0), currency);
}

export function ContractPrintDocument({ agency, agencyExtra, contract, extras, deposit, signatures }: ContractPrintDocumentProps) {
  const language = contract.contract_language ?? "FR";
  const arabicOnly = language === "AR";
  const showFrench = language !== "AR";
  const showArabic = language !== "FR";
  const currency = agency?.currency ?? "MAD";
  const customer = contract.customer;
  const customerSignature = signatures.find((item) => item.signer_type === "CUSTOMER");
  const employeeSignature = signatures.find((item) => item.signer_type === "EMPLOYEE");
  const termsVersion = contract.terms_version ?? 1;

  return (
    <article className="contract-print-document mx-auto hidden max-w-[210mm] space-y-6 bg-white p-8 text-[11pt] text-black print:block" dir={arabicOnly ? "rtl" : "ltr"}>
      <header className="flex items-start justify-between gap-8 border-b-2 border-slate-900 pb-4">
        <div className="flex items-start gap-3">
          {agency?.logo_url && <img src={agency.logo_url} alt="Logo agence" className="h-16 w-16 object-contain" />}
          <div>
            <h1 className="text-xl font-bold">{value(agency?.name, "Agence de location")}</h1>
            <p>{[agency?.address, agency?.city].filter(Boolean).join(" · ")}</p>
            <p>{[agency?.phone, agency?.email].filter(Boolean).join(" · ")}</p>
            <p className="mt-1 text-xs">ICE : {value(agencyExtra.ice)} · IF : {value(agencyExtra.tax_id)} · RC : {value(agencyExtra.rc_number)}</p>
          </div>
        </div>
        <div className="text-right" dir="ltr">
          <p className="text-xs uppercase tracking-wide text-slate-600">{showFrench ? "Contrat de location" : "عقد كراء السيارة"}</p>
          <p className="font-mono text-xl font-bold">{contract.contract_number}</p>
          <p className="text-xs">{showFrench ? "Généré le" : "حرر في"} {formatDate(new Date().toISOString())}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-5">
        <div className="rounded border p-3">
          <h2 className="mb-2 font-semibold">{showFrench ? "Locataire" : "المكتري"}</h2>
          <p className="font-medium">{customer.name}</p>
          <p>{customer.phone ?? "—"}{customer.whatsapp ? ` · WhatsApp ${customer.whatsapp}` : ""}</p>
          <p>{customer.email ?? "—"}</p>
          <p>{customer.id_type === "PASSPORT" ? "Passeport" : "CIN"} : {value(customer.id_number)}</p>
          <p>Permis : {value(customer.driver_license_number)}{customer.driver_license_expiry ? ` · exp. ${customer.driver_license_expiry}` : ""}</p>
          {customer.nationality && <p>Nationalité : {customer.nationality}</p>}
        </div>
        <div className="rounded border p-3">
          <h2 className="mb-2 font-semibold">{showFrench ? "Véhicule" : "السيارة"}</h2>
          <p className="font-medium">{contract.vehicle.label} ({contract.vehicle.year ?? "—"})</p>
          <p className="font-mono">Immatriculation : {contract.vehicle.plate}</p>
          <p>Catégorie : {value(contract.vehicle.category)}</p>
          <p>Carburant : {value(contract.vehicle.fuel_type)} · boîte : {value(contract.vehicle.transmission)}</p>
        </div>
      </section>

      <section className="rounded border">
        <h2 className="border-b bg-slate-50 px-3 py-2 font-semibold">{showFrench ? "Période et lieux" : "المدة والأماكن"}</h2>
        <div className="grid grid-cols-2 gap-3 p-3">
          <p>Départ : <strong>{formatDate(contract.start_date)}</strong><br />{value(contract.pickupLocation)}</p>
          <p>Retour prévu : <strong>{formatDate(contract.end_date)}</strong><br />{value(contract.returnLocation)}</p>
        </div>
      </section>

      <section className="rounded border">
        <h2 className="border-b bg-slate-50 px-3 py-2 font-semibold">{showFrench ? "Montants" : "المبالغ"}</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 p-3">
          <p>{showFrench ? "Tarif journalier" : "السعر اليومي"} <strong>{money(contract.daily_rate, currency)}</strong></p>
          <p>{showFrench ? "Total location" : "مجموع الكراء"} <strong>{money(contract.financials?.rentalSubtotal ?? contract.base_total_amount ?? contract.total_amount, currency)}</strong></p>
          <p>{showFrench ? "Extras" : "خدمات إضافية"} <strong>{money(contract.extras_total, currency)}</strong></p>
          <p>{showFrench ? "Charges de retour" : "مصاريف الإرجاع"} <strong>{money(contract.financials?.returnChargesTotal, currency)}</strong></p>
          <p>{showFrench ? "Total final" : "المجموع النهائي"} <strong>{money(contract.financials?.grandTotal ?? contract.total_amount, currency)}</strong></p>
          <p>{showFrench ? "Avance encaissée" : "التسبيق"} <strong>{money(contract.rentalPaidTotal, currency)}</strong></p>
          <p>{showFrench ? "Solde restant" : "المبلغ المتبقي"} <strong>{money(contract.financials?.amountDue ?? Math.max(0, Number(contract.total_amount) - Number(contract.rentalPaidTotal)), currency)}</strong></p>
          <p>{showFrench ? "Caution" : "الضمان"} <strong>{money(contract.deposit_amount, currency)}</strong></p>
        </div>
      </section>

      {(extras ?? []).length > 0 && <section><h2 className="mb-2 font-semibold">{showFrench ? "Extras" : "خدمات إضافية"}</h2><ul className="list-disc ps-5">{extras.map((extra) => <li key={extra.id}>{extra.name} × {extra.quantity} — {money(extra.total_amount, currency)}</li>)}</ul></section>}

      <section className="grid grid-cols-2 gap-5 rounded border p-3">
        <div><h2 className="mb-2 font-semibold">{showFrench ? "État du véhicule" : "حالة السيارة"}</h2><p>Km départ : {value(contract.start_mileage)} · retour : {value(contract.end_mileage)}</p><p>Carburant : {value(contract.fuel_level_start)}/8 → {value(contract.fuel_level_end)}/8</p></div>
        <div><h2 className="mb-2 font-semibold">{showFrench ? "Caution" : "الضمان"}</h2><p>Statut : {value(deposit?.status)}</p><p>Détenue : {money(deposit?.held_amount, currency)} · déduite : {money(deposit?.deducted_amount, currency)}</p><p>Remboursée : {money(deposit?.refunded_amount, currency)}</p></div>
      </section>

      {(showFrench && contract.terms) && <section><h2 className="mb-2 font-semibold">Conditions générales · version {termsVersion}</h2><p className="whitespace-pre-wrap leading-relaxed">{contract.terms}</p></section>}
      {(showArabic && contract.terms_ar) && <section dir="rtl"><h2 className="mb-2 font-semibold">الشروط العامة · النسخة {termsVersion}</h2><p className="whitespace-pre-wrap leading-relaxed">{contract.terms_ar}</p></section>}

      <section className="grid grid-cols-2 gap-8 border-t pt-5">
        <SignatureBox label={showFrench ? "Signature du client" : "توقيع المكتري"} signature={customerSignature} />
        <SignatureBox label={showFrench ? "Signature de l'employé" : "توقيع الموظف"} signature={employeeSignature} />
      </section>
      <footer className="border-t pt-3 text-center text-[10px] text-slate-600">{showFrench ? "Document généré par FleetHub · Les conditions sont celles enregistrées au moment de la signature." : "تم إنشاء هذه الوثيقة بواسطة FleetHub · الشروط هي المسجلة عند التوقيع."}</footer>
    </article>
  );
}

function SignatureBox({ label, signature }: { label: string; signature?: any }) {
  return <div className="min-h-32 rounded border p-3"><p className="mb-2 font-semibold">{label}</p>{signature ? <><img src={signature.signature_data} alt={label} className="h-20 w-full object-contain" /><p className="mt-2 text-xs">{signature.signer_name} · v{signature.contract_version} · {formatDate(signature.signed_at)}</p></> : <p className="mt-12 text-xs text-slate-500">Signature non enregistrée</p>}</div>;
}
