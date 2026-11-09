-- Local draft for lot 4 validation. Existing attempts are never reset.
BEGIN;
INSERT INTO public.budget (id,created_at,updated_at,label,draft)
VALUES ('10000000-0000-4000-8000-000000000040',now(),now(),'Validation lot 4 — publication',true)
ON CONFLICT DO NOTHING;
INSERT INTO public.expense (id,created_at,updated_at,budget_id,label,amount)
VALUES ('11000000-0000-4000-8000-000000000040',now(),now(),'10000000-0000-4000-8000-000000000040','Dépense fictive à modifier avant publication',500)
ON CONFLICT DO NOTHING;
COMMIT;
