ALTER TABLE "user" ADD COLUMN tour_version integer NOT NULL DEFAULT 0 CHECK (tour_version >= 0);

CREATE TABLE auth_tour_progress (
    user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    step_id text NOT NULL CHECK (length(step_id) BETWEEN 1 AND 80),
    revision integer NOT NULL CHECK (revision > 0),
    viewed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, step_id)
);
