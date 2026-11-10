CREATE TABLE plugin_agents_os_12566308fa.missions (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  creation_hash text NOT NULL,
  commands jsonb NOT NULL CHECK (jsonb_typeof(commands) = 'object'),
  audit jsonb NOT NULL CHECK (jsonb_typeof(audit) = 'array'),
  activity_sent_revision integer NOT NULL DEFAULT 0 CHECK (activity_sent_revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX missions_company_updated_idx ON plugin_agents_os_12566308fa.missions (company_id, updated_at DESC, id);
