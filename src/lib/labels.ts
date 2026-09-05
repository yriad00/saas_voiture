import type { Enums } from "@/lib/database.types";

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline";

// ============ VEHICLES ============
export const VEHICLE_STATUS: Record<Enums<"vehicle_status">, { label: string; variant: BadgeVariant }> = {
  AVAILABLE: { label: "Disponible", variant: "success" },
  RENTED: { label: "Loué", variant: "default" },
  RESERVED: { label: "Réservé", variant: "secondary" },
  MAINTENANCE: { label: "En maintenance", variant: "warning" },
  OUT_OF_SERVICE: { label: "Hors service", variant: "destructive" },
};

export const FUEL_TYPE: Record<Enums<"fuel_type">, string> = {
  GASOLINE: "Essence",
  DIESEL: "Diesel",
  ELECTRIC: "Électrique",
  HYBRID: "Hybride",
  LPG: "GPL",
};

export const TRANSMISSION: Record<Enums<"transmission_type">, string> = {
  MANUAL: "Manuelle",
  AUTOMATIC: "Automatique",
};

export const VEHICLE_CATEGORY: Record<string, string> = {
  sedan: "Berline",
  suv: "SUV",
  hatchback: "Citadine",
  minivan: "Monospace",
  pickup: "Pick-up",
  coupe: "Coupé",
  convertible: "Cabriolet",
  van: "Fourgon",
  truck: "Camion",
  luxury: "Luxe",
  economy: "Économique",
};

// ============ CUSTOMERS ============
export const ID_DOCUMENT_TYPE: Record<Enums<"id_document_type">, string> = {
  CIN: "CIN",
  PASSPORT: "Passeport",
  DRIVER_LICENSE: "Permis de conduire",
  RESIDENCE_CARD: "Carte de séjour",
};

// ============ RESERVATIONS ============
export const RESERVATION_STATUS: Record<Enums<"reservation_status">, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: "En attente", variant: "warning" },
  CONFIRMED: { label: "Confirmée", variant: "default" },
  ONGOING: { label: "En cours", variant: "success" },
  COMPLETED: { label: "Terminée", variant: "secondary" },
  CANCELLED: { label: "Annulée", variant: "destructive" },
};

// ============ CONTRACTS ============
export const CONTRACT_STATUS: Record<Enums<"contract_status">, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: "Brouillon", variant: "secondary" },
  ACTIVE: { label: "Actif", variant: "success" },
  CLOSED: { label: "Clôturé", variant: "default" },
  CANCELLED: { label: "Annulé", variant: "destructive" },
};

// ============ PAYMENTS ============
export const PAYMENT_METHOD: Record<Enums<"payment_method">, string> = {
  CASH: "Espèces",
  CARD: "Carte bancaire",
  TRANSFER: "Virement",
  CHECK: "Chèque",
};

export const PAYMENT_TYPE: Record<Enums<"payment_type">, string> = {
  DEPOSIT: "Caution",
  RENTAL: "Location",
  REFUND: "Remboursement",
  PENALTY: "Pénalité",
  EXTRA: "Supplément",
};

export const PAYMENT_STATUS: Record<Enums<"payment_status">, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: "En attente", variant: "warning" },
  COMPLETED: { label: "Payé", variant: "success" },
  REFUNDED: { label: "Remboursé", variant: "secondary" },
  FAILED: { label: "Échoué", variant: "destructive" },
};

// ============ MAINTENANCE ============
export const MAINTENANCE_TYPE: Record<Enums<"maintenance_type">, string> = {
  OIL_CHANGE: "Vidange",
  TIRES: "Pneus",
  INSPECTION: "Contrôle technique",
  REPAIR: "Réparation",
  CLEANING: "Nettoyage",
  OTHER: "Autre",
};

export const MAINTENANCE_STATUS: Record<Enums<"maintenance_status">, { label: string; variant: BadgeVariant }> = {
  SCHEDULED: { label: "Planifiée", variant: "warning" },
  IN_PROGRESS: { label: "En cours", variant: "default" },
  COMPLETED: { label: "Terminée", variant: "success" },
  CANCELLED: { label: "Annulée", variant: "destructive" },
};
