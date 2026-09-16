# Exploitation, sauvegarde et rollback

## Sauvegarde

FleetHub s’appuie sur les sauvegardes gérées par Supabase. Le projet ne doit pas déclarer une sauvegarde applicative automatisée tant qu’une politique de rétention et un test de restauration n’ont pas été configurés dans le tableau de bord Supabase.

Avant toute migration de production :

1. Vérifier le dernier backup disponible dans Supabase et noter son horodatage.
2. Exporter le schéma courant et conserver le fichier SQL hors du projet.
3. Tester la migration sur un projet de staging ou une branche Supabase.
4. Exécuter `npm run lint`, `npm run build` et les tests de sécurité avec deux comptes d’agence.
5. Appliquer la migration pendant une fenêtre surveillée et conserver le résultat des advisors.

## Rollback

Les migrations FleetHub sont additives et doivent rester réversibles. Une correction de données se fait dans une migration dédiée après backup ; on ne réécrit jamais une migration déjà appliquée. Pour un incident de schéma, restaurer d’abord la base Supabase dans un environnement isolé, vérifier les contrats/paiements historiques, puis promouvoir la restauration selon la procédure d’exploitation de l’organisation.

Les changements financiers et les contrats historiques sont append-only dans le modèle métier. Toute compensation passe par un remboursement, un avoir ou une écriture d’audit plutôt que par une suppression physique.

## Vérifications post-déploiement

- Se connecter avec un membre de l’agence A et vérifier qu’un identifiant de l’agence B retourne zéro ligne.
- Vérifier que les `UPDATE` ne peuvent pas modifier `agency_id`.
- Vérifier les politiques Storage privées et les signed URLs.
- Vérifier le journal d’audit après une réservation, un paiement, un remboursement et une modification de paramètres.
- Contrôler les advisors Supabase et documenter chaque avertissement accepté.

## Advisors acceptés et suivis

- Les 8 fonctions `SECURITY DEFINER` RBAC (`create_agency_with_owner`, `current_agency_id`, `get_user_agency_ids`, `is_agency_member`, `is_agency_operational`, `is_super_admin`, `shares_agency_with`, `user_has_permission`) restent appelables par `authenticated` car les politiques RLS et l’administration les utilisent. Elles ont un `search_path` fixe. Révoquer `EXECUTE` sans déplacer les helpers casserait l’autorisation ; à traiter seulement après inventaire des appels RPC.
- `btree_gist` est conservée dans `public` car la contrainte d’exclusion des réservations en dépend ; la déplacer sans recréer la contrainte risquerait de casser l’anti-double-booking.
- Les index FK manquants des signatures et les doublons d’index accident/fine ont été traités dans `0059_contract_quality.sql`. Les advisors performance restants sont des optimisations : `auth_rls_initplan` (14), `multiple_permissive_policies` (150) et `unused_index` (120). Les corriger en masse changerait les politiques ou les plans sans mesure de charge ; ils restent suivis.
- La protection Supabase contre les mots de passe compromis doit être activée dans Authentication > Password Security avant la mise en production ; elle n’est pas activée par une migration SQL.
