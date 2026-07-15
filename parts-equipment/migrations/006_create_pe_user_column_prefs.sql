-- Per-user, per-board table column preferences (order, widths, hidden, freeze).
-- Keyed on (user_id, board) so a person's layout follows them across devices.
-- user_id is the portal_users id (NextAuth session.user.id). prefs is the same
-- JSON shape the client hook uses: { order: string[], widths: {}, hidden: string[], frozen: number }.
create table if not exists pe_user_column_prefs (
  user_id    text        not null,
  board      text        not null,
  prefs      jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, board)
);
