# FleetHub — audit fonctionnel et architecture (historique)

> Cette matrice décrit l’audit de l’itération précédente. Elle est conservée comme historique. Le verdict et les preuves de l’audit final du 15 septembre 2026 sont dans le rapport de session ; les validations historiques ne doivent pas être lues comme une exécution E2E actuelle sur la base de production.

## Découverte

- **Stack** : Next.js 16 App Router, React 19, TypeScript, Tailwind, Zod, Supabase SSR et Supabase Postgres/Storage.
- **Architecture** : pages Server Components, formulaires Client Components, Server Actions pour les mutations, services métier dans `src/lib/services`, accès Supabase scopé par session.
- **Authentification** : Supabase Auth avec middleware de rafraîchissement de session, profils et memberships d’agence.
- **Autorisation** : rôles `AGENCY_OWNER`, `MANAGER`, `AGENT`, `ACCOUNTANT`, `DRIVER`, `CLIENT`, permissions `role_permissions`, RLS d’agence. Les mutations principales utilisent un garde permission serveur et la migration `0009_rls_hardening.sql` contraint désormais les `UPDATE` avec `USING` + `WITH CHECK`.
- **Entités existantes** : agencies, agency_members, agency_settings, customers, vehicles, reservations, contracts, payments, maintenance_records, expenses, invoices, contract_inspections, contract_inspection_photos, audit_logs, plans, subscriptions.
- **Pages métier existantes** : dashboard, flotte, clients, réservations, calendrier, contrats, paiements, dépenses, maintenance, rentabilité, équipe, paramètres, portail client minimal et espace driver.
- **Intégrations existantes** : Supabase Auth, Postgres, RLS, Storage privé pour photos de contrat, génération de factures et impression. Aucun fournisseur WhatsApp, paiement en ligne, GPS ou e-signature externe n’est branché.

## Matrice des fonctionnalités

| Feature | État | Existant | Manquant / priorité |
|---|---|---|---|
| Dashboard, alertes, opérations du jour | ✅ Complète pour le périmètre actuel | KPIs réels, revenus/charges, utilisation, retards, documents véhicule, soldes, cautions | Centre persistant lu/non-lu à prévoir en P2 |
| Flotte | 🟡 Partielle | CRUD, statut, kilométrage, tarif journalier, dates assurance/visite | Photos, documents, prix semaine/mois, achat/financement, agences/branches — P1/P2 |
| Calendrier disponibilité | 🟡 Partielle | Vue mensuelle des réservations, contrôles serveur et contrainte Postgres anti-chevauchement | Vue véhicule/jour/semaine, maintenance/blocages, drag-and-drop — P1 |
| Réservations | 🟡 Partielle | Client, véhicule, dates, montant, remise, lieux, transitions, audit | Heure, source, extras, taxes, branche, lead/no-show — P1 |
| CRM clients | 🟡 Partielle | Identité, téléphone, email, permis, adresse, notes, import Excel, blacklist privée par agence et avertissement serveur, documents stockés en bucket privé avec Storage/RLS | Historique financier consolidé, expiration CIN/passeport — P1/P2 |
| Contrats / locations | 🟡 Partielle | Création depuis réservation, activation/clôture, chevauchements, inspection départ/retour | PDF/email/WhatsApp, signature canvas, charges de retour détaillées — P1 |
| Photos et contrôles | 🟡 Partielle | Storage privé, contrôle départ/retour, signatures textuelles, photos | Diagramme dégâts, pneus/accessoires, vraie signature électronique — P1/P2 |
| Paiements / cautions | 🟡 Partielle | Paiements partiels, remboursements contrôlés, cautions, audit et idempotency key par agence | Caisse, rapprochement, reçu/quote, gateway en ligne — P1/P2 |
| Factures | 🟡 Partielle | Numérotation agence, TVA, snapshot, impression | Devis, reçu dédié, PDF export et envoi — P2 |
| Maintenance / dépenses | 🟡 Partielle | Interventions, statut, kilométrage, prochaine date, dépenses liées véhicule, rentabilité mensuelle | Prochaine échéance kilométrique, garages fournisseurs, pièces/main-d’œuvre — P2 |
| Employés / permissions | 🟡 Partielle | Rôles, permissions en base, invitations, activation/désactivation, gardes serveur principaux | Éditeur de permissions, branche par membre, tests d’accès automatisés — P0/P1 |
| Audit trail | 🟡 Partielle | Journal agence, acteur, action, entité, métadonnées, événements financiers | Before/after structuré, IP/device selon politique — P1 |
| Multi-tenant | 🟡 Partielle | `agency_id` dans les entités, filtres serveur, RLS et Storage par agence | Branches et isolation par branche, tests d’IDOR exhaustifs — P0/P1 |
| Import / export | 🟡 Partielle | Import clients/véhicules xlsx/xls/csv avec aperçu et validation, export CSV/Excel clients et flotte | Export PDF et modèles avancés — P2 |
| Leads | ⚪ Interface retirée à la demande | Table/migration Supabase conservée pour préserver les données existantes | Réactiver un pipeline CRM uniquement si nécessaire |
| Dégâts / accidents / amendes | ❌ Absente | Notes de dommage dans inspection | Entités dédiées, photos, coûts, assurance, rattachement contrat — P1/P2 |
| Livraisons / tâches / préparation | ❌ Absente | Espace driver placeholder | Missions, statuts, checklist préparation et notifications — P1/P2 |
| Branches / transferts | ❌ Absente | `branch_id` préparé dans membership mais pas de module | Branches, transferts, permissions par branche — P1 |
| Notifications / WhatsApp / SMS | ❌ Absente | Liens d’alerte dashboard uniquement | Centre notification et adaptateurs officiels — P2 |
| GPS / paiement en ligne / API publique | 🟡 Configuration véhicule livrée | GPS par véhicule (activation, fournisseur, identifiant boîtier, lien de suivi, dernière position) ; aucun fournisseur ou webhook GPS encore connecté | Intégrer les APIs GPS et webhooks vérifiés — P3 |
| Portail client / booking public | ❌ Absente | Portail minimal | Disponibilité publique, documents et paiement — P1/P3 |
| Sécurité / qualité | 🟡 Partielle | Zod, RLS, soft delete, contraintes anti-double booking, audit, `npm audit` propre | Rate limiting, 2FA readiness, tests E2E d’isolation, sauvegarde/rollback — P0/P1 |

