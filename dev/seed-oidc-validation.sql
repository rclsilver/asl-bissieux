\set ON_ERROR_STOP on
BEGIN;
-- Fictitious local accounts, distinct from existing Google accounts and payments.
INSERT INTO public."user" (id, username, enabled, admin, actions) VALUES
('91000000-0000-4000-8000-000000000001', 'admin@example.invalid', true, true, '{}'),
('91000000-0000-4000-8000-000000000002', 'reader@example.invalid', true, false, '{}'),
('91000000-0000-4000-8000-000000000003', 'pending@example.invalid', false, false, '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.auth_identity (issuer, subject, user_id) VALUES
('http://localhost:9080/realms/asl-dev', '90000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001'),
('http://localhost:9080/realms/asl-dev', '90000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000002'),
('http://localhost:9080/realms/asl-dev', '90000000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000003')
ON CONFLICT (issuer, subject) DO NOTHING;
COMMIT;
