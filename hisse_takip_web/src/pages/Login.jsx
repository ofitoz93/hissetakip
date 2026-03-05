import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { LogIn, Lock, Mail } from 'lucide-react';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError('Giriş başarısız: ' + error.message);
        }
        setLoading(false);
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <div className="login-header">
                    <div className="login-logo">🚀</div>
                    <h1>Finans Takip Pro</h1>
                    <p>Devam etmek için giriş yapın</p>
                </div>

                <form onSubmit={handleLogin} className="login-form">
                    {error && <div className="login-error">{error}</div>}

                    <div className="form-group">
                        <label><Mail size={16} /> E-posta</label>
                        <input
                            type="email"
                            placeholder="E-posta adresiniz"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label><Lock size={16} /> Şifre</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="btn-login" disabled={loading}>
                        {loading ? 'Giriş yapılıyor...' : <><LogIn size={18} /> Giriş Yap</>}
                    </button>

                    <div className="login-footer">
                        <p>Kayıt alanı kapalıdır. Lütfen yöneticinizle iletişime geçin.</p>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default Login;
