-- Frozen initial schema. Never edit an applied migration; add a new version.
CREATE TABLE public.attachment (
    id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    name text NOT NULL,
    size bigint NOT NULL,
    content bytea NOT NULL,
    content_type text NOT NULL,
    inline boolean DEFAULT false NOT NULL,
    email_template_id uuid NOT NULL
);
CREATE TABLE public.budget (
    id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    label text NOT NULL,
    draft boolean DEFAULT true NOT NULL
);
CREATE TABLE public.cotisation (
    id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    budget_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    amount numeric NOT NULL
);
CREATE TABLE public.email (
    id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    "to" text NOT NULL,
    data jsonb NOT NULL,
    subject text,
    message text,
    email_campaign_id uuid NOT NULL,
    state text DEFAULT 'WAITING'::text NOT NULL,
    error text
);
CREATE TABLE public.email_campaign (
    id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    title text NOT NULL,
    email_template_id uuid NOT NULL,
    data jsonb NOT NULL
);
CREATE TABLE public.email_template (
    id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    label text NOT NULL,
    subject text NOT NULL,
    message text NOT NULL
);
CREATE TABLE public.expense (
    id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    budget_id uuid NOT NULL,
    label text NOT NULL,
    amount numeric NOT NULL
);
CREATE TABLE public.member (
    id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    first_name text NOT NULL,
    last_name text NOT NULL,
    phone_number text,
    email text,
    address text
);
CREATE TABLE public.member_unit (
    unit_id uuid NOT NULL,
    member_id uuid NOT NULL
);
CREATE TABLE public.payment (
    id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    cotisation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    date timestamp with time zone NOT NULL,
    amount numeric NOT NULL,
    comment text
);
CREATE TABLE public.unit (
    id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    number bigint NOT NULL,
    address text NOT NULL,
    share bigint NOT NULL
);
CREATE TABLE public."user" (
    id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    username text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    admin boolean DEFAULT false NOT NULL,
    actions text[]
);
ALTER TABLE ONLY public.attachment
    ADD CONSTRAINT attachment_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.budget
    ADD CONSTRAINT budget_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.cotisation
    ADD CONSTRAINT cotisation_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.email_campaign
    ADD CONSTRAINT email_campaign_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.email
    ADD CONSTRAINT email_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.email_template
    ADD CONSTRAINT email_template_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.expense
    ADD CONSTRAINT expense_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.member
    ADD CONSTRAINT member_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.member_unit
    ADD CONSTRAINT member_unit_pkey PRIMARY KEY (unit_id, member_id);
ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.unit
    ADD CONSTRAINT unit_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);
CREATE INDEX idx_attachment_deleted_at ON public.attachment USING btree (deleted_at);
CREATE INDEX idx_budget_deleted_at ON public.budget USING btree (deleted_at);
CREATE INDEX idx_cotisation_deleted_at ON public.cotisation USING btree (deleted_at);
CREATE INDEX idx_email_campaign_deleted_at ON public.email_campaign USING btree (deleted_at);
CREATE INDEX idx_email_deleted_at ON public.email USING btree (deleted_at);
CREATE INDEX idx_email_template_deleted_at ON public.email_template USING btree (deleted_at);
CREATE INDEX idx_expense_deleted_at ON public.expense USING btree (deleted_at);
CREATE INDEX idx_member_deleted_at ON public.member USING btree (deleted_at);
CREATE INDEX idx_payment_deleted_at ON public.payment USING btree (deleted_at);
CREATE UNIQUE INDEX idx_unit_address ON public.unit USING btree (address);
CREATE INDEX idx_unit_deleted_at ON public.unit USING btree (deleted_at);
CREATE UNIQUE INDEX idx_unit_number ON public.unit USING btree (number);
CREATE INDEX idx_user_deleted_at ON public."user" USING btree (deleted_at);
CREATE UNIQUE INDEX idx_user_username ON public."user" USING btree (username);
ALTER TABLE ONLY public.cotisation
    ADD CONSTRAINT fk_budget_cotisations FOREIGN KEY (budget_id) REFERENCES public.budget(id);
ALTER TABLE ONLY public.expense
    ADD CONSTRAINT fk_budget_expenses FOREIGN KEY (budget_id) REFERENCES public.budget(id);
ALTER TABLE ONLY public.payment
    ADD CONSTRAINT fk_cotisation_payments FOREIGN KEY (cotisation_id) REFERENCES public.cotisation(id);
ALTER TABLE ONLY public.cotisation
    ADD CONSTRAINT fk_cotisation_unit FOREIGN KEY (unit_id) REFERENCES public.unit(id);
ALTER TABLE ONLY public.email
    ADD CONSTRAINT fk_email_campaign_emails FOREIGN KEY (email_campaign_id) REFERENCES public.email_campaign(id);
ALTER TABLE ONLY public.attachment
    ADD CONSTRAINT fk_email_template_attachments FOREIGN KEY (email_template_id) REFERENCES public.email_template(id);
ALTER TABLE ONLY public.email_campaign
    ADD CONSTRAINT fk_email_template_campaigns FOREIGN KEY (email_template_id) REFERENCES public.email_template(id);
ALTER TABLE ONLY public.member_unit
    ADD CONSTRAINT fk_member_unit_member FOREIGN KEY (member_id) REFERENCES public.member(id);
ALTER TABLE ONLY public.member_unit
    ADD CONSTRAINT fk_member_unit_unit FOREIGN KEY (unit_id) REFERENCES public.unit(id);
ALTER TABLE ONLY public.payment
    ADD CONSTRAINT fk_payment_user FOREIGN KEY (user_id) REFERENCES public."user"(id);
