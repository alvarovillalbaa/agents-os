CREATE TABLE plugin_agents_os_12566308fa.contacts (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  fields jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  archived_at timestamptz,
  linked_issue_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(linked_issue_ids) = 'array'),
  creation_hash text NOT NULL,
  last_operation_id uuid NOT NULL,
  last_operation_hash text NOT NULL,
  audit jsonb NOT NULL CHECK (jsonb_typeof(audit) = 'array'),
  activity_sent_revision integer NOT NULL DEFAULT 0 CHECK (activity_sent_revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contacts_company_updated_idx ON plugin_agents_os_12566308fa.contacts (company_id, updated_at DESC, id);
