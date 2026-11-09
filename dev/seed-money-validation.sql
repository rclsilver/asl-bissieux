-- Independent draft for manual validation. Never reset an existing user test.
BEGIN;
INSERT INTO public.budget (id,created_at,updated_at,label,draft)
VALUES ('10000000-0000-4000-8000-000000000050',now(),now(),'Validation lot 5 — montants et aperçu',true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.expense (id,created_at,updated_at,budget_id,label,amount)
VALUES ('11000000-0000-4000-8000-000000000050',now(),now(),'10000000-0000-4000-8000-000000000050','Dépense fictive pour l’aperçu',100.01)
ON CONFLICT (id) DO NOTHING;
COMMIT;
