-- Identity links are explicit: matching email addresses never grant existing rights.
CREATE TABLE public.auth_identity (
    issuer text NOT NULL,
    subject text NOT NULL,
    user_id uuid NOT NULL REFERENCES public."user"(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (issuer, subject),
    CHECK (issuer <> '' AND subject <> '')
);
CREATE INDEX auth_identity_user_idx ON public.auth_identity(user_id);

-- Only hashes of browser session and CSRF tokens are persisted.
CREATE TABLE public.auth_session (
    token_hash text PRIMARY KEY CHECK (length(token_hash) = 64),
    csrf_hash text NOT NULL CHECK (length(csrf_hash) = 64),
    issuer text NOT NULL,
    subject text NOT NULL,
    user_id uuid NOT NULL REFERENCES public."user"(id),
    expires_at timestamptz NOT NULL,
    FOREIGN KEY (issuer, subject) REFERENCES public.auth_identity(issuer, subject) ON DELETE CASCADE
);
CREATE INDEX auth_session_expiry_idx ON public.auth_session(expires_at);
CREATE INDEX auth_session_user_idx ON public.auth_session(user_id);

-- Short-lived, single-use authorization requests, bound to the initiating browser.
CREATE TABLE public.auth_login_attempt (
    state_hash text PRIMARY KEY CHECK (length(state_hash) = 64),
    binding_hash text NOT NULL CHECK (length(binding_hash) = 64),
    nonce_hash text NOT NULL CHECK (length(nonce_hash) = 64),
    issuer text NOT NULL,
    verifier text NOT NULL,
    return_path text NOT NULL,
    expires_at timestamptz NOT NULL
);
CREATE INDEX auth_login_attempt_expiry_idx ON public.auth_login_attempt(expires_at);
