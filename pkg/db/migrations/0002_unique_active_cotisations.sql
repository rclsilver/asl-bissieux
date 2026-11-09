-- Preserve all existing rows. Ambiguous duplicates require a reviewed repair.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.cotisation WHERE deleted_at IS NULL
    GROUP BY budget_id, unit_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate active cotisations exist; review budget/unit duplicates before migration';
  END IF;
END $$;

CREATE UNIQUE INDEX uq_cotisation_budget_unit_active
ON public.cotisation (budget_id, unit_id) WHERE deleted_at IS NULL;
