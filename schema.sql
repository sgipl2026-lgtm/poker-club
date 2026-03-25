-- ============================================================
-- Poker Club — Supabase SQL Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension (already enabled in Supabase by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- 1. User Profiles
--    Extends Supabase Auth (auth.users) with game-specific data
-- ============================================================

CREATE TABLE public.profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT        NOT NULL UNIQUE,
  avatar_url    TEXT,
  games_played  INTEGER     NOT NULL DEFAULT 0,
  games_won     INTEGER     NOT NULL DEFAULT 0,
  hands_won     INTEGER     NOT NULL DEFAULT 0,
  total_winnings BIGINT     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ============================================================
-- 2. Tables
--    Tracks every poker table created
-- ============================================================

CREATE TYPE betting_structure AS ENUM ('no_limit', 'pot_limit', 'fixed');
CREATE TYPE game_variant AS ENUM ('texas_holdem', 'omaha', 'omaha_hilo');
CREATE TYPE table_status AS ENUM ('waiting', 'in_progress', 'finished');

CREATE TABLE public.tables (
  id                UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_id          TEXT            NOT NULL UNIQUE,   -- 8-char human-readable ID
  admin_id          UUID            NOT NULL REFERENCES public.profiles(id),
  variant           game_variant    NOT NULL DEFAULT 'texas_holdem',
  betting_structure betting_structure NOT NULL DEFAULT 'no_limit',
  small_blind       INTEGER         NOT NULL DEFAULT 10,
  big_blind         INTEGER         NOT NULL DEFAULT 20,
  min_bet           INTEGER         NOT NULL DEFAULT 20,
  max_bet           INTEGER         NOT NULL DEFAULT 0,
  starting_chips    INTEGER         NOT NULL DEFAULT 1000,
  max_seats         INTEGER         NOT NULL DEFAULT 9 CHECK (max_seats BETWEEN 2 AND 9),
  status            table_status    NOT NULL DEFAULT 'waiting',
  invite_token      TEXT            NOT NULL DEFAULT uuid_generate_v4()::text,
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ
);

CREATE INDEX idx_tables_short_id   ON public.tables(short_id);
CREATE INDEX idx_tables_admin_id   ON public.tables(admin_id);
CREATE INDEX idx_tables_status     ON public.tables(status);


-- ============================================================
-- 3. Table Seats (players joined to a table)
-- ============================================================

CREATE TABLE public.table_seats (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id   UUID        NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id),
  seat       INTEGER     NOT NULL CHECK (seat BETWEEN 0 AND 8),
  chips      INTEGER     NOT NULL DEFAULT 0,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(table_id, seat),
  UNIQUE(table_id, user_id)
);

CREATE INDEX idx_seats_table_id ON public.table_seats(table_id);


-- ============================================================
-- 4. Game Hands (history of each hand played)
-- ============================================================

CREATE TABLE public.game_hands (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id        UUID        NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  hand_number     INTEGER     NOT NULL,
  community_cards JSONB,                    -- [{rank, suit, str}]
  pot_total       INTEGER     NOT NULL DEFAULT 0,
  winners         JSONB,                    -- [{user_id, username, amount, hand}]
  action_log      JSONB,                    -- full action history
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  UNIQUE(table_id, hand_number)
);

CREATE INDEX idx_hands_table_id ON public.game_hands(table_id);


-- ============================================================
-- 5. Hand Participants (per-player hand stats)
-- ============================================================

CREATE TABLE public.hand_participants (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  hand_id     UUID    NOT NULL REFERENCES public.game_hands(id) ON DELETE CASCADE,
  user_id     UUID    NOT NULL REFERENCES public.profiles(id),
  seat        INTEGER NOT NULL,
  hole_cards  JSONB,          -- only populated at showdown
  final_chips INTEGER NOT NULL DEFAULT 0,
  chips_won   INTEGER NOT NULL DEFAULT 0,
  best_hand   TEXT,           -- "Full House", "Flush", etc.
  won         BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_participants_hand_id ON public.hand_participants(hand_id);
CREATE INDEX idx_participants_user_id ON public.hand_participants(user_id);


-- ============================================================
-- 6. Row-Level Security (RLS)
-- ============================================================

ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_seats      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_hands       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hand_participants ENABLE ROW LEVEL SECURITY;

-- Profiles: everyone can read; only owner can update
CREATE POLICY "profiles_select_all"    ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own"    ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Tables: everyone authenticated can read; only admin can insert/update
CREATE POLICY "tables_select_auth"     ON public.tables FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "tables_insert_auth"     ON public.tables FOR INSERT WITH CHECK (auth.uid() = admin_id);
CREATE POLICY "tables_update_admin"    ON public.tables FOR UPDATE USING (auth.uid() = admin_id);

-- Seats: authenticated users can read; insert only for yourself
CREATE POLICY "seats_select_auth"      ON public.table_seats FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "seats_insert_self"      ON public.table_seats FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Hands: everyone in the table can read
CREATE POLICY "hands_select_auth"      ON public.game_hands FOR SELECT USING (auth.role() = 'authenticated');

-- Participants: users can only see their own hole cards; all other data is public
CREATE POLICY "participants_select"    ON public.hand_participants FOR SELECT
  USING (auth.role() = 'authenticated');


-- ============================================================
-- 7. Helpful views
-- ============================================================

CREATE VIEW public.leaderboard AS
SELECT
  p.id,
  p.username,
  p.avatar_url,
  p.games_played,
  p.games_won,
  p.hands_won,
  p.total_winnings,
  CASE WHEN p.games_played > 0
       THEN ROUND(p.games_won::numeric / p.games_played * 100, 1)
       ELSE 0 END AS win_rate_pct
FROM public.profiles p
ORDER BY p.total_winnings DESC;
