# FleetHub roadmap produit

Ce document suit l’état réel du produit. Un module ne passe à `DONE` que lorsque sa base de données, son autorisation, sa logique métier, son interface et ses vérifications sont livrées ensemble.

| Module | Statut | Database | Backend | Frontend | Sécurité | Tests | Remaining gaps |
|---|---|---|---|---|---|---|---|
| Fondation multi-tenant | IN_PROGRESS | Agences, memberships, RLS existants ; migrations `0009` à `0032` | Guards `requireAgencyPermission`, filtres agence, audit, rate-limit Postgres | Layout agence et super-admin | `WITH CHECK`, Storage privé, isolation agence et branche | `npm run test:security` exécute 8 tests réels avec fixtures multi-agence et branch-limited | Login/IP rate limiting, auth leaked-password protection et advisors historiques |
| Authentification et permissions | IN_PROGRESS | RBAC et `role_permissions` existants | Permissions serveur sur les actions principales, rate-limit invitations | Équipe et rôles | Vérifier chaque action et l’exposition des RPC SECURITY DEFINER | Parcours navigateur login/settings/flotte | Rate limiting login/IP et matrice automatisée |
| Réservations et disponibilité | IN_PROGRESS | Exclusion PostgreSQL anti-chevauchement ; réservation catégorie sans véhicule, aller simple et `NO_SHOW` (`0064`) | Attribution tardive d’un véhicule, vérification serveur + synchronisation statut véhicule | Création rapide, catégorie à attribuer plus tard, branches départ/retour | Rejet maintenance/hors service et contrôle branche | Build + tests sécurité | Test concurrent automatisé et règles d’annulation |
| Moteur de disponibilité | DONE | `vehicle_blocks`, dateranges, triggers PostgreSQL et index FK, migrations `0028`–`0029` | Blocages Zod, rate-limit, audit, contrôle dans les réservations | Blocages actifs sur la fiche véhicule | RLS branch-scoped et verrou advisory par véhicule | Suite sécurité: blocage↔réservation dans les deux sens | Branch transfers et vue timeline à livrer ensuite |
| Calendrier véhicules | DONE | Requêtes indexées réservations/contrats/maintenance/blocages | Filtrage serveur par branche, catégorie et statut | Timeline responsive véhicule × jours avec navigation mensuelle | RLS agence/branche appliqué aux sources | Build + lint vérifiés | Événements transferts après le module Transferts |
| Pricing engine | DONE | `pricing_rules`, `promotions` et `pricing_override_history`, périodes, minimums, index et RLS (`0030`, `0032`) | Résolution véhicule/catégorie/branche, tarifs jour/semaine/mois, remise, minimum et override audité | `/agency/pricing`, formulaire de réservation avec motif d’override et historique | Agent bloqué sous le minimum ; manager/owner avec motif obligatoire | Lint/build + fixture RLS et tests security séquentiels | Devis public et règles de saison avancées |
| Extras | DONE | Catalogue, snapshots réservation/contrat, contraintes, recalcul transactionnel et index/RLS (`0031`) | Tarification jour/forfait/unité, limites quantité, snapshots et audit | `/agency/extras`, assignment responsive dans réservations et contrats | Scope agence/branche et catalogue archivable | Test totals, doublon et cross-tenant dans `test:security` | Import catalogue et extras tarifés par saison |
| Flotte et GPS | IN_PROGRESS | `0008_vehicle_gps.sql`, coordonnées, tarifs semaine/mois, caution, propriété et détails propriétaire (`0053`,`0064`) | CRUD véhicule, import/export, GPS configuré, règlement sous-location | Fiche/formulaire avec propriétaire, coût et marge | RLS agence | Build/lint + tests sécurité | Connecter un fournisseur GPS/webhook réel (OPTIONAL) |
| Documents véhicule | DONE | `vehicle_documents`, bucket privé, dates d’émission/expiration, index FK, migrations `0026`–`0027` | Upload/suppression Zod, signed URLs, rate-limit et audit | Bloc responsive sur la fiche véhicule + alertes Aujourd’hui/dashboard | RLS lié à la branche du véhicule, Storage privé | Build/lint + isolation Storage/table dans `test:security` | — |
| Contrats et inspections | DONE | Contrats, inspections et photos privées, rôles payeur/conducteur, aller simple et retour anticipé (`0051`,`0055`,`0059`,`0064`,`0106`) | Activation/clôture, audit, signed URLs, contrôle financier et caution ; participants séparés du client | Dossier central, prochaine action guidée, rôles payeur/conducteur, départ/retour mobile et document imprimable FR/AR/bilingue | Storage privé, signatures RLS et tenant isolation | Standard browser E2E, one-way Casablanca→Marrakech browser E2E, release matrix 23/23 sur staging | Validation HTTPS hébergée manquante |
| Clients / CRM | IN_PROGRESS | Clients, dédoublonnage applicatif, champs CIN/passeport/ICE/IF/RC/WhatsApp (`0052`), `customer_risk_flags`, `customer_documents` et Storage privé | CRUD, import Excel, blocage serveur des clients signalés, override audité, upload contrôlé | Fiche client, documents privés, action WhatsApp, rappels d’expiration Aujourd’hui/dashboard | RLS agence, Storage par chemin agence, permission `customers.update` | Build/lint + tests sécurité | Historique financier |
| Finance | IN_PROGRESS | Paiements, factures, dépenses, idempotency keys, dépôts/cautions et règlement propriétaire (`0064`) | Caution indépendante, remboursements contrôlés, paiements cash liés à la caisse, sous-location et audit | Paiements, facture, rentabilité, caution et règlement propriétaire dans le dossier | Permissions financières | Build + contrôles de montant + sécurité | Ledger comptable complet hors périmètre Morocco Core |
| Branches et transferts | IN_PROGRESS | `branches`, `branch_id` sur opérations, FK/indexes, migrations `0023`–`0025` | CRUD branches, memberships branch-scoped, création véhicule/réservation/contrat/paiement/dépense/maintenance | `/agency/branches`, branche sur les formulaires flotte/réservation et équipe | Helper privé `user_can_access_branch`, RLS opérationnel et Storage contrats | Build/lint + test cross-tenant et test réel employé limité à une branche | Transferts métier |
| Préparation véhicule | DONE | `vehicle_preparations`, contraintes ready, indexes et RLS (`0033`–`0034`) | Checklist READY/IN_PROGRESS/BLOCKED, validation Zod et audit | Checklist responsive dans le contrat | Scope agence/branche et parent contract/vehicle validé en trigger | Cross-tenant réel dans `test:security` | — |
| Check-out | DONE | `contract_checkouts`, contraintes, indexes et RLS (`0035`, `0038`) | Readiness gate, mileage/fuel/cleanliness/accessories/keys/signature, audit et mise à jour véhicule | Formulaire mobile, signature canvas client et photos d’inspection privées | Scope contrat/vehicle/branch validé en trigger | Cross-tenant réel, lint/build | Scénario E2E navigateur avec données de test |
| Location active | DONE | `active_rental_updates`, contraintes, indexes et RLS (`0036`–`0037`) | Événements mileage/contact/GPS/dégât, validation Zod, audit | Journal responsive dans le contrat | Scope agence/branche et contrat/vehicle validé en trigger | Cross-tenant réel, lint/build | Alertes et notifications GPS |
| Prolongation de location | DONE | `rental_extensions`, date/days/amount constraints, indexes and branch-scoped RLS (`0039`–`0040`) | Atomic availability checks, contract rollback on journal failure, Zod, audit and pricing | Formulaire mobile et historique dans le contrat | Contract/branch isolation | Cross-tenant réel, lint/build | — |
| Swap véhicule | DONE | `vehicle_swaps`, same-branch/different-vehicle constraints, scope trigger, indexes and RLS (`0041`–`0042`) | Availability checks, branch/status validation, rollback, audit and status sync | Swap form and history responsive dans le contrat | RLS agence/branche and availability engine | Cross-tenant réel, lint/build | — |
| Check-in / retour | DONE | `contract_checkins`, return branch, mileage/fuel/condition constraints and indexes (`0043`,`0046`,`0049`) | Server action with review/finalization, checkout mileage guard, automatic return facts/charges, audit and client signature | Mobile review form, tactile signature client and six private photo slots in the same workflow | Agency/branch RLS and contract scope trigger | Standard browser E2E, one-way destination-branch return with six photos, duplicate/lower-mileage tests | Validation HTTPS hébergée manquante |
| Return charges | DONE | `return_charges`, override history, aggregate traceability (`0043`) | Automatic late/mileage/fuel/cleaning calculations, manager override history and immutable base pricing | Charge list with type/quantity/unit price/source, override autorisé et gate financier de clôture | RLS and amount constraints | Financial 9/9 + standard browser E2E charges/closure | Advanced garage invoicing remains optional |
| Dégâts | DONE | `damage_records`, severity/cost/status/indexes, réparation/garage et private `damage_photos` bucket (`0043`,`0047`,`0064`) | Signalement, private photos, repair/status tracking, availability synchronization and audit | Operations page with practical repair steps and photo upload | Tenant/branch RLS and private storage policies | Damage availability/repair tests + standard browser E2E damage photo | Expert/insurance claim depth remains optional |
| Accidents / sinistres | IN_PROGRESS | `accidents`, insurance/deductible/cost fields and `accident_damages` (`0043`,`0048`) | Server creation action, audit and optional damage link | Operations page form/list | Tenant/branch RLS | Cross-tenant fixture added | Private document upload and claim workflow pending |
| Contraventions | IN_PROGRESS | `fines`, historical contract lookup indexes (`0043`) | Automatic unique historical contract resolution with unresolved/ambiguous state and manager resolution action | Operations page create/resolve forms | Tenant/branch RLS | Cross-tenant fixture + historical lookup test | Document upload and customer notification pending |
| Caution finalization | DONE | `deposits`, `deposit_transactions`, idempotency/amount trigger (`0043`,`0045`,`0103`) | Receive/deduct/refund action with over-refund, duplicate guards and cheque lifecycle, audit | Operations action form and dedicated contract deposit card | Tenant/branch RLS | Morocco 15/15 + standard browser E2E deduction/partial refund | Hosted validation remains external |
| Caisse | IN_PROGRESS | `cash_sessions`, `cash_movements`, one-open-session constraint et référence unique (`0043`,`0064`) | Open/movement/close, paiements/dépenses cash liés automatiquement, expected-vs-actual et audit | Responsive `/agency/caisse` avec totaux, session, mouvements et historique | Branch RLS and authenticated grants | Cross-tenant fixture + balance reconciliation | Ajustements signés et clôture multi-caisses avancée |
| Livraison / collecte | IN_PROGRESS | `delivery_missions`, mission/status indexes (`0043`) | Mission creation, assignment and controlled driver status updates | Operations page + `/driver` mobile mission view | Tenant/branch RLS | Cross-tenant fixture | GPS/optimisation de tournée hors périmètre |
| Transferts inter-agences | IN_PROGRESS | `vehicle_transfers`, mileage/fuel/status constraints and scope trigger (`0043`,`0044`) | Create/complete actions, branch/mileage update, audit, booking guard during IN_TRANSIT | Operations page form/list | Both-branch RLS and transfer entity | Active transfer booking/completion tests | Driver handoff and planned-to-in-transit UI pending |
| Notifications / outbox / WhatsApp | TODO | — | — | — | — | — | Outbox et adaptateurs officiels |
| Portail client / booking public | TODO | — | — | — | — | — | Disponibilité publique, auth et paiement |

