-- Takip Listesi tablosunu oluştur
CREATE TABLE IF NOT EXISTS takip_listesi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sembol TEXT NOT NULL,
    ad TEXT NOT NULL,
    tur TEXT NOT NULL, -- 'hisse', 'metal', 'doviz'
    baslangic_fiyati NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID DEFAULT auth.uid()
);

-- RLS politikalarını ekle (isteğe bağlı, mevcut yapıya uygunsa)
ALTER TABLE takip_listesi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Herkes kendi verisini görebilir" ON takip_listesi
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Herkes kendi verisini ekleyebilir" ON takip_listesi
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Herkes kendi verisini silebilir" ON takip_listesi
    FOR DELETE USING (auth.uid() = user_id);
