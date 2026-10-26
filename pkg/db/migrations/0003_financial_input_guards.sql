-- Preserve all historical amounts, including fractions of a cent. Enforce the
-- chosen rules only on inserted values or an explicit change of amount/share.
CREATE FUNCTION public.check_new_financial_amount() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.amount IS NOT DISTINCT FROM OLD.amount THEN RETURN NEW; END IF;
  END IF;
  IF NEW.amount::text IN ('NaN', 'Infinity', '-Infinity')
     OR NEW.amount < 0 OR NEW.amount > 9999999999.99
     OR NEW.amount <> round(NEW.amount, 2)
     OR (TG_TABLE_NAME <> 'cotisation' AND NEW.amount = 0) THEN
    RAISE EXCEPTION 'New financial amounts must be positive and expressed in cents (zero allowed for cotisations)' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER expense_amount_guard BEFORE INSERT OR UPDATE OF amount ON public.expense FOR EACH ROW EXECUTE FUNCTION public.check_new_financial_amount();
CREATE TRIGGER payment_amount_guard BEFORE INSERT OR UPDATE OF amount ON public.payment FOR EACH ROW EXECUTE FUNCTION public.check_new_financial_amount();
CREATE TRIGGER cotisation_amount_guard BEFORE INSERT OR UPDATE OF amount ON public.cotisation FOR EACH ROW EXECUTE FUNCTION public.check_new_financial_amount();

CREATE FUNCTION public.check_new_unit_share() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.share IS NOT DISTINCT FROM OLD.share THEN RETURN NEW; END IF;
  END IF;
  IF NEW.share < 0 THEN RAISE EXCEPTION 'Unit shares must be non-negative' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER unit_share_guard BEFORE INSERT OR UPDATE OF share ON public.unit FOR EACH ROW EXECUTE FUNCTION public.check_new_unit_share();
