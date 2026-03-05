import yfinance as yf
import time
import os
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client

# .env dosyasını yükle
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Bildirimi gönderilen hisseleri takip etmek için (aynı hedefte 30 dk aralıkla bildirim atmak için)
# Format: {hisse_kodu: last_notification_datetime}
bildirim_zamanlari = {}

def piyasa_acik_mi():
    """Borsa İstanbul piyasa saatlerini kontrol eder (10:00 - 18:30)"""
    simdi = datetime.now()
    # Cumartesi = 5, Pazar = 6
    if simdi.weekday() >= 5:
        return False
    
    saat_dakika = simdi.hour * 100 + simdi.minute
    return 1000 <= saat_dakika <= 1830

def telegram_mesaj_gonder(mesaj):
    """Telegram üzerinden kullanıcıya mesaj gönderir"""
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": mesaj,
        "parse_mode": "Markdown"
    }
    try:
        requests.post(url, json=payload)
    except Exception as e:
        print(f"Telegram mesaj gönderme hatası: {e}")

def portfoy_getir():
    """Supabase'den güncel portföy verilerini çeker"""
    try:
        response = supabase.table("portfoy").select("*").execute()
        return response.data
    except Exception as e:
        print(f"Supabase veri çekme hatası: {e}")
        return []

def hisse_takip():
    global bildirim_zamanlari
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Takip başlatılıyor...")
    
    onceki_fiyatlar = {}

    while True:
        if not piyasa_acik_mi():
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Piyasa kapalı. Bekleniyor...")
            if os.getenv("GITHUB_ACTIONS"):
                break
            time.sleep(60)
            continue

        portfoy = portfoy_getir()
        if not portfoy:
            print("Portföy boş veya çekilemedi.")
            if os.getenv("GITHUB_ACTIONS"):
                break
            time.sleep(30)
            continue

        hedefe_ulasanlar = []
        simdi = datetime.now()
        
        print("\n" + "="*50)
        print(f"GÜNCEL DURUM - {simdi.strftime('%H:%M:%S')}")
        print("="*50)

        for item in portfoy:
            # ... (içerik aynı kalacak)
            hisse_kodu = item['hisse_kodu']
            maliyet = float(item['maliyet'])
            adet = float(item['adet'])
            hedef_yuzde = float(item['hedef_yuzde'] or 0)
            hedef_fiyat = maliyet * (1 + hedef_yuzde / 100)

            try:
                hisse = yf.Ticker(hisse_kodu)
                fiyat = hisse.fast_info['lastPrice']
            except Exception:
                continue

            # Değişim hesapla
            onceki = onceki_fiyatlar.get(hisse_kodu)
            icon = "-"
            degisim = 0
            if onceki:
                degisim = ((fiyat - onceki) / onceki) * 100
                icon = "▲" if fiyat > onceki else "▼" if fiyat < onceki else "-"
            
            onceki_fiyatlar[hisse_kodu] = fiyat

            kar_zarar_yuzde = ((fiyat - maliyet) / maliyet) * 100
            durum = "🟢" if kar_zarar_yuzde >= 0 else "🔴"

            print(f"{hisse_kodu: <10} | {fiyat:.2f} ₺ {icon} (%{degisim:+.2f}) | K/Z: %{kar_zarar_yuzde:.2f} {durum}")

            # Hedef kontrolü
            if fiyat >= hedef_fiyat:
                son_bildirim = bildirim_zamanlari.get(hisse_kodu)
                
                # Hiç bildirim gitmediyse veya üzerinden 30 dk geçtiyse
                if son_bildirim is None or (simdi - son_bildirim) >= timedelta(minutes=30):
                    hedefe_ulasanlar.append(f"⭐ *{hisse_kodu}* HEDEF VERİYE ULAŞTI!\nGüncel: {fiyat:.2f} ₺ >= Hedef: {hedef_fiyat:.2f} ₺")
                    bildirim_zamanlari[hisse_kodu] = simdi
            else:
                # Fiyat hedefin altına düşerse zamanı sıfırla (tekrar çıkarsa hemen atsın diye)
                if hisse_kodu in bildirim_zamanlari:
                    del bildirim_zamanlari[hisse_kodu]

        if hedefe_ulasanlar:
            mesaj = "\n\n".join(hedefe_ulasanlar)
            telegram_mesaj_gonder(mesaj)
            print("\n>>> Telegram bildirimi gönderildi!")

        print("="*50)
        
        # GitHub Actions ise döngüden çık
        if os.getenv("GITHUB_ACTIONS"):
            break
            
        time.sleep(30)

if __name__ == "__main__":
    try:
        hisse_takip()
    except KeyboardInterrupt:
        print("\nTakip durduruldu.")