## Ordre d’exécution

1. Finaliser P0 : isolation cross-tenant, RLS/storage, permissions, rate limiting, idempotence financière, tests critiques et procédure backup/rollback.
2. Livrer P1 par parcours : branches, documents, blacklist, disponibilité, calendrier, pricing/extras, préparation, check-out, location active, retour, dommages, caisse et transferts.
3. Livrer P2 puis P3 : fournisseurs, notifications, documents PDF, portail client, booking public, paiement en ligne, GPS provider et API versionnée.

## Règle de validation

Chaque changement doit être accompagné de la migration suivie, de la validation Zod, d’une autorisation serveur, d’un audit métier quand l’opération est critique, d’un contrôle responsive et des commandes `npm run lint` et `npm run build`.

## MOROCCO PRODUCT SCOPE

FleetHub est priorisé pour une agence marocaine de 5 à 100+ véhicules. Les fonctionnalités sont classées par valeur opérationnelle réelle ; les modules avancés restent conservés techniquement quand ils ne compliquent pas le parcours principal.

### CORE_MOROCCO

- Clients particuliers et entreprises : CIN, passeport, permis, ICE/IF/RC, WhatsApp et documents privés.
- Flotte : tarifs jour/semaine/mois, caution MAD, propriété (agence, leasing, sous-location), branche, documents et alertes d’expiration.
- Réservations rapides, sources WhatsApp/téléphone/réseaux sociaux, disponibilité et calendrier véhicule anti-double réservation.
- Réservation sans véhicule assigné, attribution ultérieure par catégorie, aller simple entre branches, annulation/no-show et retour anticipé auditable.
- Contrats configurables FR/AR/bilingues, préparation, état des lieux photo mobile, location active, retour, frais, dégâts, amendes, caution, paiements, reçus/factures et clôture financière.
- Dossier de location avec payeur, conducteur principal et conducteurs additionnels séparés ; règlement des propriétaires de véhicules en sous-location.
- Caisse simple par agence, maintenance, dépenses, livraisons utiles (aéroport/hôtel/adresse), tableau de bord et écran « Aujourd’hui ».
- Isolation multi-agence et multi-branche, rôles Owner/Manager/Agent/Comptable/Driver, exports administratifs configurables (DPL/NARSA) sans prétendre à une intégration officielle.

### OPTIONAL

- Fournisseur WhatsApp officiel et modèles de messages, promotions simples, GPS via fournisseur, livraison/transfert avancés, PDF bilingue exportable et règles tarifaires saisonnières plus fines.

### FUTURE

- IA, prévision de demande, télématique avancée/remote lock, portail et booking public, paiement en ligne, API publique/OTA/channel manager, fidélité, CRM marketing, comptabilité intégrée, yield management et multi-devise avancé.

### REMOVE_FROM_UI

- Les écrans techniques de pricing avancé, catalogue extras détaillé, gestion de branches et configuration GPS restent accessibles depuis Paramètres ou les fiches concernées ; ils ne doivent pas encombrer la navigation quotidienne d’une agence mono-branche.

