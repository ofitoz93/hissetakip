import os
import yfinance as yf
import asyncio
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, ContextTypes
from dotenv import load_dotenv
from supabase import create_async_client, AsyncClient

# .env dosyasını yükle
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Merhaba! Borsa Takip Botu'na hoş geldiniz.\n\n"
        "Komutlar:\n"
        "/liste - Portföyünüzdeki tüm hisseleri listeler\n"
        "/hedef - Sadece hedefine ulaşmış hisseleri listeler\n"
        "Hisse Kodu (Örn: THY) - Yazdığınız hissenin güncel fiyatını verir."
    )

async def liste(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        # Daha güvenli bir başlatma
        supabase: AsyncClient = await create_async_client(SUPABASE_URL, SUPABASE_KEY)
        
        # tabloya erişimi dene
        table = supabase.table("portfoy")
        response = await table.select("*").execute()
        portfoy = response.data
        
        if not portfoy:
            await update.message.reply_text("Portföyünüzde henüz hisse bulunmuyor.")
            return

        mesaj = "📊 *Güncel Portföyünüz*\n\n"
        for item in portfoy:
            kod = item['hisse_kodu']
            maliyet = float(item['maliyet'])
            
            try:
                hisse = yf.Ticker(kod)
                fiyat = hisse.fast_info['lastPrice']
                kar_zarar = ((fiyat - maliyet) / maliyet) * 100
                durum = "🟢" if kar_zarar >= 0 else "🔴"
                mesaj += f"*{kod}* | Fiyat: {fiyat:.2f} ₺ | K/Z: %{kar_zarar:.2f} {durum}\n"
            except:
                mesaj += f"*{kod}* | Fiyat çekilemedi.\n"
        
        await update.message.reply_text(mesaj, parse_mode="Markdown")
        await supabase.auth.sign_out()
    except Exception as e:
        print(f"Hata detayı (liste): {type(e).__name__}: {e}")
        await update.message.reply_text(f"Bir hata oluştu: {e}")

async def hedef_liste(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        supabase: AsyncClient = await create_async_client(SUPABASE_URL, SUPABASE_KEY)
        response = await supabase.table("portfoy").select("*").execute()
        portfoy = response.data
        
        if not portfoy:
            await update.message.reply_text("Portföyünüzde henüz hisse bulunmuyor.")
            return

        hedefe_ulasanlar = []
        for item in portfoy:
            kod = item['hisse_kodu']
            maliyet = float(item['maliyet'])
            hedef_yuzde = float(item['hedef_yuzde'] or 0)
            hedef_fiyat = maliyet * (1 + hedef_yuzde / 100)
            
            try:
                hisse = yf.Ticker(kod)
                fiyat = hisse.fast_info['lastPrice']
                if fiyat >= hedef_fiyat:
                    kar_zarar = ((fiyat - maliyet) / maliyet) * 100
                    hedefe_ulasanlar.append(
                        f"⭐ *{kod}*\n"
                        f"Güncel: {fiyat:.2f} ₺\n"
                        f"Hedef: {hedef_fiyat:.2f} ₺ (%{hedef_yuzde})\n"
                        f"Kâr/Zarar: %{kar_zarar:.2f} 🟢"
                    )
            except:
                continue
        
        if not hedefe_ulasanlar:
            await update.message.reply_text("Şu an hedefine ulaşmış bir hisse bulunmuyor. ⏳")
        else:
            mesaj = "🎯 *Hedefe Ulaşmış Hisseleriniz*\n\n" + "\n\n".join(hedefe_ulasanlar)
            await update.message.reply_text(mesaj, parse_mode="Markdown")
        
        await supabase.auth.sign_out()
    except Exception as e:
        print(f"Hata detayı (hedef): {type(e).__name__}: {e}")
        await update.message.reply_text(f"Bildirim sorgusu sırasında hata: {e}")

async def hisse_sorgu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    hisse_kodu = update.message.text.strip().upper()
    
    # Kullanıcı sadece THY yazdıysa THYAO.IS olarak düzeltmeyi deneyelim veya uyaralım
    if hisse_kodu == "THY":
        hisse_kodu = "THYAO"
        
    if not hisse_kodu.endswith(".IS"):
        hisse_kodu += ".IS"

    try:
        supabase: AsyncClient = await create_async_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Yahoo sorgusu
        hisse = yf.Ticker(hisse_kodu)
        info = hisse.fast_info
        
        if 'lastPrice' not in info or info['lastPrice'] is None:
             await update.message.reply_text(f"Hisse verisi alınamadı: {hisse_kodu}\nLütfen geçerli bir kod girin (Örn: THYAO, SASA, ASELS)")
             await supabase.auth.sign_out()
             return

        fiyat = info['lastPrice']
        
        # Portföyde var mı kontrol et
        res = await supabase.table("portfoy").eq("hisse_kodu", hisse_kodu).execute()
        if res.data:
            item = res.data[0]
            maliyet = float(item['maliyet'])
            kar_zarar = ((fiyat - maliyet) / maliyet) * 100
            durum = "🟢" if kar_zarar >= 0 else "🔴"
            await update.message.reply_text(
                f"📈 *{hisse_kodu}*\n"
                f"Güncel: {fiyat:.2f} ₺\n"
                f"Maliyetiniz: {maliyet:.2f} ₺\n"
                f"Kâr/Zarar: %{kar_zarar:.2f} {durum}",
                parse_mode="Markdown"
            )
        else:
            await update.message.reply_text(
                f"📈 *{hisse_kodu}*\n"
                f"Güncel: {fiyat:.2f} ₺",
                parse_mode="Markdown"
            )
        await supabase.auth.sign_out()
    except Exception as e:
        print(f"Hata detayı (sorgu): {type(e).__name__}: {e}")
        await update.message.reply_text(f"Sorgu sırasında hata: {e}")


if __name__ == "__main__":
    app = ApplicationBuilder().token(TELEGRAM_BOT_TOKEN).build()
    
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("liste", liste))
    app.add_handler(CommandHandler("hedef", hedef_liste))
    app.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), hisse_sorgu))
    
    print("Bot başlatıldı...")
    app.run_polling()



