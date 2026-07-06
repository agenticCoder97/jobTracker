-- One activity row per application, so the server can upsert on application_id.
create unique index if not exists uq_application_activity_application
  on public.application_activity (application_id);

-- app_docs already has the equivalent guarantee via unique (owner_user_id, application_id).
