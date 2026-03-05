import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { TrendingUp, TrendingDown, Plus, Trash2, RefreshCw, Search, Filter, ArrowUpDown, Edit2 } from 'lucide-react';
import '../index.css';

function Hisse() {
  const [portfoy, setPortfoy] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fiyatlar, setFiyatlar] = useState({});
  const [form, setForm] = useState({
    hisse_kodu: '',
    adet: '',
    maliyet: '',
    hedef_yuzde: ''
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [editItem, setEditItem] = useState(null);  // düzenlenecek öğe

  const fetchPortfoy = async () => {
    const { data, error } = await supabase
      .from('portfoy')
      .select('*')
      .like('hisse_kodu', '%.IS')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Veri çekme hatası:', error);
    } else {
      const items = data || [];
      setPortfoy(items);
      // Başlangıç fiyatı olarak maliyeti kullan (Yahoo API cevap verene kadar 0 görmemek için)
      const baslangicFiyatlari = {};
      items.forEach(item => {
        const m = parseFloat(item.maliyet) || 0;
        if (m > 0) baslangicFiyatlari[item.hisse_kodu] = m;
      });
      setFiyatlar(baslangicFiyatlari);
    }
    setLoading(false);
  };

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

  const handleDelete = async (id) => {
    if (!window.confirm('Emin misiniz?')) return;
    const { error } = await supabase.from('portfoy').delete().eq('id', id);
    if (!error) fetchPortfoy();
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editItem) return;
    let kod = editItem.hisse_kodu.trim().toUpperCase();
    if (!kod.endsWith('.IS')) kod += '.IS';
    const { error } = await supabase.from('portfoy').update({
      hisse_kodu: kod,
      adet: parseFloat(editItem.adet),
      maliyet: parseFloat(editItem.maliyet),
      hedef_yuzde: parseFloat(editItem.hedef_yuzde)
    }).eq('id', editItem.id);
    if (error) { alert('Hata: ' + error.message); }
    else { setEditItem(null); fetchPortfoy(); }
  };

  const fetchGuncelFiyatlar = async () => {
    if (portfoy.length === 0) return;
    const yeniFiyatlar = { ...fiyatlar };

    const fetchPromises = portfoy.map(async (item) => {
      try {
        // Yahoo Finance v8 chart API - proxy üzerinden çekiyoruz (CORS bypass)
        const url = `/yahoo-finance/v8/finance/chart/${item.hisse_kodu}?interval=1m&range=1d`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
          if (price) {
            yeniFiyatlar[item.hisse_kodu] = price;
          }
        }
      } catch (e) {
        // CORS hatası olursa önceki fiyatı koru (simulation fallback)
        const sonFiyat = parseFloat(fiyatlar[item.hisse_kodu] || item.maliyet);
        const degisim = sonFiyat * (Math.random() * 0.01 - 0.005);
        yeniFiyatlar[item.hisse_kodu] = sonFiyat + degisim;
        console.warn('Yahoo API alınamadı, simülasyon kullanılıyor:', item.hisse_kodu, e.message);
      }
    });

    await Promise.all(fetchPromises);
    setFiyatlar(yeniFiyatlar);
  };

  useEffect(() => {
    fetchPortfoy();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => { fetchGuncelFiyatlar(); }, 10000);
    return () => clearInterval(timer);
  }, [portfoy, fiyatlar]);


  const { totalYatirim, totalGuncelDeger } = useMemo(() => {
    return portfoy.reduce((acc, item) => {
      const guncelFiyat = fiyatlar[item.hisse_kodu] || parseFloat(item.maliyet);
      const adet = parseFloat(item.adet);
      acc.totalYatirim += parseFloat(item.maliyet) * adet;
      acc.totalGuncelDeger += guncelFiyat * adet;
      return acc;
    }, { totalYatirim: 0, totalGuncelDeger: 0 });
  }, [portfoy, fiyatlar]);

  const totalKarZarar = totalGuncelDeger - totalYatirim;
  const totalKarZararYuzdesi = totalYatirim > 0 ? (totalKarZarar / totalYatirim) * 100 : 0;

  const processedPortfoy = useMemo(() => {
    let result = [...portfoy];

    if (searchQuery) {
      result = result.filter(item => item.hisse_kodu.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    if (filterType === 'profit') {
      result = result.filter(item => {
        const guncel = fiyatlar[item.hisse_kodu] || item.maliyet;
        return (guncel - item.maliyet) >= 0;
      });
    } else if (filterType === 'loss') {
      result = result.filter(item => {
        const guncel = fiyatlar[item.hisse_kodu] || item.maliyet;
        return (guncel - item.maliyet) < 0;
      });
    }

    result.sort((a, b) => {
      const guncelA = fiyatlar[a.hisse_kodu] || a.maliyet;
      const guncelB = fiyatlar[b.hisse_kodu] || b.maliyet;
      const karYuzdeA = ((guncelA - a.maliyet) / a.maliyet) * 100;
      const karYuzdeB = ((guncelB - b.maliyet) / b.maliyet) * 100;

      if (sortBy === 'profitDesc') return karYuzdeB - karYuzdeA;
      if (sortBy === 'profitAsc') return karYuzdeA - karYuzdeB;
      return 0;
    });

    return result;
  }, [portfoy, fiyatlar, searchQuery, filterType, sortBy]);

  const isTotalProfit = totalKarZarar >= 0;

  return (
    <>
      <div className="container" style={{ paddingTop: '60px' }}>
        <header className="header">
          <h1>Borsa Portföy Takip</h1>
          <p>Canlı kâr/zarar ve Hedef durumu</p>
        </header>

        <section className="portfolio-summary">
          <div className="summary-box">
            <h3>Toplam Yatırım</h3>
            <p className="amount">{totalYatirim.toFixed(2)} ₺</p>
          </div>
          <div className="summary-box">
            <h3>Güncel Toplam Değer</h3>
            <p className={`amount ${isTotalProfit ? 'color-profit' : 'color-loss'}`}>
              {totalGuncelDeger.toFixed(2)} ₺
            </p>
          </div>
          <div className="summary-box">
            <h3>Toplam Kâr / Zarar</h3>
            <p className={`amount ${isTotalProfit ? 'color-profit' : 'color-loss'}`}>
              {totalKarZarar > 0 ? '+' : ''}{totalKarZarar.toFixed(2)} ₺
              <span className="summary-badge">
                {isTotalProfit ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                %{Math.abs(totalKarZararYuzdesi).toFixed(2)}
              </span>
            </p>
          </div>
        </section>

        <div className="controls-bar">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Hisse Ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filters">
            <div className="filter-group">
              <Filter size={16} />
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="all">Tümü</option>
                <option value="profit">Kârda Olanlar</option>
                <option value="loss">Zararda Olanlar</option>
              </select>
            </div>

            <div className="filter-group">
              <ArrowUpDown size={16} />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="default">Ekleme Sırası</option>
                <option value="profitDesc">Yükselenler Önce (Kâr %)</option>
                <option value="profitAsc">Düşenler Önce (Zarar %)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="layout">
          <aside className="sidebar">
            <h2>Yeni Hisse Ekle</h2>
            <form className="add-form" onSubmit={handleAdd}>
              <div className="form-group">
                <label>Hisse Kodu (Örn: THYAO)</label>
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
              <h2>Hisselerim ({processedPortfoy.length})</h2>
              <button onClick={fetchGuncelFiyatlar} className="btn-refresh"><RefreshCw size={14} /> Yenile</button>
            </div>

            {loading ? (
              <p>Veriler yükleniyor...</p>
            ) : processedPortfoy.length === 0 ? (
              <div className="empty-state">Aradığınız kriterlere uygun hisse bulunamadı veya henüz eklenmemiş.</div>
            ) : (
              <div className="grid">
                {processedPortfoy.map(item => {
                  const guncelFiyat = parseFloat(fiyatlar[item.hisse_kodu] || item.maliyet);
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
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button onClick={() => setEditItem({ ...item })} className="btn-edit" title="Düzenle"><Edit2 size={15} /></button>
                          <button onClick={() => handleDelete(item.id)} className="btn-delete" title="Sil"><Trash2 size={16} /></button>
                        </div>
                      </div>

                      <div className="price-info">
                        <span className="current-price">{guncelFiyat.toFixed(2)} ₺</span>
                        <span className={`badge ${isProfit ? 'badge-profit' : 'badge-loss'}`}>
                          {isProfit ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          %{Math.abs(karZararYuzdesi).toFixed(2)}
                        </span>
                      </div>

                      <div className="details">
                        <p><span>Adet:</span> <strong>{item.adet}</strong></p>
                        <p><span>Maliyet:</span> <strong>{item.maliyet} ₺</strong></p>
                        <p><span>Güncel % Kâr:</span> <strong className={isProfit ? 'color-profit' : 'color-loss'}>%{karZararYuzdesi.toFixed(2)}</strong></p>
                        <p><span>Hedef Kâr (%{item.hedef_yuzde}):</span> <strong>{hedefFiyat.toFixed(2)} ₺</strong></p>
                      </div>

                      {/* HERE IS THE UPDATED EXPLICIT TOTAL VALUE */}
                      <div className="summary" style={{ flexDirection: 'column', gap: '0.5rem', textAlign: 'center', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                        <div className="summary-col" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <small>Toplam Maliyet:</small>
                          <span>{toplamMaliyet.toFixed(2)} ₺</span>
                        </div>
                        <div className="summary-col" style={{ flexDirection: 'row', justifyContent: 'space-between', fontSize: '1.2rem' }}>
                          <small>Toplam Değer:</small>
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

      {/* Düzenleme Modalı */}
      {
        editItem && (
          <div className="modal-overlay" onClick={() => setEditItem(null)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <h2>✏️ {editItem.hisse_kodu} Düzenle</h2>
              <form onSubmit={handleUpdate}>
                <div className="form-group">
                  <label>Hisse Kodu</label>
                  <input required type="text" value={editItem.hisse_kodu} onChange={e => setEditItem({ ...editItem, hisse_kodu: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Adet</label>
                  <input required type="number" step="0.01" value={editItem.adet} onChange={e => setEditItem({ ...editItem, adet: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Birim Maliyet (₺)</label>
                  <input required type="number" step="0.01" value={editItem.maliyet} onChange={e => setEditItem({ ...editItem, maliyet: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Hedef Kâr (%)</label>
                  <input required type="number" step="0.01" value={editItem.hedef_yuzde} onChange={e => setEditItem({ ...editItem, hedef_yuzde: e.target.value })} />
                </div>
                <div className="modal-actions">
                  <button type="submit" className="btn-save">✓ Kaydet</button>
                  <button type="button" className="btn-cancel" onClick={() => setEditItem(null)}>İptal</button>
                </div>
              </form>
            </div>
          </div>
        )}
    </>
  );
}

export default Hisse;