## Travail réalisé dans cette itération

1. Dashboard enrichi avec des métriques calculées depuis Supabase : disponibilité, réservations du jour, prises en charge, retours, retards, locations actives, impayés, cautions, revenus, charges, résultat et taux d’utilisation.
2. Alertes réelles pour retours en retard, soldes impayés, assurance/visite technique expirée ou proche de l’expiration et maintenance imminente.
3. Widget « Opérations du jour » avec liens vers les écrans concernés.
4. Garde serveur `requireAgencyPermission()` et application aux créations/modifications sensibles : clients, véhicules, réservations, contrats, paiements, factures, dépenses, maintenance, équipe et paramètres.
5. Import Excel clients/véhicules déjà livré : aperçu, validation, modèle, dédoublonnage intra-fichier, contrôle d’immatriculation et limites d’abonnement.
6. Pipeline Prospects réalisé puis désactivé de l’interface à la demande ; la table Supabase reste conservée pour éviter une suppression de données.

## Priorités restantes

### P0 — sécurité et intégrité

- Ajouter des tests automatisés d’isolation agence A/agence B sur chaque table exposée et Storage.
- Compléter les règles par branche selon le modèle de permissions final ; les politiques `UPDATE` des entités métier sensibles sont maintenant protégées par `USING` + `WITH CHECK`.
- Ajouter rate limiting côté IP/login et couvrir les dernières Server Actions sensibles ; les mutations réservation, paiement, flotte, invitation et upload document sont déjà limitées.
- Ajouter une procédure de backup/rollback documentée et vérifier les contraintes en staging.

### P1 — workflow location

- Créer les tables et écrans Dégâts/Accidents, Branches, Livraisons et préparation véhicule.
- Ajouter les frais de restitution (retard, carburant, kilométrage, nettoyage, dégâts) dans la clôture du contrat.
- Remplacer le calendrier mensuel par une vue par véhicule avec réservations, contrats actifs et maintenance.
- Ajouter l’historique client consolidé et l’expiration CIN/passeport ; la blacklist privée et les documents client privés avec avertissement serveur sont maintenant livrés.

### P2 — opérations et finance

- Ajouter extras, tarifs semaine/mois/saisonnalité, devis/reçus, caisse, garages/fournisseurs et exports.
- Ajouter centre de notifications persistant et rappels email via un fournisseur officiel.
- Ajouter l’expiration des documents véhicule/client et les flux d’archivage/renouvellement.

### P3 — extensions SaaS

- Ajouter portail client, booking public, gateway de paiement, GPS, API versionnée et connecteurs comptables.
- Ajouter analytics par véhicule/branche/source, ROI et prévisions de demande.

## Fonctionnalités complémentaires recommandées

- **Idempotency keys** sur les paiements et unicité des factures émises par contrat sont livrées ; les webhooks auront leur clé dans l’outbox P2.
- **Outbox d’événements** : permet de déclencher email/WhatsApp/GPS sans bloquer une réservation (P2).
- **Journal de numérotation configurable** : réserve les références par agence avec une séquence transactionnelle (P1).
- **Tests de parcours critiques** : réservation concurrente, véhicule en maintenance, impayé, remboursement et cross-tenant (P0).
