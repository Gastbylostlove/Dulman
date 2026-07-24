DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'message'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_read_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_read_state;
  END IF;
END
$$;
