import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { TrendingUp, TrendingDown, Plus, Trash2, RefreshCw } from 'lucide-react';
import './index.css';

function App() {
  const [portfoy, setPortfoy] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fiyatlar, setFiyatlar] = useState({});
  const [form, setForm] = useState({
    hisse_kodu: '',
    adet: '',
    maliyet: '',
    hedef_yuzde: ''
  });

  // Supabase'den verileri çek
  const fetchPortfoy = async () => {
    const { data, error } = await supabase
      .from('portfoy')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Veri çekme hatası:', error);
    } else {
      setPortfoy(data || []);
    }
    setLoading(false);
  };

  // Yeni hisse ekle
  const handleAdd = async (e) => {
    e.preventDefault();
    let { hisse_kodu, adet, maliyet, hedef_yuzde } = form;
    hisse_kodu = hisse_kodu.trim().toUpperCase();
    if (!hisse_kodu.endsWith('.IS')) hisse_kodu += '.IS';

    const yeniKayit = {
      hisse_kodu,
      adet: parseFloat(adet),
      maliyet: parseFloat(maliyet),
      hedef_yuzde: parseFloat(hedef_yuzde)
    };

    const { error } = await supabase.from('portfoy').insert([yeniKayit]);
    if (error) {
      alert('Hata oluştu: ' + error.message);
    } else {
      setForm({ hisse_kodu: '', adet: '', maliyet: '', hedef_yuzde: '' });
      fetchPortfoy();
    }
  };

  // Hisse Sil
  const handleDelete = async (id) => {
    if (!window.confirm('Emin misiniz?')) return;
    const { error } = await supabase.from('portfoy').delete().eq('id', id);
    if (!error) fetchPortfoy();
  };

  // Canlı fiyatları API üzerinden (veya Yahoo'nun açık json uçlarından) çek
  // Not: Tarayıcı üzerinden yfinance çalışmadığı için Yahoo Finance'in v8 chart API'si mock/proxy mantığında kullanılabilir.
  // Burada demo amaçlı public CORS destekli bir api url veya basit fetch simülasyonu yapılacak.
  // Çoğu borsa apileri tarayıcı CORS engeline takıldığı için gerçek üretimde Next.js/Python bir ara sunucu(backend) gerekir.
  // Buradaki fetchYahoo sadece konsept gösterimidir.
  const fetchGuncelFiyatlar = async () => {
    if (portfoy.length === 0) return;

    // Her bir hisse için fiyat güncellemesi yapalım
    const yeniFiyatlar = { ...fiyatlar };

    for (const item of portfoy) {
      try {
        // Yahoo proxy/cors-anywhere veya bir public API kullanılmalı
        // Şimdilik demo simülasyonu: %0.5 oranında rastgele dalgalanma ekle
        const sonFiyat = fiyatlar[item.hisse_kodu] || item.maliyet;
        const degisim = sonFiyat * (Math.random() * 0.01 - 0.005);
        yeniFiyatlar[item.hisse_kodu] = sonFiyat + degisim;
      } catch (e) {
        console.error('Fiyat güncellenemedi', e);
      }
    }
    setFiyatlar(yeniFiyatlar);
  };

  useEffect(() => {
    fetchPortfoy();
  }, []);

  useEffect(() => {
    // 10 saniyede bir fiyatları güncelle
    const timer = setInterval(() => {
      fetchGuncelFiyatlar();
    }, 10000);
    return () => clearInterval(timer);
  }, [portfoy, fiyatlar]);


  return (
    <div className="container">
      <header className="header">
        <h1>Borsa Portföy Takip</h1>
        <p>Canlı kâr/zarar ve hedef durumu</p>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <h2>Yeni Hisse Ekle</h2>
          <form className="add-form" onSubmit={handleAdd}>
            <div className="form-group">
              <label>Hisse Kodu (Örn: BASGZ)</label>
              <input required type="text" value={form.hisse_kodu} onChange={e => setForm({ ...form, hisse_kodu: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Adet</label>
              <input required type="number" step="0.01" value={form.adet} onChange={e => setForm({ ...form, adet: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Birim Maliyet (₺)</label>
              <input required type="number" step="0.01" value={form.maliyet} onChange={e => setForm({ ...form, maliyet: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Hedef Kâr (%)</label>
              <input required type="number" step="0.01" value={form.hedef_yuzde} onChange={e => setForm({ ...form, hedef_yuzde: e.target.value })} />
            </div>
            <button type="submit" className="btn-add">
              <Plus size={16} /> Portföye Ekle
            </button>
          </form>
        </aside>

        <main className="content">
          <div className="header-actions">
            <h2>Hisselerim</h2>
            <button onClick={fetchGuncelFiyatlar} className="btn-refresh"><RefreshCw size={14} /> Yenile</button>
          </div>

          {loading ? (
            <p>Veriler yükleniyor...</p>
          ) : portfoy.length === 0 ? (
            <div className="empty-state">Henüz portföyünüzde hisse bulunmuyor. Sol taraftan ekleyebilirsiniz.</div>
          ) : (
            <div className="grid">
              {portfoy.map(item => {
                const guncelFiyat = fiyatlar[item.hisse_kodu] || item.maliyet;
                const hedefFiyat = parseFloat(item.maliyet) + (parseFloat(item.maliyet) * (parseFloat(item.hedef_yuzde) / 100));

                const toplamMaliyet = parseFloat(item.maliyet) * parseFloat(item.adet);
                const toplamDeger = guncelFiyat * parseFloat(item.adet);
                const karZararTutari = toplamDeger - toplamMaliyet;
                const karZararYuzdesi = ((guncelFiyat - item.maliyet) / item.maliyet) * 100;

                const hedefeUlasildi = guncelFiyat >= hedefFiyat;
                const isProfit = karZararTutari >= 0;

                return (
                  <div key={item.id} className={`card ${hedefeUlasildi ? 'target-reached' : ''}`}>
                    <div className="card-header">
                      <h3>{item.hisse_kodu}</h3>
                      <button onClick={() => handleDelete(item.id)} className="btn-delete" title="Sil"><Trash2 size={16} /></button>
                    </div>

                    <div className="price-info">
                      <span className="current-price">{guncelFiyat.toFixed(2)} ₺</span>
                      <span className={`badge ${isProfit ? 'badge-profit' : 'badge-loss'}`}>
                        {isProfit ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        %Math.abs({karZararYuzdesi.toFixed(2)})
                      </span>
                    </div>

                    <div className="details">
                      <p><span>Adet:</span> <strong>{item.adet}</strong></p>
                      <p><span>Maliyet:</span> <strong>{item.maliyet} ₺</strong></p>
                      <p><span>Güncel % Kâr:</span> <strong className={isProfit ? 'color-profit' : 'color-loss'}>%{karZararYuzdesi.toFixed(2)}</strong></p>
                      <p><span>Hedef Kâr (%{item.hedef_yuzde}):</span> <strong>{hedefFiyat.toFixed(2)} ₺</strong></p>
                    </div>

                    <div className="summary">
                      <div className="summary-col">
                        <small>Toplam Yatırım</small>
                        <span>{toplamMaliyet.toFixed(2)} ₺</span>
                      </div>
                      <div className="summary-col">
                        <small>Güncel Değer</small>
                        <span className={isProfit ? 'color-profit' : 'color-loss'}>{toplamDeger.toFixed(2)} ₺</span>
                      </div>
                    </div>

                    {hedefeUlasildi && (
                      <div className="alert-success">
                        ⭐ HEDEFE ULAŞILDI!
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