## MOROCCO CORE VALIDATION

État de la qualité fonctionnelle au 15 septembre 2026 :

- **Livré côté code** : champs client marocains et documents privés, tarifs MAD, extras, disponibilité anti-double réservation, réservation catégorie/attribution tardive, sous-location et règlement propriétaire, préparation, check-out, location active, retour avec revue, charges automatiques/override, dégâts avec photos privées et suivi réparation, caution indépendante, caisse liée aux paiements/dépenses cash, missions chauffeur, transferts, signatures tactiles et document contractuel imprimable FR/AR/bilingue.
- **Validation historique de l’itération précédente** : `npm run lint`, `npm run build` et `npm run test:security` (8/8 fixtures multi-agence/branch-limited). Ces tests mutent la base et n’ont pas été relancés dans l’audit final sur le projet de production.
- **E2E synthétique historique** : un scénario de location complet avait été exécuté puis nettoyé lors d’une itération précédente. Il n’est pas présenté comme une preuve de cet audit final ; aucune donnée `TEST_E2E` n’a été créée pendant cet audit.

## STAGING SECURITY RETEST — 15 septembre 2026

- Projet isolé : `fleethub-staging` (ref `nyurwczpxpcpwqamfoek`), sans données métier de production.
- Migrations métier appliquées jusqu’à `0066_reservation_one_way_extra_totals`, puis `0067_security_rls_parity` et `0068_security_definer_restrictions`.
- `0067` restaure le RLS manquant du baseline (55/55 tables publiques protégées) et ses policies sont idempotentes.
- Tests réels sur fixtures synthétiques staging : `npm run test:security` (8/8), `tests/morocco-workflows.test.mjs` (5/5), `npm run test:financial` (2/2).
- Les fixtures et fichiers privés de test ont été supprimés par scope ; la base staging ne contient plus d’agence, client, véhicule ou objet Storage de test.
- **Limites historiques à revalider avant pilote** : un ancien parcours a signalé un total imprimé potentiellement basé sur le montant initial, une clé d’idempotence de paiement trop stable entre rendus et une inspection de restitution séparée non persistée. La base protège désormais les bornes de caution par trigger ; ces points n’ont pas été rejoués sur un environnement de test séparé pendant l’audit final et restent donc des vérifications bloquantes, pas des fonctionnalités déclarées validées.
- **Derniers changements appliqués** : `0064_morocco_workflow_depth.sql` est enregistrée dans Supabase `car_rental_saas` sous `morocco_workflow_depth` (15 septembre 2026). `0065_morocco_child_table_grants.sql` ferme les privilèges `anon` sur les deux nouvelles tables privées. `0066_reservation_one_way_extra_totals.sql` conserve les frais aller simple lors de l’ajout/retrait d’extras. Le schéma, les politiques RLS et les privilèges ont été vérifiés en lecture après migration ; les neuf contrats historiques sans branche restent conservés et leurs nouveaux enfants ne sont visibles que par des membres à portée globale.

## FINAL BROWSER EVIDENCE — 16 septembre 2026

- `tests/e2e/one-way-rental.spec.ts` exécute maintenant le parcours complet via navigateur sur staging : réservation Casablanca → Marrakech, contrat bilingue, préparation, check-out + six photos privées, check-in à Marrakech + six photos privées, paiement, caution, clôture et vérification DB que le véhicule est `AVAILABLE` dans Marrakech.
- `tests/e2e/release-validation.spec.ts` reste à **23/23** après ajout de la validation explicite du véhicule appartenant à la branche de départ et de fixtures dédiées aux swaps séquentiels.
- La réservation avec une branche de départ explicite refuse désormais côté serveur un véhicule situé dans une autre branche au lieu de déplacer silencieusement la réservation (`src/app/agency/reservations/actions.ts`).
- La suite globale locale de production ciblant staging compte désormais 26 scénarios (performance + one-way + 23 release + standard) ; la validation HTTPS hébergée reste séparément bloquée tant que `FLEETHUB_HOSTED_URL` n’est pas configurée.
- **Vérifications additionnelles** : TypeScript et tests financiers locaux (2/2) passent. Les tests synthétiques des nouveaux parcours (`tests/morocco-workflows.test.mjs`) sont prêts et gardés contre l’URL de production, mais nécessitent un projet Supabase de test distinct ; ils ne sont pas comptés comme exécutés.
- **Encore incomplet pour le pilote** : boucle financière du règlement propriétaire sans transaction de décaissement liée, décision de retour anticipé sans calcul/remboursement automatisé, remplacement atomique des participants, clôture multi-table encore compensée côté application, test concurrent et E2E de la version migrée dans un environnement séparé. Les alertes Supabase préexistantes (`btree_gist` en `public`, fonctions `SECURITY DEFINER` exposées, protection des mots de passe divulgués désactivée) restent à traiter après vérification de compatibilité.
- **PDF** : le contrat, devis, reçu et facture utilisent l’impression navigateur vers PDF ; une génération PDF serveur dédiée reste optionnelle.

## PILOT READINESS RETEST — 15 septembre 2026

- `0069_login_rate_limiting.sql` ajoute une limitation anonyme par empreinte IP + email (5 tentatives / 10 minutes), avec test réel staging (`tests/auth-rate-limit.test.mjs`, 1/1). Supabase Auth dispose aussi de ses limites natives ; la protection contre les mots de passe divulgués reste plan-gated sur l’offre staging actuelle et n’a pas pu être activée.
- `0070_financial_atomicity.sql` et `0071_atomic_conflict_fix.sql` rendent les écritures paiement/dépense avec mouvement de caisse atomiques et idempotentes ; `0072_core_foreign_keys.sql` ajoute les FK/indexes opérationnels manquants sans réécriture destructive. Tests atomiques 1/1, sécurité 8/8, workflows Maroc 5/5 et finance 3/3 passent sur staging.
- Parcours navigateur synthétique validé sur staging avec Owner et Agent : réservation, contrat FR/AR, préparation, check-out/check-in avec 6 photos privées à chaque étape, charges retard/km/carburant, dégât + photo privée, paiements multiples, caution reçue/déduite/remboursée, facture, reçu, clôture et retour véhicule `AVAILABLE`. Le résumé de caution affiche maintenant le solde encore détenu après remboursement.
- Limites avant pilote : la suite navigateur complète des cas difficiles (one-way Branch A→B, swap/panne, sous-location, annulation/no-show, réparation, échec upload/retry) n'est pas entièrement rejouée ; aucun E2E browser ne doit être déclaré passé pour ces cas. La protection leaked-password dépend d'un plan Supabase supérieur. Les avertissements Advisor liés à l'extension publique et aux helpers SECURITY DEFINER restent documentés comme non bloquants après revue.

## BROWSER E2E RETEST — 15 septembre 2026

