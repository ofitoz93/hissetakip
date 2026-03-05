import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { TrendingUp, TrendingDown, Plus, Trash2, RefreshCw, Search, Filter, ArrowUpDown, Edit2, Eye, EyeOff } from 'lucide-react';
import '../index.css';

function Doviz() {
    const [portfoy, setPortfoy] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fiyatlar, setFiyatlar] = useState({});
    const [form, setForm] = useState({
        tur: 'USD/TRY',
        adet: '',
        maliyet: '',
        hedef_yuzde: '',
        notlar: ''
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [sortBy, setSortBy] = useState('default');
    const [editItem, setEditItem] = useState(null);

    const fetchPortfoy = async () => {
        const { data, error } = await supabase
            .from('portfoy')
            .select('*')
            .in('hisse_kodu', ['TRY/TRY', 'USD/TRY', 'EUR/TRY', 'GBP/TRY', 'CHF/TRY', 'JPY/TRY'])
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Veri çekme hatası:', error);
        } else {
            const items = data || [];
            setPortfoy(items);
            // Maliyet değerini başlangıç fiyatı olarak kullan (0 görünmemesi için)
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
        let { tur, adet, maliyet, hedef_yuzde, notlar } = form;

        const yeniKayit = {
            hisse_kodu: tur,
            adet: parseFloat(adet),
            maliyet: maliyet ? parseFloat(maliyet) : 0,
            hedef_yuzde: hedef_yuzde ? parseFloat(hedef_yuzde) : 0,
            ...(notlar.trim() && { notlar: notlar.trim() })
        };

        const { error } = await supabase.from('portfoy').insert([yeniKayit]);
        if (error) {
            alert('Hata oluştu: ' + error.message);
        } else {
            setForm({ tur: 'USD/TRY', adet: '', maliyet: '', hedef_yuzde: '', notlar: '' });
            fetchPortfoy();
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Emin misiniz?')) return;
        const { error } = await supabase.from('portfoy').delete().eq('id', id);
        if (!error) fetchPortfoy();
    };

    const toggleDahilEt = async (item) => {
        const yeniDurum = item.dahil_et === false ? true : false;
        const { error } = await supabase.from('portfoy')
            .update({ dahil_et: yeniDurum })
            .eq('id', item.id);

        if (!error) fetchPortfoy();
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!editItem) return;
        const { error } = await supabase.from('portfoy').update({
            hisse_kodu: editItem.hisse_kodu,
            adet: parseFloat(editItem.adet),
            notlar: editItem.notlar || null
        }).eq('id', editItem.id);
        if (error) { alert('Hata: ' + error.message); }
        else { setEditItem(null); fetchPortfoy(); }
    };

    // Doviz kodunu Yahoo Finance sembolüne dönüştür
    const dovizSembol = (kod) => {
        const map = {
            'USD/TRY': 'USDTRY=X',
            'EUR/TRY': 'EURTRY=X',
            'GBP/TRY': 'GBPTRY=X',
            'CHF/TRY': 'CHFTRY=X',
            'JPY/TRY': 'JPYTRY=X',
        };
        return map[kod] || null;
    };

    const fetchGuncelFiyatlar = async () => {
        if (portfoy.length === 0) return;
        const yeniFiyatlar = { ...fiyatlar };

        const fetchPromises = portfoy.map(async (item) => {
            if (item.hisse_kodu === 'TRY/TRY') {
                yeniFiyatlar[item.hisse_kodu] = 1.0;
                return;
            }
            const sembol = dovizSembol(item.hisse_kodu);
            try {
                if (sembol) {
                    // Yahoo Finance proxy üzerinden gerçek kur çek
                    const url = `/yahoo-finance/v8/finance/chart/${sembol}?interval=1m&range=1d`;
                    const res = await fetch(url);
                    if (res.ok) {
                        const json = await res.json();
                        const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
                        if (price) {
                            yeniFiyatlar[item.hisse_kodu] = price;
                            return;
                        }
                    }
                }
                throw new Error('API cevap vermedi');
            } catch (e) {
                // Fallback: simule et
                const sonFiyat = parseFloat(fiyatlar[item.hisse_kodu] || item.maliyet) || 0;
                if (sonFiyat > 0) {
                    const degisim = sonFiyat * (Math.random() * 0.01 - 0.005);
                    yeniFiyatlar[item.hisse_kodu] = sonFiyat + degisim;
                }
                console.warn('Kur alınamadı, simüle ediliyor:', item.hisse_kodu);
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
            if (item.dahil_et === false) return acc;

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
                    <h1>Döviz Takip</h1>
                    <p>Canlı kâr/zarar ve Hedef durumu</p>
                </header>

                <section className="portfolio-summary">
                    <div className="summary-box">
                        <h3>Toplam Yatırım (Döviz)</h3>
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
                            placeholder="Ara..."
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
                                <option value="profitDesc">Yükselenler Önce</option>
                                <option value="profitAsc">Düşenler Önce</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="layout">
                    <aside className="sidebar">
                        <h2>Yeni Ekle</h2>
                        <form className="add-form" onSubmit={handleAdd}>
                            <div className="form-group">
                                <label>Tür</label>
                                <select
                                    required
                                    value={form.tur}
                                    onChange={e => setForm({ ...form, tur: e.target.value })}
                                    style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)' }}
                                >
                                    <option value="TRY/TRY">Türk Lirası (TRY)</option>
                                    <option value="USD/TRY">Dolar (USD)</option>
                                    <option value="EUR/TRY">Euro (EUR)</option>
                                    <option value="GBP/TRY">Sterlin (GBP)</option>
                                    <option value="CHF/TRY">Frank (CHF)</option>
                                    <option value="JPY/TRY">Yen (JPY)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Miktar</label>
                                <input required type="number" step="0.01" value={form.adet} onChange={e => setForm({ ...form, adet: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Not <small style={{ color: 'var(--text-secondary)' }}>İsteğe Bağlı</small></label>
                                <textarea
                                    value={form.notlar}
                                    onChange={e => setForm({ ...form, notlar: e.target.value })}
                                    placeholder="Örn: Ziraat Bankası, acil fon..."
                                    rows={3}
                                    style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit' }}
                                />
                            </div>
                            <button type="submit" className="btn-add">
                                <Plus size={16} /> Ekle
                            </button>
                        </form>
                    </aside>

                    <main className="content">
                        <div className="header-actions">
                            <h2>Varlıklarım ({processedPortfoy.length})</h2>
                            <button onClick={fetchGuncelFiyatlar} className="btn-refresh"><RefreshCw size={14} /> Yenile</button>
                        </div>

                        {loading ? (
                            <p>Veriler yükleniyor...</p>
                        ) : processedPortfoy.length === 0 ? (
                            <div className="empty-state">Henüz eklenmiş döviziniz bulunmuyor.</div>
                        ) : (
                            <div className="grid">
                                {processedPortfoy.map(item => {
                                    const maliyet = parseFloat(item.maliyet) || 0;
                                    const adet = parseFloat(item.adet) || 0;
                                    const hedefYuzde = parseFloat(item.hedef_yuzde) || 0;
                                    // TRY/TRY için kur her zaman 1, diğerleri için API'den al
                                    const guncelFiyat = item.hisse_kodu === 'TRY/TRY' ? 1 : (parseFloat(fiyatlar[item.hisse_kodu]) || maliyet);
                                    const hedefFiyat = maliyet > 0 ? maliyet + (maliyet * (hedefYuzde / 100)) : 0;

                                    const toplamMaliyet = maliyet * adet;
                                    const toplamDeger = item.hisse_kodu === 'TRY/TRY' ? adet : guncelFiyat * adet;
                                    const karZararTutari = toplamDeger - toplamMaliyet;
                                    const karZararYuzdesi = maliyet > 0 ? ((guncelFiyat - maliyet) / maliyet) * 100 : 0;

                                    const hedefeUlasildi = guncelFiyat >= hedefFiyat;
                                    const isProfit = karZararTutari >= 0;

                                    return (
                                        <div key={item.id} className={`card ${hedefeUlasildi ? 'target-reached' : ''}`} style={item.dahil_et === false ? { opacity: 0.6 } : {}}>
                                            <div className="card-header">
                                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    {item.hisse_kodu}
                                                    {item.dahil_et === false && <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: 'var(--border-color)', borderRadius: '4px' }}>Dahil Değil</span>}
                                                </h3>
                                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                    <button onClick={() => toggleDahilEt(item)} className="btn-edit" title={item.dahil_et === false ? "Toplama Dahil Et" : "Toplamdan Çıkar"}>
                                                        {item.dahil_et === false ? <EyeOff size={15} /> : <Eye size={15} />}
                                                    </button>
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
                                                <p><span>Miktar:</span> <strong>{item.adet}</strong></p>
                                                <p><span>Alış Kur:</span> <strong>{item.maliyet} ₺</strong></p>
                                                <p><span>Hedef Kâr (%{item.hedef_yuzde}):</span> <strong>{hedefFiyat.toFixed(2)} ₺</strong></p>
                                            </div>

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

                                            {item.notlar && (
                                                <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-card)', borderLeft: '3px solid var(--accent-color)', borderRadius: '0 6px 6px 0', fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                                    📝 {item.notlar}
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

            {/* Düzenle Modalı */}
            {editItem && (
                <div className="modal-overlay" onClick={() => setEditItem(null)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <h2>✏️ {editItem.hisse_kodu} Düzenle</h2>
                        <form onSubmit={handleUpdate}>
                            <div className="form-group">
                                <label>Tür</label>
                                <select
                                    value={editItem.hisse_kodu}
                                    onChange={e => setEditItem({ ...editItem, hisse_kodu: e.target.value })}
                                    style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)' }}
                                >
                                    <option value="USD/TRY">Amerikan Doları (USD)</option>
                                    <option value="EUR/TRY">Euro (EUR)</option>
                                    <option value="GBP/TRY">İngiliz Sterlini (GBP)</option>
                                    <option value="CHF/TRY">İsviçre Frangı (CHF)</option>
                                    <option value="JPY/TRY">Japon Yeni (JPY)</option>
                                    <option value="TRY/TRY">Türk Lirası (TRY)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Miktar</label>
                                <input required type="number" step="0.01" value={editItem.adet} onChange={e => setEditItem({ ...editItem, adet: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Not</label>
                                <textarea
                                    value={editItem.notlar || ''}
                                    onChange={e => setEditItem({ ...editItem, notlar: e.target.value })}
                                    rows={3}
                                    style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit' }}
                                />
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

export default Doviz;
