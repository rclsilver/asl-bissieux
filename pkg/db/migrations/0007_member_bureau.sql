-- Explicit association role, independent from application administration rights.
ALTER TABLE public.member ADD COLUMN bureau boolean NOT NULL DEFAULT false;