- Exécution réalisée uniquement sur le projet staging `fleethub-staging` (`nyurwczpxpcpwqamfoek`) avec des fixtures synthétiques marquées `TEST_BROWSER_`. Aucun fixture n'a été laissé après le run : les lignes agence/client/véhicule/contrat et les objets des quatre buckets privés ont été vérifiés à zéro.
- Parcours validés depuis le navigateur : double réservation rejetée, conflit de prolongation, réservation par catégorie puis attribution, payeur/conducteur séparés et conducteur additionnel, paiements mixtes, double remboursement de caution rejeté, swap et remplacement après panne, sous-location et règlement propriétaire, transfert inter-agences, annulation, no-show, contravention liée à l'ancien contrat, dégât/photo/réparation, action financière interdite à un Agent, isolement de branche, upload de photos en aller simple et retry après refus RLS.
- Le parcours aller simple Casablanca → Marrakech a été rejoué de bout en bout : check-out en branche A, check-in et six photos de retour en branche B, frais, paiement, caution, facture/reçu, clôture ; le véhicule termine `AVAILABLE` dans la branche B. La migration locale `0073_one_way_return_branch_access.sql` ajoute les policies de lecture/écriture nécessaires pour la branche de retour et a été appliquée puis vérifiée sur staging.
- Corrections livrées pour ce run : formulaire inline de motif d'annulation/no-show (sans `window.prompt`), accès RLS des contrats aller simple et de leurs enfants à la branche de retour, upload des photos de retour selon `contract_checkins.branch_id`, et clôture qui persiste la branche finale et déplace le véhicule.
- Vérifications locales après nettoyage : `npm run test:financial` (3/3), `npm run test:security` (8/8), `npm run lint` (0 erreur, 6 warnings `next/image`), `npx tsc --noEmit` (pass), `npm run build` (pass). Les tests dédiés `tests/auth-rate-limit.test.mjs` (1/1), `tests/atomic-finance.test.mjs` (1/1) et `tests/morocco-workflows.test.mjs` (6/6) passent également.
- Limite restante : l'isolement cross-tenant est couvert par les tests Supabase réels (lecture/écriture/update/delete et Storage), mais un second login cross-tenant n'a pas été rejoué comme scénario UI séparé dans ce run. La protection leaked-password reste indisponible sur le plan Supabase staging actuel. Ces deux points empêchent de présenter le pilote comme totalement sans réserve.

## PRODUCTION PILOT PROMOTION — 15 septembre 2026

- Cible vérifiée avant écriture : `car_rental_saas`, ref `wewajfotwphufsthfgul`, état `ACTIVE_HEALTHY`, PostgreSQL 17.6.1. La migration `0073_one_way_return_branch_access.sql` est additive : 17 policies `SELECT/INSERT` limitées par agency, branche de retour et contrat actif ; aucune table, ligne ou permission publique n'est supprimée.
- Le projet est sur le plan Supabase Free : la page Backups confirme qu'il n'y a pas de project backups planifiés. Le rollback préparé pour 0073 supprime uniquement les 17 policies nommées ; il a été exercé dans une transaction sur staging puis annulé, avec les 17 policies restaurées.
- 0073 a été appliquée en production sous `one_way_return_branch_access` (`20260915220148`). La vérification suivante a révélé que la protection login et les RPC financiers atomiques n'étaient pas encore présents dans l'historique production ; les migrations additives requises `0069` (`login_rate_limiting`), `0070` (`financial_atomicity`), `0071` (`atomic_conflict_fix`) et `0072` (`core_foreign_keys`) ont donc été appliquées sans fixtures ni modification de données métier.
- Post-migration production : 56/56 tables publiques avec RLS, 17 policies one-way, 166 policies contenant un contrôle de branche, 13 policies Storage (dont 4 contract-photo policies), quatre buckets privés, table/RPC login rate-limit, deux RPC financiers atomiques et 20 FK opérationnelles vérifiées en lecture. Login réel et les pages Dashboard, Aujourd'hui, Réservations, Contrats, Véhicules, Clients, Caisse et Opérations chargent correctement.
- Dernière régression staging après promotion : `security` 8/8, `financials` 3/3, `morocco-workflows` 6/6, `auth-rate-limit` 1/1, `atomic-finance` 1/1, lint 0 erreur (6 warnings `next/image`), TypeScript 0 erreur après régénération `.next`, build réussi. Le Browser E2E synthétique reste à 23 pass, 0 fail, 0 skip ; aucune fixture staging n'est conservée.
- Limites connues : la protection leaked-password est toujours plan-gated chez Supabase Free. Advisor conserve les avertissements historiques sur `btree_gist` dans `public` et les SECURITY DEFINER intentionnelles (helpers RLS, rate-limit, RPC financiers) ; toutes ont un `search_path` fixe et des contrôles d'autorisation applicatifs.
- **Verdict pilote après promotion** : `READY FOR PILOT` sous réserve du suivi opérationnel habituel. Le pilote ne doit pas être présenté comme couvert par des backups Supabase automatiques tant que l'organisation reste sur Free ; conserver les exports/rollback policy documentés et traiter le plan Supabase comme une décision d'exploitation séparée.

## UX SIMPLIFICATION PASS — 16 septembre 2026

- Navigation role-aware : l’Agent commence par Aujourd’hui, Réservations, Locations, Véhicules et Clients ; les outils moins fréquents sont regroupés sous Plus. Owner/Manager conservent les espaces de pilotage et de gestion.
- Dashboard réduit aux indicateurs de décision et Aujourd’hui aux tâches opérationnelles (départs, retours, retards, préparation, encaissements, cautions et alertes).
- Dossier de location enrichi d’une progression lisible et d’une prochaine action guidée ; statuts de caution, charges, opérations et caisse affichés en français métier.
- UUID, valeurs d’énumération et champs d’idempotence masqués des formulaires opérationnels. Les dates récentes du dashboard utilisent un format lisible `fr-MA`.
- Cartes/statistiques aplaties pour une densité plus calme, sans modifier les actions serveur, permissions, RLS ou calculs financiers.
- QA : Owner et Agent testés sur staging via navigateur, dashboard/Aujourd’hui/Plus d’opérations/dossier actif chargés sans warning console ; security 8/8, financials 3/3, Morocco workflows 6/6, TypeScript et build pass. Lint : 0 erreur et 6 avertissements d’optimisation `<img>` existants.

## PERFORMANCE PASS — 16 septembre 2026

