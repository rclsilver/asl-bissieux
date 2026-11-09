-- Local disposable validation data only. Run after the application has migrated
-- an EMPTY local database. Never run against production.
-- psql variable admin_email is required; values are quoted by psql.
BEGIN;

INSERT INTO "user" (id, created_at, updated_at, username, enabled, admin)
VALUES ('10000000-0000-4000-8000-000000000001', now(), now(), :'admin_email', true, true)
ON CONFLICT (username) DO UPDATE SET enabled = true, admin = true;

INSERT INTO budget (id, created_at, updated_at, label, draft)
VALUES ('10000000-0000-4000-8000-000000000002', now(), now(), 'Validation lot 1 — paiements fictifs', false)
ON CONFLICT DO NOTHING;

INSERT INTO expense (id, created_at, updated_at, budget_id, label, amount)
VALUES ('10000000-0000-4000-8000-000000000003', now(), now(), '10000000-0000-4000-8000-000000000002', 'Dépense fictive pour validation', 500)
ON CONFLICT DO NOTHING;

INSERT INTO unit (id, created_at, updated_at, number, address, share)
SELECT ('20000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, now(), now(), n, 'Adresse fictive de validation ' || n, 1
FROM generate_series(1, 5) AS n
ON CONFLICT DO NOTHING;

INSERT INTO cotisation (id, created_at, updated_at, budget_id, unit_id, amount)
SELECT ('30000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, now(), now(),
  '10000000-0000-4000-8000-000000000002',
  ('20000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 100
FROM generate_series(1, 5) AS n
ON CONFLICT DO NOTHING;

INSERT INTO payment (id, created_at, updated_at, cotisation_id, user_id, date, amount, comment)
SELECT ('40000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, now(), now(),
  ('30000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  (SELECT id FROM "user" WHERE username = :'admin_email'), now(), amount, 'Paiement fictif de validation'
FROM (VALUES (2, 25), (3, 50), (4, 100), (5, 120)) AS example(n, amount)
ON CONFLICT DO NOTHING;

COMMIT;
