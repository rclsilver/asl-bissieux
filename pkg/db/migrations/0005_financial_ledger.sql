-- Append-only corrections: original cotisations and payments are never rewritten.
CREATE TABLE public.financial_entry (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    cotisation_id uuid NOT NULL REFERENCES public.cotisation(id),
    user_id uuid NOT NULL REFERENCES public."user"(id),
    kind text NOT NULL CHECK (kind IN ('adjustment', 'refund')),
    amount numeric NOT NULL CHECK (amount <> 0 AND abs(amount) <= 9999999999.99 AND amount = round(amount, 2)),
    date date NOT NULL,
    reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
    reference text NOT NULL DEFAULT '' CHECK (length(reference) <= 200),
    reverses_id uuid UNIQUE REFERENCES public.financial_entry(id),
    CHECK (kind <> 'refund' OR reverses_id IS NOT NULL OR amount > 0)
);
CREATE INDEX financial_entry_cotisation_idx ON public.financial_entry(cotisation_id, created_at, id);
CREATE FUNCTION public.keep_financial_entry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Financial entries are immutable; append a reversal instead';
END;
$$;
CREATE TRIGGER financial_entry_immutable BEFORE UPDATE OR DELETE ON public.financial_entry
FOR EACH ROW EXECUTE FUNCTION public.keep_financial_entry();