- Mesure faite sur le projet Supabase staging `nyurwczpxpcpwqamfoek`, d’abord en dev (`localhost:3100`), puis après `npm run build` + `next start` (`localhost:3200`). Les temps ci-dessous sont des mesures navigateur click/navigation → premier titre interactif, et peuvent varier selon le cache et la latence Supabase.
- Dev avant optimisation (ms) : Aujourd’hui 1369, réservations 933, détail réservation 874, nouvelle réservation 993, clients 991, flotte 3778, contrats 1044, détail contrat 3398, paiement 1206, caisse 1070, opérations 1206.
- Production build après optimisation (ms, mesure chaude représentative) : Aujourd’hui 893, réservations 855, flotte 880, détail contrat 1202 ; une première navigation froide du dashboard a varié entre 1060 et 1669 ms. Login staging mesuré à environ 1.7–1.9 s, dominé par la session/Auth et la latence réseau.
- Le dossier contrat regroupe désormais les lectures indépendantes (préparation, check-out/check-in, caution, signatures, charges, événements, prolongations et règlement propriétaire) dans un batch `Promise.all`. Les listes flotte/contrats/réservations et le dashboard ne relancent plus une requête séparée uniquement pour calculer les statistiques.
- Le formulaire paiement ne déclenche plus `router.refresh()` après une navigation `router.push`; les refresh conservés correspondent aux actions qui restent sur la même page et nécessitent une invalidation locale.
- Ajout de timings serveur opt-in dans `src/lib/perf.ts` pour réservation, contrat, paiement, check-out, check-in et clôture. Ils sont actifs en dev ou avec `FLEETHUB_PERF_LOGS=1` en staging et n'émettent rien en production par défaut.
- Aucun index ou cache spéculatif n'a été ajouté. Les counts de requêtes réseau individuels ne sont pas exposés par l'API browser utilisée ici ; le nombre de lectures logiques a été réduit par inspection du code et les timings de route Next ont été vérifiés dans les logs dev. Les six avertissements lint `next/image` restent à traiter séparément pour les previews privées.
- Validation après cette passe : `npx tsc --noEmit` pass, `npm run lint` pass (0 erreur, 6 warnings existants), `npm run build` pass, security 8/8, financials 3/3 et Morocco workflows 6/6. Le build production staging a été ouvert et parcouru sur les pages principales sans erreurs console.
- Dernière itération : le login réutilise maintenant l’utilisateur vérifié retourné par `signInWithPassword` pour résoudre le contexte (sans second `auth.getUser` dans la même Server Action). Timings staging observés : rate-limit 173–442 ms, Auth + cookie 230–333 ms, contexte agence 572 ms, action serveur complète 1.15 s ; la navigation browser ajoute environ 0.6 s de redirect/proxy.
- Le dossier contrat réutilise la requête principale du contrat, la liste de paiements et la requête caution dans le calcul financier, supprimant les lectures contract/payments/deposit dupliquées. Logs staging : contract primary 78–120 ms, paiements 77–129 ms, financials 82–177 ms, panels 97–179 ms, page serveur 1.0–1.8 s selon cache et préchargements.
- Ajout d'un skeleton dédié `src/app/agency/contracts/[id]/loading.tsx`, d'un indicateur de navigation immédiat dans la sidebar, et d'un prefetch limité aux routes quotidiennes visibles. Aucun changement de calcul financier, RLS ou autorisation.
- Les tests browser ont été rejoués sur le build local staging (`http://localhost:3200`) avec 0 erreur console. Aucun déploiement hébergé staging n'est configuré dans le dépôt (pas de `hosting.json`, Vercel ou autre cible), donc la comparaison Supabase régionale hébergée reste à faire après choix d'un fournisseur.
- Après le dernier build staging, une navigation directe isolée a donné : Aujourd'hui 1.19 s, Réservations 0.54 s, Clients 0.55 s, Véhicules 0.82 s, Locations 0.54 s, Paiements 0.52 s, Caisse 0.53 s et Opérations 0.49 s ; le dossier contrat a été interactif en 0.73 s sur la même passe, sans erreur console. Ces valeurs sont des mesures de perception navigateur et ne remplacent pas un déploiement hébergé.
- Les logs serveur du dossier contrat restent parallélisés : lecture principale 101 ms, paiements 96 ms, caution 98 ms, calcul financier 98 ms, inspections 161 ms, factures 169 ms, photos 187 ms, panneaux secondaires 448 ms, page totale 1.56 s sur une passe instrumentée. Les écarts entre temps serveur et perception navigateur viennent du streaming/RSC et du cache du navigateur.
- Le dernier build a aussi regroupé les lookups indépendants de la page Aujourd’hui dans le même `Promise.all` et ajoute `today.page.total` pour le suivi. Mesure navigateur finale : dashboard 795 ms, Aujourd’hui 539 ms, réservations 571 ms, nouvelle réservation 517 ms, clients 552 ms, véhicules 557 ms, locations 525 ms, paiement 557 ms, caisse 493 ms, opérations 598 ms et dossier contrat 859 ms, sans erreur console. Mesure serveur Aujourd’hui : 594 ms ; dossier contrat : 950 ms.
- EXPLAIN ANALYZE read-only sur staging a confirmé des scans séquentiels très courts (reservations 0,95 ms, contrats 0,24 ms, véhicules 0,26 ms) sur les volumes actuels ; aucun nouvel index n'est justifié par ces plans. L'Advisor performance signale 14 policies dont l'appel auth pourrait être encapsulé dans `select` et 6 paires d'indexes dupliqués ; aucune policy ni index existant n'a été modifié pendant cette passe, afin de ne pas toucher à RLS sans migration et mesure de charge dédiées.

## HOSTED RELEASE VALIDATION — 16 septembre 2026

- Un harness Playwright reproductible couvre les 23 scénarios métier et un test de mesure de performance (`tests/e2e/release-validation.spec.ts`, `tests/e2e/hosted-performance.spec.ts`). Le setup seed uniquement `fleethub-staging`, crée une Demo Agency isolée, ouvre une session Owner via l'interface, puis le teardown supprime exactement cette agence et ses objets privés.
- Le runner refuse explicitement localhost, les URL non HTTPS et toute URL Supabase autre que `nyurwczpxpcpwqamfoek`. Les credentials et cookies restent dans `test-results/` ignoré par Git et sont supprimés après la suite.
- `npm run test:e2e:release` a été vérifié en mode fail-closed : sans `FLEETHUB_HOSTED_URL`, il s'arrête avant le seed avec une erreur explicite. Aucun déploiement hébergé n'est configuré dans ce repository, donc aucun Browser E2E hosted n'a été exécuté dans cette passe.

## CURRENT BLOCKER RETEST — 16 septembre 2026

Cette section remplace les affirmations historiques qui ne constituent pas une
preuve pour l’état courant du code. Les vérifications ci-dessous ciblent
uniquement le projet Supabase staging `nyurwczpxpcpwqamfoek` ; la production
`wewajfotwphufsthfgul` n’a pas été utilisée.

- `0074_rental_charge_rules_recovery.sql` : règles kilométriques et tarifs de
  retour snapshotés sur le contrat, avec revue obligatoire lorsque l’historique
  ne permet pas de déterminer une allowance. Migration appliquée sur staging.
- `0075_financial_document_consistency.sql` : clé déterministe des documents,
  conservation des factures émises avec ancien total, politique d’annulation
  explicite et index/policy de mise à jour limités à l’agence/branche. Appliquée
  sur staging.
- `0076_deposit_settlement_integrity.sql`, `0077_deposit_immutability_service_cleanup.sql`
  et `0078_deposit_status_lifecycle.sql` : déduction de caution traçable comme
  règlement du solde sans devenir revenue/cash, transactions immuables pour
  les utilisateurs et nettoyage staging service-role contrôlé, statuts
  `PARTIALLY_REFUNDED`/`REFUNDED`/`CLOSED`. Appliquées sur staging.
- `0079_one_way_return_policy_reconciliation.sql` : garde non destructive qui
  vérifie les policies one-way et Storage attendues après le drift historique
  de l’entrée 0073. Appliquée sur staging ; elle ne marque pas rétroactivement
  0073 comme exécutée.
- `0080_idempotency_conflict_guards.sql` : les RPC financiers atomiques
  refusent maintenant la réutilisation d’une même clé avec un montant, un
  contrat, une méthode ou un type différent. Le serveur vérifie aussi le
  payload d’une clé de paiement avant de traiter un retry ; les opérations de
  caution rejettent les collisions de clé avec un payload différent.
- `0081_reservation_payment_settlement.sql` et
  `0082_reservation_payment_balance.sql` lient les avances de réservation au
  ledger paiement existant, recalculent le solde restant à partir des paiements
  confirmés et gardent le scope agence/branche par trigger.
