-- Supabase Dashboard > SQL Editor'de çalıştırın
-- portfoy tablosuna "notlar" sütunu ekler
ALTER TABLE portfoy ADD COLUMN IF NOT EXISTS notlar TEXT DEFAULT NULL;
