import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { TrendingUp, TrendingDown, Trash2, RefreshCw, Search, Filter, ArrowUpDown, EyeOff } from 'lucide-react';
import '../index.css';

function Ozet() {
    const [portfoy, setPortfoy] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fiyatlar, setFiyatlar] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [sortBy, setSortBy] = useState('default');

    const ALTIN_TURLERI = ['Gram Altın', 'Çeyrek Altın', 'Yarım Altın', 'Tam Altın', 'Cumhuriyet Altını', 'Ata Altın', 'Gümüş'];
    const DOVIZ_TURLERI = ['USD/TRY', 'EUR/TRY', 'GBP/TRY', 'CHF/TRY', 'JPY/TRY', 'TRY/TRY'];
    const DOVIZ_SEMBOL = { 'USD/TRY': 'USDTRY=X', 'EUR/TRY': 'EURTRY=X', 'GBP/TRY': 'GBPTRY=X', 'CHF/TRY': 'CHFTRY=X', 'JPY/TRY': 'JPYTRY=X' };
    const ALTIN_GRAM_CARPAN = { 'Gram Altın': 1, 'Çeyrek Altın': 1.75, 'Yarım Altın': 3.5, 'Tam Altın': 7.0, 'Cumhuriyet Altını': 7.016, 'Ata Altın': 7.0 };

    const fetchPortfoy = async () => {
        const { data, error } = await supabase
            .from('portfoy')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Veri çekme hatası:', error);
        } else {
            const items = data || [];
            setPortfoy(items);
            // Başlangıçta maliyet değerini göster (API gelmeden 0 görünmemesi için)
            const baslangicFiyatlari = {};
            items.forEach(item => {
                if (item.hisse_kodu === 'TRY/TRY') {
                    baslangicFiyatlari[item.hisse_kodu] = 1.0;
                } else {
                    const m = parseFloat(item.maliyet) || 0;
                    if (m > 0) baslangicFiyatlari[item.hisse_kodu] = m;
                }
            });
            setFiyatlar(baslangicFiyatlari);
        }
        setLoading(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Bu varlığı silmek istediğinize emin misiniz?')) return;
        const { error } = await supabase.from('portfoy').delete().eq('id', id);
        if (!error) fetchPortfoy();
    };

    const fetchGuncelFiyatlar = async () => {
        if (portfoy.length === 0) return;
        const yeniFiyatlar = { ...fiyatlar };

        try {
            // --- 1) USD/TRY kurunu al (hem altın hem döviz hesabı için gerekli) ---
            const resKur = await fetch('/yahoo-finance/v8/finance/chart/USDTRY=X?interval=1m&range=1d');
            let usdTry = null;
            if (resKur.ok) {
                const json = await resKur.json();
                usdTry = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
            }

            // --- 2) Altın ve Gümüş fiyatlarını çek ---
            let gramAltinFiyat = null;
            let gramGumulsFiyat = null;
            const varlikAltin = portfoy.some(i => ALTIN_TURLERI.includes(i.hisse_kodu));
            if (varlikAltin && usdTry) {
                const [resAltin, resGumus] = await Promise.all([
                    fetch('/yahoo-finance/v8/finance/chart/GC=F?interval=1m&range=1d'),
                    fetch('/yahoo-finance/v8/finance/chart/SI=F?interval=1m&range=1d'),
                ]);
                if (resAltin.ok) {
                    const json = await resAltin.json();
                    const p = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
                    if (p) gramAltinFiyat = (p * usdTry) / 31.1035;
                }
                if (resGumus.ok) {
                    const json = await resGumus.json();
                    const p = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
                    if (p) gramGumulsFiyat = (p * usdTry) / 31.1035;
                }
            }

            // --- 3) Her varlık için fiyatı güncelle ---
            const hisseFetchPromises = portfoy.map(async (item) => {
                const kod = item.hisse_kodu;

                if (ALTIN_TURLERI.includes(kod)) {
                    // Altın/Gümüş
                    if (kod === 'Gümüş' && gramGumulsFiyat) {
                        yeniFiyatlar[kod] = gramGumulsFiyat;
                    } else if (gramAltinFiyat) {
                        const carpan = ALTIN_GRAM_CARPAN[kod] || 1;
                        yeniFiyatlar[kod] = gramAltinFiyat * carpan;
                    }
                } else if (DOVIZ_TURLERI.includes(kod)) {
                    // Döviz (USD/TRY zaten var, diğerlerini çek)
                    if (kod === 'USD/TRY' && usdTry) {
                        yeniFiyatlar[kod] = usdTry;
                    } else if (kod === 'TRY/TRY') {
                        yeniFiyatlar[kod] = 1.0;
                    } else {
                        const sembol = DOVIZ_SEMBOL[kod];
                        if (sembol) {
                            const res = await fetch(`/yahoo-finance/v8/finance/chart/${sembol}?interval=1m&range=1d`);
                            if (res.ok) {
                                const json = await res.json();
                                const p = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
                                if (p) yeniFiyatlar[kod] = p;
                            }
                        }
                    }
                } else if (kod.endsWith('.IS')) {
                    // Hisse senedi
                    const res = await fetch(`/yahoo-finance/v8/finance/chart/${kod}?interval=1m&range=1d`);
                    if (res.ok) {
                        const json = await res.json();
                        const p = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
                        if (p) yeniFiyatlar[kod] = p;
                    }
                }
            });

            await Promise.all(hisseFetchPromises);
        } catch (e) {
            console.warn('Fiyat güncellenemedi:', e.message);
        }

        setFiyatlar(yeniFiyatlar);
    };

    useEffect(() => {
        fetchPortfoy();
    }, []);

    // İlk yükleme sonrası fiyatları hemen güncelle
    useEffect(() => {
        if (portfoy.length > 0) {
            fetchGuncelFiyatlar();
        }
    }, [portfoy.length]);

    useEffect(() => {
        const timer = setInterval(() => { fetchGuncelFiyatlar(); }, 30000);
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
        <div className="container" style={{ paddingTop: '60px' }}>
            <header className="header">
                <h1>Genel Portföy Özeti</h1>
                <p>Hisse, Maden ve Döviz varlıklarınızın tamamı</p>
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
                        placeholder="Varlık Ara..."
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

            <div className="layout" style={{ maxWidth: '100%', margin: '0 auto', padding: '2rem 4rem' }}>
                <main className="content" style={{ width: '100%' }}>
                    <div className="header-actions">
                        <h2>Tüm Varlıklarım ({processedPortfoy.length})</h2>
                        <button onClick={fetchGuncelFiyatlar} className="btn-refresh"><RefreshCw size={14} /> Yenile</button>
                    </div>

                    {loading ? (
                        <p>Veriler yükleniyor...</p>
                    ) : processedPortfoy.length === 0 ? (
                        <div className="empty-state">Henüz eklenmiş herhangi bir varlığınız bulunmuyor. Hisse, Altın veya Döviz sayfalarından ekleme yapabilirsiniz.</div>
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

                                let route = '/';
                                if (['Gram Altın', 'Çeyrek Altın', 'Yarım Altın', 'Tam Altın', 'Cumhuriyet Altını', 'Ata Altın', 'Gümüş'].includes(item.hisse_kodu)) {
                                    route = '/altin';
                                } else if (['TRY/TRY', 'USD/TRY', 'EUR/TRY', 'GBP/TRY', 'CHF/TRY', 'JPY/TRY'].includes(item.hisse_kodu)) {
                                    route = '/doviz';
                                }

                                return (
                                    <div key={item.id} className={`card ${hedefeUlasildi && route === '/' ? 'target-reached' : ''}`} style={item.dahil_et === false ? { opacity: 0.6 } : {}}>
                                        <div className="card-header">
                                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {item.hisse_kodu}
                                                {item.dahil_et === false && <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: 'var(--border-color)', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                                    <EyeOff size={10} /> Dahil Değil
                                                </span>}
                                            </h3>
                                            <Link to={route} className="badge" style={{ textDecoration: 'none', color: 'var(--accent-color)' }}>
                                                Detay →
                                            </Link>
                                        </div>

                                        <div className="price-info">
                                            <span className="current-price">{guncelFiyat.toFixed(2)} ₺</span>
                                            {route === '/' && (
                                                <span className={`badge ${isProfit ? 'badge-profit' : 'badge-loss'}`}>
                                                    {isProfit ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                                    %{Math.abs(karZararYuzdesi).toFixed(2)}
                                                </span>
                                            )}
                                        </div>

                                        <div className="details">
                                            <p><span>Adet/Miktar:</span> <strong>{item.adet}</strong></p>
                                            {route === '/' && (
                                                <>
                                                    <p><span>Alış/Maliyet:</span> <strong>{item.maliyet} ₺</strong></p>
                                                    <p><span>Güncel % Kâr:</span> <strong className={isProfit ? 'color-profit' : 'color-loss'}>%{karZararYuzdesi.toFixed(2)}</strong></p>
                                                    <p><span>Hedef (%{item.hedef_yuzde}):</span> <strong>{hedefFiyat.toFixed(2)} ₺</strong></p>
                                                </>
                                            )}
                                        </div>

                                        <div className="summary" style={{ flexDirection: 'column', gap: '0.5rem', textAlign: 'center', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                                            {route === '/' && (
                                                <div className="summary-col" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                    <small>Toplam Maliyet:</small>
                                                    <span>{toplamMaliyet.toFixed(2)} ₺</span>
                                                </div>
                                            )}
                                            <div className="summary-col" style={{ flexDirection: 'row', justifyContent: 'space-between', fontSize: '1.2rem' }}>
                                                <small>Toplam Değer:</small>
                                                <span className={isProfit && route === '/' ? 'color-profit' : (route === '/' ? 'color-loss' : '')}>{toplamDeger.toFixed(2)} ₺</span>
                                            </div>
                                        </div>

                                        {hedefeUlasildi && route === '/' && (
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

export default Ozet;
