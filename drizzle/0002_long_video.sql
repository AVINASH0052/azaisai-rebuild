alter table generations add column if not exists segment_count smallint;
alter table generations add column if not exists requested_duration_seconds integer;
alter table generations add column if not exists stitch_status text;
alter table generations add column if not exists storyboard jsonb;

create table if not exists generation_segments (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references generations (id) on delete cascade,
  index smallint not null,
  prompt text not null,
  status gen_status not null default 'queued',
  provider_job_id text,
  seed_image_path text,
  output_path text,
  last_frame_path text,
  error_code text,
  attempt smallint not null default 0,
  duration_ms integer,
  created_at timestamptz not null default now(),
  unique (generation_id, index)
);

alter table generation_segments enable row level security;