- `0083_reservation_refund_atomicity.sql` permet les remboursements
  d’annulation/no-show avant contrat avec le même contrôle anti-surremboursement,
  la même idempotence et la même caisse atomique que les paiements de location.
- `0084_reservation_refund_update_guard.sql` étend le trigger de contrôle aux
  changements ultérieurs de `reservation_id`, afin qu’un remboursement ne puisse
  pas contourner la validation par une simple mise à jour.
- `0085_customer_document_expiry_alerts.sql` ajoute la date d’expiration des
  documents clients privés et la remonte dans Aujourd’hui avec un index par
  agence/date.
- Aujourd’hui conserve les missions `ACCEPTED` et `ARRIVED` visibles jusqu’à
  leur fin. Plus d’opérations permet l’affectation ultérieure d’un chauffeur
  compatible avec la branche, avec contrôle serveur et audit.
- Le suivi des sinistres permet maintenant de renseigner les références police/
  assurance, franchise, coûts, responsabilités et de faire progresser le statut
  jusqu’à la clôture. Un échec du lien sinistre–dommage supprime le parent créé
  dans la même tentative applicative pour éviter un enregistrement orphelin.
- La fiche client utilise un fallback de projection si elle tourne brièvement
  contre un schéma antérieur à 0085 ; le déploiement de la migration reste
  requis pour activer les alertes d’expiration des documents uploadés.
- `0086_reservation_advance_balance_consistency.sql` sépare l’avance prévue du
  solde réellement encaissé : les extras et frais aller simple recalculent le
  total, mais le solde ne baisse qu’avec des paiements complétés. Le scénario
  atomique staging couvre désormais l’assertion avant paiement, le paiement
  complet, le remboursement partiel et le rejet du sur-remboursement.
- Tests locaux : `npm run test:financial` (9/9), `npm run test:security` (8/8,
  fixtures multi-tenant/branch réelles), `tests/morocco-workflows.test.mjs`
  (6/6), `tests/auth-rate-limit.test.mjs` (1/1), `npx tsc --noEmit` (pass),
  build (pass), lint (0 erreur, 6 avertissements `next/image`),
  `tests/atomic-finance.test.mjs` (1/1). Le smoke staging de caution
  a persisté 3000 reçu, 950 déduit, 2050 remboursé, statut `REFUNDED`, puis a
  rejeté le retry idempotent.
- `tests/security.test.mjs` est maintenant fail-closed sur
  `.env.test.local`/les variables `FLEETHUB_TEST_*` et refuse tout hostname
  production.

### Blockers encore ouverts

- Aucun déploiement hébergé n’est configuré dans le dépôt ; les scénarios
  Browser E2E et les mesures réseau régionales restent non vérifiés.
- La clôture/check-in utilise une séquence recoverable mais pas une transaction
  PostgreSQL unique ; une injection de panne réseau n’est donc pas prouvée
  comme rollback complet.
- Annulation/no-show produisent maintenant un remboursement idempotent lié à la
  réservation quand une avance réellement enregistrée existe ; la politique
  configurable (retenue totale/partielle, décision manager) et le parcours
  d’avance sans paiement restent à valider côté métier.
- Les périodes contractuelles restent principalement date-only ; la précision
  des heures de retard et des missions aéroport n’est pas complète.
- La protection leaked-password reste indisponible sur le plan Supabase courant.

Statut de cette retest : `IN_PROGRESS`, verdict prudent `NOT READY FOR PILOT`
tant que les preuves hosted et les effets financiers annulation/no-show ne sont
pas disponibles.

## OPERATIONAL GAP FIXES — 16 septembre 2026

- `Aujourd’hui` inclut maintenant les missions du jour aux statuts `ACCEPTED`
  et `ARRIVED`, afin qu’une mission déjà prise en charge reste visible jusqu’à
  sa fin. Les statuts terminés, échoués ou annulés restent exclus.
- `0085_customer_document_expiry_alerts.sql` ajoute `expires_at` (nullable) aux
  documents clients privés et un index agence/date. Le formulaire d’upload
  permet de renseigner l’expiration et `Aujourd’hui` remonte ces documents avec
  les alertes véhicules/clients existantes. Migration appliquée sur le staging
  `nyurwczpxpcpwqamfoek`.

## ATOMIC RECOVERY PASS — 16 septembre 2026

- `0087_atomic_checkin_finalize.sql` concentre la finalisation du retour dans
  une transaction PostgreSQL : verrou du contrat/check-in, contrôle branche et
  photos, recalcul serveur des frais retard/km/carburant/nettoyage à partir des
  règles snapshotées, inspection, charges automatiques et statuts finalisés.
  Une reprise avec check-in déjà finalisé renvoie le même identifiant sans
  recréer de frais.
- `0088_atomic_checkin_finalize_fix.sql` corrige le déploiement de la fonction
  après un test staging qui a détecté l’ambiguïté entre la variable et la
  colonne `finalized_at`.
- `0089_atomic_reservation_outcome.sql` ajoute la fonction privée de
  resynchronisation du statut véhicule et rend l’annulation/no-show et le
  remboursement liés atomiques. `0090_atomic_reservation_outcome_idempotency.sql`
  refuse aussi une nouvelle somme avec la même réservation déjà terminale.
- `0091_atomic_contract_closure.sql` rend la clôture idempotente et
  transactionnelle : solde/caution, contrat, reservation, kilométrage,
  branche finale et statut véhicule sont vérifiés puis écrits ensemble. Le
  bouton de clôture utilise désormais cette RPC.
- Tests d’intégration staging exécutés avec fixtures synthétiques nettoyées :
  `tests/atomic-checkin.test.mjs` (1/1),
  `tests/atomic-reservation-outcome.test.mjs` (1/1) et
  `tests/atomic-contract-closure.test.mjs` (1/1). Le premier a d’abord
  échoué sur l’ambiguïté SQL puis a passé après correction ; le test couvre
  notamment absence de photos, calcul server-side, retry sans doublon et
  rollback de validation.

### Blockers après cette passe

- Les preuves Browser E2E hosted et la mesure régionale restent bloquées tant
  qu’aucun déploiement HTTPS staging n’est configuré ; le runner fail-closed
  sans `FLEETHUB_HOSTED_URL`.
- Les photos/constats d’accident sont maintenant stockés dans le bucket privé
  `accident-photos`, avec table de métadonnées et policies tenant/branche ; le
  suivi de sinistre avancé (expert/garage/indemnisation) reste volontairement
  partiel.
- Le règlement propriétaire passe maintenant par `save_vehicle_owner_settlement`:
  le split commercial reste dans le settlement et chaque nouveau paiement crée
  une dépense idempotente ainsi qu’un mouvement de caisse pour les espèces.
- Les politiques configurables d’avance sans paiement, annulation/no-show et
  la précision horaire des contrats restent à valider avec un flux métier
  complet ; les guards atomiques de base sont maintenant couverts.
- La protection leaked-password demeure plan-gated sur Supabase Free.

### FINANCIAL RECOVERY PASS — 16 septembre 2026

- `0093_atomic_owner_settlement.sql` ajoute le mode de paiement du propriétaire
  et une RPC atomique pour lier settlement, expense et caisse.
