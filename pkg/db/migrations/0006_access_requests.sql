-- Existing inactive accounts remain inactive; they are not inferred requests.
CREATE TABLE public.auth_access_request (
    user_id uuid PRIMARY KEY REFERENCES public."user"(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    status text NOT NULL CHECK (status IN ('pending','approved','rejected','disabled')),
    resolved_at timestamptz,
    resolved_by uuid REFERENCES public."user"(id)
);
CREATE INDEX auth_access_request_pending_idx ON public.auth_access_request(created_at) WHERE status='pending';
