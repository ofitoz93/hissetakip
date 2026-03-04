import yfinance as yf
import time

def hisse_verisi_getir(portfoy, onceki_fiyat):
    """
    Kullanıcının portföyündeki hisse senedinin anlık/güncel verilerini çeker ve
    kar/zarar ile hedef fiyat durumunu hesaplayıp ekrana yazdırır.
    """
    hisse_kodu = portfoy['kod']
    
    try:
        hisse = yf.Ticker(hisse_kodu)
        fiyat = hisse.fast_info['lastPrice']
    except Exception:
        print(f"{hisse_kodu} için fiyat bilgisi bulunamadı. Lütfen hisse kodunu kontrol edin veya piyasa bağlantısını bekleyin.")
        return onceki_fiyat

    zaman = time.strftime("%H:%M:%S")
    
    # Anlık Değişim (Bir önceki veri çekimine göre)
    anlik_degisim_yuzdesi = 0.0
    anlik_icon = "-"
    if onceki_fiyat is not None and onceki_fiyat > 0:
        anlik_degisim_yuzdesi = ((fiyat - onceki_fiyat) / onceki_fiyat) * 100
        if fiyat > onceki_fiyat:
            anlik_icon = "▲"
        elif fiyat < onceki_fiyat:
            anlik_icon = "▼"
    
    # Portfolio hesaplamaları
    maliyet = portfoy['maliyet']
    adet = portfoy['adet']
    hedef_fiyat = portfoy['hedef_fiyat']
    
    toplam_maliyet_tutari = maliyet * adet
    guncel_toplam_deger = fiyat * adet
    
    kar_zarar_tutari = guncel_toplam_deger - toplam_maliyet_tutari
    kar_zarar_yuzdesi = ((fiyat - maliyet) / maliyet) * 100 if maliyet > 0 else 0
    
    durum_renkli_ok = "🟢 KÂR" if kar_zarar_tutari >= 0 else "🔴 ZARAR"

    # Ekrana Yazdırma
    print(f"[{zaman}] {hisse_kodu: <9} | Güncel: {fiyat:.2f} ₺ {anlik_icon} (%{anlik_degisim_yuzdesi:.2f})")
    print(f"    └─ Toplam Değer : {guncel_toplam_deger:.2f} ₺ (Maliyet: {toplam_maliyet_tutari:.2f} ₺)")
    print(f"    └─ Kâr/Zarar    : {kar_zarar_tutari:.2f} ₺ | %{kar_zarar_yuzdesi:.2f} ({durum_renkli_ok})")

    # Hedef Kontrolü
    if fiyat >= hedef_fiyat:
        print(f"    ⭐ HEDEFE ULAŞILDI! (Güncel: {fiyat:.2f} ₺ >= Hedef: {hedef_fiyat:.2f} ₺)")
        
    return fiyat

def sayi_al(mesaj):
    while True:
        try:
            deger = input(mesaj).replace(',', '.')
            return float(deger)
        except ValueError:
            print("Lütfen geçerli bir sayı giriniz!")

def main():
    print("--- Borsa Portföy ve Hedef Takip Sistemi ---")
    istenen_hisse = input("Takip etmek istediğiniz hisse kodunu girin (Örn: BASGZ): ").strip().upper()
    
    if not istenen_hisse.endswith(".IS"):
        istenen_hisse += ".IS"

    adet = sayi_al(f"Kaç adet {istenen_hisse} hissesine sahipsiniz?: ")
    maliyet = sayi_al(f"{istenen_hisse} hissesinin alış maliyeti (Birim Fiyat ₺) nedir?: ")
    hedef_yuzde = sayi_al("Yüzde kaç (%) kârhedefi bekliyorsunuz? (Örn: 5): ")
    
    hedef_fiyat = maliyet + (maliyet * (hedef_yuzde / 100))
    
    portfoy = {
        'kod': istenen_hisse,
        'adet': adet,
        'maliyet': maliyet,
        'hedef_yuzde': hedef_yuzde,
        'hedef_fiyat': hedef_fiyat
    }

    print(f"\n--- Sistem Kaydedildi ---")
    print(f"Hisse: {istenen_hisse}")
    print(f"Adet: {adet} | Maliyet: {maliyet:.2f} ₺ | Toplam Yatırım: {(adet*maliyet):.2f} ₺")
    print(f"Hedeflenen Satış Fiyatı: {hedef_fiyat:.2f} ₺ (%{hedef_yuzde} Kâr)")
    print("------------------------------------------\n")
    print("Canlı izleme başlatılıyor... (Çıkış yapmak için Ctrl+C tuşlarına basabilirsiniz)\n")

    onceki_fiyat = None

    try:
        while True:
            onceki_fiyat = hisse_verisi_getir(portfoy, onceki_fiyat)
            print("-" * 55)
            time.sleep(10)
            
    except KeyboardInterrupt:
        print("\nCanlı takip işlemi kullanıcı tarafından sonlandırıldı.")

if __name__ == "__main__":
    main()