- `0094_atomic_owner_settlement_record_alias_fix.sql` corrige la gestion des
  résultats vides et l’ambiguïté des alias PL/pgSQL détectées par le test
  staging. Le test Morocco couvre le paiement partiel, la marge, le mouvement
  de caisse et le retry sans doublon.
- `tests/security.test.mjs` couvre aussi la table `accident_photos`, son upload
  privé et le refus de téléchargement par un autre tenant.
- `0095_test_fixture_cleanup_guard.sql`, `0096_test_fixture_cleanup_execute_grant.sql`
  et `0097_test_fixture_cleanup_auth_guard_fix.sql` rendent le teardown des
  fixtures sûr et vérifiable : seul un appel de clé de service (sans session
  utilisateur) peut supprimer une agence portant explicitement un marqueur de
  test. Les runs suivants ne laissent plus les tenants de sécurité derrière.
- `0098_test_fixture_cleanup_restrict_grant.sql` resserre finalement le helper
  à `service_role` uniquement ; vérification staging : 0 agence, 0 profil
  résiduel avec marqueur security/test.

## REPRODUCIBLE BROWSER VALIDATION — 16 septembre 2026

- Le runner Playwright local utilise désormais un tenant `TEST_E2E_<run-id>`
  isolé, un IP de test distinct pour la protection brute-force, et nettoie
  uniquement ce tenant via `cleanup_test_agency`. L'agence Manual QA stable
  n'est jamais réinitialisée.
- `scripts/start-staging.mjs` compile le bundle avec les seules variables
  publiques de `fleethub-staging` avant `next start`; aucune clé service-role
  n'entre dans le runtime frontend. `npm run test:e2e:local` est le chemin
  reproductible pour une validation locale contre le Supabase staging.
- Browser E2E local sur build production : **24/24 pass**, 0 failed, 0 skipped,
  après correction des sélecteurs et ajout d'un dossier photo en revue.
- Les checks de sécurité et de finance restent verts : security 8/8,
  financial 9/9, Morocco workflow 7/7, atomic finance 1/1, auth rate-limit
  1/1, atomic check-in/outcome/closure 1/1 ; TypeScript et build passent,
  lint 0 erreur avec 6 avertissements `next/image` existants.

### Release blocker actuel

- Aucun `FLEETHUB_HOSTED_URL` HTTPS n'est configuré dans le dépôt ou dans cet
  environnement. `npm run test:e2e:release` refuse donc correctement de lancer
  un test hosted et aucune conclusion de performance régionale ou de readiness
  production ne doit être tirée du run local.

## RETURN PERIOD AND EARLY-RETURN RECOVERY PASS — 16 septembre 2026

- `0099_rental_periods_and_early_return_atomic.sql` ajoute les instants
  opérationnels `pickup_at`/`return_at` aux réservations, `start_at`/`end_at`
  aux contrats et `previous_end_at`/`new_end_at` aux prolongations. Les
  contraintes d'exclusion et le trigger de disponibilité utilisent ces
  périodes quand elles existent, avec un fallback date-only explicite pour
  l'historique. Aucun enregistrement existant n'est réécrit.
- La même migration ajoute `decide_early_return_atomic`, qui verrouille le
  contrat, contrôle le rôle manager/owner et applique sans double effet les
  décisions `NO_REFUND`, `RECALCULATE` et `PARTIAL_REFUND`. Le remboursement
  est lié au ledger/caisse via la clé d'idempotence déterministe et l'audit est
  écrit dans la même transaction.
- `0100_rental_period_helper_grant.sql` rétablit uniquement l'exécution du
  helper de période pour `authenticated` et `service_role`. `0101_period_trigger_vehicle_blocks_fix.sql`
  garde le chemin date-only de `vehicle_blocks` séparé des colonnes horaires.
  `0102_accident_photo_fk_indexes.sql` ajoute les trois index FK manquants sur
  le média privé des sinistres. Ces migrations sont appliquées sur le staging
  `nyurwczpxpcpwqamfoek`; la production n'a pas été utilisée.
- Le formulaire réservation/contrat/prolongation collecte désormais l'heure,
  et les contrôles d'overlap, d'activation et de retard transmettent l'instant
  exact. Une réservation 09:00–12:00 et une réservation 12:00–15:00 le même
  jour sont acceptées ; un chevauchement 11:00–13:00 est refusé au niveau DB.

### Preuves de cette passe

- `tests/early-return-and-periods.test.mjs`: **3/3** sur staging, avec
  remboursement anticipé atomique/rejouable, périodes horaires adjacentes,
  chevauchement refusé et insertion réelle d'un `vehicle_blocks` date-only.
- `npm run test:financial`: **9/9** ; `npm run test:security`: **8/8** ;
  `tests/morocco-workflows.test.mjs`: **7/7** ; tests atomic check-in,
  finance, reservation outcome et closure : **4/4** ; auth rate-limit :
  **1/1** ; `npx tsc --noEmit`: pass ; `npm run lint -- --quiet`: 0 erreur,
  6 avertissements `next/image` existants ; `npm run build`: pass.
- Browser E2E sur build de production local connecté au staging :
  **24/24 pass, 0 failed, 0 skipped**. Le run crée puis nettoie un tenant
  synthétique isolé ; il ne constitue pas une preuve d'un déploiement HTTPS
  régional.
- Les teardown des tests atomiques et du retour anticipé suppriment maintenant
  aussi le profil public synthétique après la suppression Auth. Une vérification
  staging post-suite confirme **0 agence, 0 membership, 0 profil synthétique et
  0 objet Storage** résiduels.
- Le fallback d'affichage d'un chauffeur dans Plus d'opérations ne révèle plus
  de fragment d'UUID ; l'interface affiche un libellé métier si le profil n'a
  pas de nom exploitable.

### Limites toujours vérifiées

- Aucun `FLEETHUB_HOSTED_URL` n'est configuré : le parcours hosted et la
  latence depuis la région Supabase restent non vérifiés. Le runner hosted
  reste fail-closed au lieu d'utiliser une URL arbitraire.
- Le suivi sinistre expert/garage/indemnisation détaillé et l'intégration
  officielle WhatsApp restent hors du noyau validé ; aucun provider officiel
  n'est revendiqué.
- Supabase signale encore la protection des mots de passe divulgués comme
  indisponible sur le plan courant, ainsi que des avertissements de fonctions
  SECURITY DEFINER nécessaires aux RPC/RLS et de politiques permissives
  historiques. Les fonctions ont un `search_path` fixé et leurs RPC critiques
  vérifient l'agence, la branche et la permission ; ces avertissements ne sont
  pas masqués comme résolus.

## CHEQUE DEPOSIT LIFECYCLE — 16 septembre 2026

- `0103_deposit_cheque_lifecycle.sql` complète la caution sans la transformer
  en chiffre d'affaires : l'instrument (`CASH`, `CARD`, `TRANSFER`, `CHECK`)
  et l'état opérationnel du chèque (`RECEIVED`, `HELD`, `RETURNED`,
  `DEPOSITED_USED`, `CANCELLED_PROBLEM`) sont stockés sur la caution et chaque
  mouvement immuable. Des contraintes refusent un état de chèque sans chèque,
  et des index ciblés accélèrent le suivi par agence.
