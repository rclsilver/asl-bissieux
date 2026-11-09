-- Local fictitious data only. Requires dev/seed-validation.sql from lot 1.
-- Existing attempts are preserved when this script is rerun.
BEGIN;

INSERT INTO budget (id, created_at, updated_at, label, draft)
VALUES ('10000000-0000-4000-8000-000000000020', now(), now(), 'Validation lot 2 — e-mails fictifs', false)
ON CONFLICT DO NOTHING;
INSERT INTO expense (id, created_at, updated_at, budget_id, label, amount)
VALUES ('10000000-0000-4000-8000-000000000021', now(), now(), '10000000-0000-4000-8000-000000000020', 'Dépense fictive de validation e-mails', 500)
ON CONFLICT DO NOTHING;
INSERT INTO cotisation (id, created_at, updated_at, budget_id, unit_id, amount)
SELECT ('32000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, now(), now(),
  '10000000-0000-4000-8000-000000000020',
  ('20000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 100
FROM generate_series(1, 5) AS n
ON CONFLICT DO NOTHING;
INSERT INTO payment (id, created_at, updated_at, cotisation_id, user_id, date, amount, comment)
SELECT ('42000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, now(), now(),
  ('32000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '10000000-0000-4000-8000-000000000001', now(), amount, 'Paiement fictif pour les filtres d’e-mails'
FROM (VALUES (2, 25), (3, 50), (4, 100), (5, 120)) AS example(n, amount)
ON CONFLICT DO NOTHING;

INSERT INTO member (id, created_at, updated_at, first_name, last_name, email)
VALUES
  ('50000000-0000-4000-8000-000000000021', now(), now(), 'Alice', 'Exemple multi-lots', 'alice@example.invalid'),
  ('50000000-0000-4000-8000-000000000022', now(), now(), 'Bob', 'Exemple copropriétaire', 'bob@example.invalid'),
  ('50000000-0000-4000-8000-000000000023', now(), now(), 'Camille', 'Exemple règlements', 'camille@example.invalid')
ON CONFLICT DO NOTHING;
INSERT INTO member_unit (member_id, unit_id) VALUES
  ('50000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000002'),
  ('50000000-0000-4000-8000-000000000022', '20000000-0000-4000-8000-000000000002'),
  ('50000000-0000-4000-8000-000000000023', '20000000-0000-4000-8000-000000000003'),
  ('50000000-0000-4000-8000-000000000023', '20000000-0000-4000-8000-000000000004'),
  ('50000000-0000-4000-8000-000000000023', '20000000-0000-4000-8000-000000000005')
ON CONFLICT DO NOTHING;

INSERT INTO email_template (id, created_at, updated_at, label, subject, message)
VALUES ('60000000-0000-4000-8000-000000000020', now(), now(), 'Validation lot 2 — regroupement',
  'Validation — {{.member.first_name}}',
  E'Bonjour {{.member.first_name}},\n\n{{range .cotisations}}- Lot {{.unit.number}} : {{.amount}} € appelés, {{.paid}} € réglés.\n{{end}}\nMessage fictif destiné au SMTP de test.')
ON CONFLICT DO NOTHING;
INSERT INTO email_campaign (id, created_at, updated_at, title, email_template_id, data)
VALUES ('70000000-0000-4000-8000-000000000020', now(), now(), 'Validation lot 2 — états fictifs', '60000000-0000-4000-8000-000000000020', '{}')
ON CONFLICT DO NOTHING;
INSERT INTO email (id, created_at, updated_at, email_campaign_id, "to", data, subject, message, state, error)
VALUES
  ('80000000-0000-4000-8000-000000000021', now(), now(), '70000000-0000-4000-8000-000000000020', 'alice@example.invalid',
   '{"member":{"first_name":"Alice"},"cotisations":[{"unit":{"number":1},"amount":100,"paid":0},{"unit":{"number":2},"amount":100,"paid":25}]}',
   'Validation — Alice', '<p>Exemple fictif : résultat à vérifier avant renvoi.</p>', 'UNKNOWN', 'Exemple fictif de résultat incertain ; aucun envoi préalable réel.'),
  ('80000000-0000-4000-8000-000000000022', now(), now(), '70000000-0000-4000-8000-000000000020', 'bob@example.invalid',
   '{"member":{"first_name":"Bob"},"cotisations":[{"unit":{"number":2},"amount":100,"paid":25}]}',
   '', '', 'ERROR', 'Exemple fictif d’erreur, prêt pour un essai dans le SMTP local.')
ON CONFLICT DO NOTHING;
COMMIT;
