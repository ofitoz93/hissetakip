import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { TrendingUp, TrendingDown, Plus, Trash2, RefreshCw, Search, Filter, History, Target } from 'lucide-react';
import '../index.css';

function Takip() {
    const [takipListesi, setTakipListesi] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fiyatlar, setFiyatlar] = useState({});
    const [form, setForm] = useState({
        tur: 'hisse',
        sembol: '',
        ad: ''
    });

    const fetchTakipListesi = async () => {
        const { data, error } = await supabase
            .from('takip_listesi')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Liste çekme hatası:', error);
        } else {
            setTakipListesi(data || []);
        }
        setLoading(false);
    };

    const getRealTimePrice = async (sembol, tur) => {
        try {
            let ticker = sembol;
            if (tur === 'hisse' && !ticker.endsWith('.IS')) {
                ticker += '.IS';
            } else if (tur === 'doviz') {
                const dovizMap = {
                    'USD/TRY': 'USDTRY=X',
                    'EUR/TRY': 'EURTRY=X',
                    'GBP/TRY': 'GBPTRY=X',
                    'CHF/TRY': 'CHFTRY=X',
                    'JPY/TRY': 'JPYTRY=X'
                };
                ticker = dovizMap[sembol] || sembol;
            } else if (tur === 'metal') {
                if (sembol === 'Gümüş') ticker = 'SI=F';
                else ticker = 'GC=F'; // Altın için
            }

            const url = `/yahoo-finance/v8/finance/chart/${ticker}?interval=1m&range=1d`;
            const res = await fetch(url);
            if (res.ok) {
                const json = await res.json();
                let price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;

                if (price && tur === 'metal') {
                    // Altın/Gümüş için gram fiyatına çevir
                    const resKur = await fetch('/yahoo-finance/v8/finance/chart/USDTRY=X?interval=1m&range=1d');
                    if (resKur.ok) {
                        const jsonKur = await resKur.json();
                        const usdTry = jsonKur?.chart?.result?.[0]?.meta?.regularMarketPrice;
                        if (usdTry) {
                            price = (price * usdTry) / 31.1035;
                            if (sembol !== 'Gram Altın' && sembol !== 'Gümüş') {
                                const ALTIN_GRAM_CARPAN = {
                                    'Çeyrek Altın': 1.75,
                                    'Yarım Altın': 3.5,
                                    'Tam Altın': 7.0,
                                    'Cumhuriyet Altını': 7.016,
                                    'Ata Altın': 7.0
                                };
                                price = price * (ALTIN_GRAM_CARPAN[sembol] || 1);
                            }
                        }
                    }
                }
                return price;
            }
        } catch (e) {
            console.error('Fiyat çekilemedi:', e);
        }
        return null;
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        setLoading(true);
        const { tur, sembol, ad } = form;

        let finalSembol = sembol.trim().toUpperCase();
        if (tur === 'hisse' && !finalSembol.endsWith('.IS')) finalSembol += '.IS';

        // Anlık fiyatı başlangıç fiyatı olarak al
        const currentPrice = await getRealTimePrice(finalSembol, tur);

        if (!currentPrice) {
            alert('Hisse/Varlık fiyatı alınamadı. Lütfen sembolü kontrol edin.');
            setLoading(false);
            return;
        }

        const yeniKayit = {
            sembol: finalSembol,
            ad: ad.trim() || finalSembol,
            tur,
            baslangic_fiyati: currentPrice
        };

        const { error } = await supabase.from('takip_listesi').insert([yeniKayit]);

        if (error) {
            alert('Hata oluştu: ' + error.message);
        } else {
            setForm({ tur: 'hisse', sembol: '', ad: '' });
            fetchTakipListesi();
        }
        setLoading(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Takip listesinden silmek istediğinize emin misiniz?')) return;
        const { error } = await supabase.from('takip_listesi').delete().eq('id', id);
        if (!error) fetchTakipListesi();
    };

    const fetchGuncelFiyatlar = async () => {
        if (takipListesi.length === 0) return;
        const yeniFiyatlar = { ...fiyatlar };

        const fetchPromises = takipListesi.map(async (item) => {
            const price = await getRealTimePrice(item.sembol, item.tur);
            if (price) {
                yeniFiyatlar[item.id] = price;
            }
        });

        await Promise.all(fetchPromises);
        setFiyatlar(yeniFiyatlar);
    };

    useEffect(() => {
        fetchTakipListesi();
    }, []);

    useEffect(() => {
        if (takipListesi.length > 0) {
            fetchGuncelFiyatlar();
            const timer = setInterval(fetchGuncelFiyatlar, 30000);
            return () => clearInterval(timer);
        }
    }, [takipListesi]);

    return (
        <div className="container" style={{ paddingTop: '60px' }}>
            <header className="header">
                <h1>Fiyat Takip Sistemi</h1>
                <p>Eklediğiniz andaki fiyata göre canlı değişim takibi</p>
            </header>

            <div className="layout">
                <aside className="sidebar">
                    <h2>Yeni Takip Ekle</h2>
                    <form className="add-form" onSubmit={handleAdd}>
                        <div className="form-group">
                            <label>Tür</label>
                            <select
                                value={form.tur}
                                onChange={e => setForm({ ...form, tur: e.target.value, sembol: '', ad: '' })}
                                style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)' }}
                            >
                                <option value="hisse">Borsa Hisse</option>
                                <option value="metal">Kıymetli Maden</option>
                                <option value="doviz">Döviz</option>
                            </select>
                        </div>

                        {form.tur === 'hisse' ? (
                            <div className="form-group">
                                <label>Hisse Kodu (Örn: THYAO)</label>
                                <input required type="text" value={form.sembol} onChange={e => setForm({ ...form, sembol: e.target.value })} placeholder="THYAO" />
                            </div>
                        ) : form.tur === 'metal' ? (
                            <div className="form-group">
                                <label>Maden Türü</label>
                                <select
                                    required
                                    value={form.sembol}
                                    onChange={e => setForm({ ...form, sembol: e.target.value, ad: e.target.value })}
                                    style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)' }}
                                >
                                    <option value="">Seçiniz...</option>
                                    <option value="Gram Altın">Gram Altın</option>
                                    <option value="Çeyrek Altın">Çeyrek Altın</option>
                                    <option value="Yarım Altın">Yarım Altın</option>
                                    <option value="Tam Altın">Tam Altın</option>
                                    <option value="Cumhuriyet Altını">Cumhuriyet Altını</option>
                                    <option value="Ata Altın">Ata Altın</option>
                                    <option value="Gümüş">Gümüş (Gram)</option>
                                </select>
                            </div>
                        ) : (
                            <div className="form-group">
                                <label>Döviz Çifti</label>
                                <select
                                    required
                                    value={form.sembol}
                                    onChange={e => setForm({ ...form, sembol: e.target.value, ad: e.target.value })}
                                    style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)' }}
                                >
                                    <option value="">Seçiniz...</option>
                                    <option value="USD/TRY">Dolar (USD)</option>
                                    <option value="EUR/TRY">Euro (EUR)</option>
                                    <option value="GBP/TRY">Sterlin (GBP)</option>
                                    <option value="CHF/TRY">Frank (CHF)</option>
                                    <option value="JPY/TRY">Yen (JPY)</option>
                                </select>
                            </div>
                        )}

                        <div className="form-group">
                            <label>Takip Adı (Örn: Benim Hissen)</label>
                            <input type="text" value={form.ad} onChange={e => setForm({ ...form, ad: e.target.value })} placeholder="İsteğe bağlı isim" />
                        </div>

                        <button type="submit" className="btn-add" disabled={loading}>
                            <Plus size={16} /> {loading ? 'Ekleniyor...' : 'Takibe Al'}
                        </button>
                    </form>
                </aside>

                <main className="content">
                    <div className="header-actions">
                        <h2>Takip Listem ({takipListesi.length})</h2>
                        <button onClick={fetchGuncelFiyatlar} className="btn-refresh"><RefreshCw size={14} /> Yenile</button>
                    </div>

                    {loading && takipListesi.length === 0 ? (
                        <p>Yükleniyor...</p>
                    ) : takipListesi.length === 0 ? (
                        <div className="empty-state">Henüz takibe aldığınız bir varlık yok. Sol taraftan ekleme yapabilirsiniz.</div>
                    ) : (
                        <div className="grid">
                            {takipListesi.map(item => {
                                const guncelFiyat = fiyatlar[item.id] || item.baslangic_fiyati;
                                const degisimYuzde = ((guncelFiyat - item.baslangic_fiyati) / item.baslangic_fiyati) * 100;
                                const isProfit = degisimYuzde >= 0;

                                return (
                                    <div key={item.id} className="card">
                                        <div className="card-header">
                                            <div>
                                                <small style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.7rem' }}>{item.tur}</small>
                                                <h3 style={{ marginTop: '0.2rem' }}>{item.ad}</h3>
                                                <code style={{ fontSize: '0.8rem', opacity: 0.7 }}>{item.sembol}</code>
                                            </div>
                                            <button onClick={() => handleDelete(item.id)} className="btn-delete" title="Takibi Bırak">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        <div className="price-info">
                                            <span className="current-price">{parseFloat(guncelFiyat).toFixed(2)} ₺</span>
                                            <span className={`badge ${isProfit ? 'badge-profit' : 'badge-loss'}`}>
                                                {isProfit ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                                %{Math.abs(degisimYuzde).toFixed(2)}
                                            </span>
                                        </div>

                                        <div className="details" style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}><History size={14} /> Kayıt Fiyatı:</span>
                                                <strong>{parseFloat(item.baslangic_fiyati).toFixed(2)} ₺</strong>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}><Target size={14} /> Değişim:</span>
                                                <strong className={isProfit ? 'color-profit' : 'color-loss'}>
                                                    {isProfit ? '+' : '-'}{Math.abs(guncelFiyat - item.baslangic_fiyati).toFixed(2)} ₺
                                                </strong>
                                            </div>
                                        </div>

                                        <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                                            Kayıt: {new Date(item.created_at).toLocaleString('tr-TR')}
                                        </div>
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

export default Takip;