- Le trigger de caution garde le verrou transactionnel existant et propage
  l'état du chèque lors de la réception, de la déduction et du remboursement.
  L'action serveur valide ces champs avant l'insertion et inclut l'instrument
  dans le contrôle d'idempotence ; l'interface utilise des libellés métier
  français plutôt que les valeurs techniques.
- Migration appliquée au staging `nyurwczpxpcpwqamfoek` uniquement. Aucun
  changement production et aucune donnée réelle n'ont été utilisés.

### Preuves

- `tests/deposit-cheque.test.mjs`: **2/2** sur staging : cycle chèque
  reçu/détenu → utilisé → retourné, contraintes de métadonnées et retry
  idempotent sans second remboursement.
- `npm run test:morocco`: **13/13** (Morocco 8, périodes 3, chèque 2).
- Après l'ajout des champs au formulaire de caution du dossier contrat,
  `npm run test:e2e:local` reste à **24/24 pass, 0 failed, 0 skipped** sur
  le build de production local connecté au staging. Les contrôles de nettoyage
  confirment ensuite **0** agence, profil, membership ou objet Storage
  synthétique résiduel.

## CUSTOMER DUPLICATE GUARD — 16 septembre 2026

- `0104_customer_duplicate_guard.sql` protège les doublons actifs de CIN et
  d'email par agence avec des index partiels et un verrou advisory par clé.
  Les clients soft-deleted restent réutilisables, les lignes existantes ne
  sont pas réécrites, et le contrôle serveur de création/modification affiche
  un message métier avant le garde-fou DB.
- `tests/morocco-workflows.test.mjs` vérifie les deux collisions réelles via
  un client authentifié : **13/13** Morocco/périodes/cheque, sans traverser
  le tenant voisin.
- Le teardown E2E traite maintenant aussi le cas où le tenant est déjà retiré
  et supprime les profils/Auth users synthétiques orphelins du run courant.
  Après le dernier run, le contrôle staging ciblé confirme **0** agence,
  membership, profil, Auth user ou objet Storage de test.
- `0105_customer_duplicate_soft_delete_fix.sql` conserve la possibilité de
  désactiver un client legacy en doublon sans relâcher la protection des
  clients actifs. Le staging porte maintenant les migrations métier et les
  garde-fous de test jusqu'à `0107_test_cleanup_finalized_return_bypass`;
  ses 57 tables publiques ont toutes RLS activée.

## FINAL FINANCIAL/E2E VERIFICATION — 16 septembre 2026

- **DONE (staging)** — `0106_early_return_financial_consistency.sql` rend les
  décisions de retour anticipé financières et rejouables : un ajustement
  `PARTIAL_REFUND` réduit le total convenu, `RECALCULATE` crée au plus un
  remboursement déterministe, et la clôture exige une décision lorsque le
  retour est anticipé.
- **DONE (staging)** — `0107_test_cleanup_finalized_return_bypass.sql` garde
  l'immutabilité des constats finalisés pour les utilisateurs et autorise
  uniquement le helper service-role, marqué par agence synthétique, à nettoyer
  les fixtures E2E. Après le dernier run : **0** agence `TEST_E2E`, **0** objet
  Storage synthétique résiduel.
- **DONE** — `getContractFinancials` filtre maintenant les mouvements de
  caution par `deposit_id`. L'ancien select relationnel PostgREST n'existait
  pas dans le schema cache et masquait les déductions qui règlent le solde;
  cette correction rend l'affichage du dossier et `close_contract_atomic`
  cohérents sans transformer la caution en revenu.
- **VERIFIED** — `tests/e2e/standard-rental.spec.ts` exécute depuis le browser
  une location complète (réservation, extra, avance, contrat bilingue,
  signatures, préparation, six photos départ, check-out, caution, paiement
  mixte, check-in/revue avec six photos retour, charge retard, dommage + photo
  privée, déduction/remboursement, facture, reçu et clôture). Le build local
  de production connecté à fleethub-staging passe **1/1**; la suite complète
  passe **26/26**, **0** échec, **0** skip (performance baseline + one-way
  Casablanca→Marrakech + 23 release checks + standard rental).
- **VERIFIED** — Les tests de sécurité (**8/8**), financiers (**9/9**) et
  Morocco (**15/15**) restent verts; TypeScript et build passent, lint reste
  à **0 erreur** avec 6 avertissements `no-img-element` existants.
- **VERIFIED** — Les assertions navigateur payer/conducteur ne sont plus
  conditionnelles : les fixtures isolées doivent fournir deux conducteurs et
  un conducteur additionnel, sinon le test échoue explicitement. Les suites
  atomic/cheque/early-return utilisent désormais le cleanup RPC marqué
  `TEST_E2E_*`; après nettoyage, la vérification staging confirme **0 agency
  orpheline, 0 client/véhicule/contrat orphelin et 1 seule Manual QA Demo
  Agency conservée**.
- **BLOCKED (externe)** — Aucun `FLEETHUB_HOSTED_URL` n'est configuré. La
  validation HTTPS/hébergement régional ne peut donc pas être revendiquée;
  `npm run test:e2e:release` échoue volontairement en fail-closed tant qu'une
  URL de staging hébergée n'est pas fournie/configurée.

## PERFORMANCE DATA-LOADING REFACTOR — 18 septembre 2026

- `get_today_overview` et `get_dashboard_summary` sont des read-models SQL `SECURITY INVOKER`, limités par agence/branche et exécutés via une seule lecture RPC par page. Les fonctions fixent `search_path = public, private`, révoquent l’exécution publique et conservent les politiques RLS existantes.
- Aujourd’hui est passé de 22 lectures logiques (datasets complets + lookups JS) à 1 RPC agrégé ; le Dashboard est passé de 9 lectures de datasets à 1 RPC agrégé. Les alertes documents client/véhicule restent incluses après la migration corrective `performance_overview_alerts_fix`.
- Le dossier contrat réutilise maintenant la lecture `return_charges` pour le calcul financier et l’affichage, supprimant une lecture dupliquée sans modifier les totaux ni les règles financières.
- Mesure Playwright sur le build production local pointant staging (`http://127.0.0.1:3200`) : Aujourd’hui 689 ms, Réservations 804 ms, détail réservation 741 ms, nouvelle réservation 689 ms, Clients 620 ms, Véhicules 642 ms, Locations 620 ms, détail contrat 1 308 ms, Paiement 576 ms, Caisse 740 ms, Opérations 864 ms. Ce sont des mesures locales et ne remplacent pas une mesure HTTPS hébergée.
- `npm run test:security` : 8/8 ; `npm run test:financial` : 9/9 ; `npm run test:morocco` : 15/15 avec fixtures synthétiques staging et nettoyage vérifié. `npx tsc --noEmit`, `npm run build` et `npm run lint` passent (lint : 0 erreur, 6 avertissements `<img>` préexistants).
- La suite Playwright complète a été lancée sur le build staging local ; les premiers tests de workflow ont exposé des attentes de toast obsolètes (`Réservation créée`) et ont été interrompus après constat, sans modifier les tests ni masquer l’échec. Les fixtures du run interrompu ont été supprimées et vérifiées (0 agence/objet Storage restant).
- Aucun changement de RLS, d’index, de cache financier ou de logique métier n’a été effectué. Les résultats Supabase Advisor existants (policies auth init-plan, indexes dupliqués, leaked-password protection) restent documentés et hors de cette passe.
