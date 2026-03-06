// Auth page — sign in / sign up with email+password or OAuth (GitHub, Google)
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authClient } from '../../../shared/lib/authClient.js';

const GitHubIcon = () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
);

const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

// Password strength evaluator
function getPasswordStrength(pw) {
    if (!pw) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { score, label: 'Weak', color: '#ef4444' };
    if (score <= 2) return { score, label: 'Fair', color: '#f59e0b' };
    if (score <= 3) return { score, label: 'Good', color: '#3b82f6' };
    return { score, label: 'Strong', color: '#10b981' };
}

const EyeIcon = ({ open }) => open ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
);

const inputClass = "w-full px-4 py-3 bg-gray-800 border border-gray-700 focus:border-emerald-500 text-white placeholder-gray-500 rounded-xl text-sm outline-none transition-colors duration-200";

const AuthPage = () => {
    const navigate = useNavigate();
    const [mode, setMode] = useState('signin');

    // Sign-in fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Sign-up extra fields
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [signupEmail, setSignupEmail] = useState('');
    const [signupPassword, setSignupPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showSignupPw, setShowSignupPw] = useState(false);
    const [showConfirmPw, setShowConfirmPw] = useState(false);
    const [role, setRole] = useState('Entrepreneur');
    const [bio, setBio] = useState('');

    const [error, setError] = useState('');
    const [loading, setLoading] = useState('');

    const pwStrength = getPasswordStrength(signupPassword);

    const handleSignIn = async (e) => {
        e.preventDefault();
        setError('');
        setLoading('email');
        try {
            const { error: err } = await authClient.signIn.email({ email, password });
            if (err) { setError(err.message || 'Invalid email or password'); return; }
            navigate('/');
        } catch (err) {
            setError(err.message || 'Something went wrong');
        } finally {
            setLoading('');
        }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setError('');

        if (signupPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (signupPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        if (username.length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }

        setLoading('email');
        try {
            const { error: err } = await authClient.signUp.email({
                email: signupEmail,
                password: signupPassword,
                name: fullName,
                username,
                role,
                bio,
            });
            if (err) { setError(err.message || 'Sign up failed'); return; }
            navigate('/');
        } catch (err) {
            setError(err.message || 'Something went wrong');
        } finally {
            setLoading('');
        }
    };

    const handleSocial = async (provider) => {
        setError('');
        setLoading(provider);
        try {
            await authClient.signIn.social({ provider, callbackURL: '/' });
        } catch (err) {
            setError(err.message || `${provider} sign-in failed`);
            setLoading('');
        }
    };

    const switchMode = (m) => { setMode(m); setError(''); };

    return (
        <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'inherit' }}>
            {/* Background glow */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                <div style={{
                    position: 'absolute', top: '33%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '480px', height: '480px',
                    background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
                    borderRadius: '50%',
                }} />
                <div style={{
                    position: 'absolute', bottom: '10%', right: '15%',
                    width: '300px', height: '300px',
                    background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)',
                    borderRadius: '50%',
                }} />
            </div>

            <div style={{ position: 'relative', width: '100%', maxWidth: '460px' }}>
                {/* Logo */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
                    <img src="/logo.png" alt="Invesa" style={{ height: '40px', width: 'auto' }} />
                </div>

                {/* Card */}
                <div style={{
                    background: 'linear-gradient(135deg, #111827 0%, #0f172a 100%)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '20px',
                    padding: mode === 'signup' ? '28px' : '32px',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(16,185,129,0.05)',
                }}>
                    {/* Mode tabs */}
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '4px', marginBottom: '24px', gap: '4px' }}>
                        {['signin', 'signup'].map((m) => (
                            <button
                                key={m}
                                onClick={() => switchMode(m)}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    borderRadius: '9px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    transition: 'all 0.2s ease',
                                    background: mode === m ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                                    color: mode === m ? '#000' : '#9ca3af',
                                    boxShadow: mode === m ? '0 4px 12px rgba(16,185,129,0.3)' : 'none',
                                }}
                            >
                                {m === 'signin' ? 'Sign In' : 'Sign Up'}
                            </button>
                        ))}
                    </div>

                    {/* Social buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                        <button
                            onClick={() => handleSocial('github')}
                            disabled={!!loading}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                padding: '12px 16px', background: '#1a1a1a',
                                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
                                color: '#fff', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                                transition: 'all 0.2s', opacity: loading ? 0.5 : 1,
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#222'}
                            onMouseLeave={e => e.currentTarget.style.background = '#1a1a1a'}
                        >
                            {loading === 'github'
                                ? <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                                : <GitHubIcon />}
                            Continue with GitHub
                        </button>
                        <button
                            onClick={() => handleSocial('google')}
                            disabled={!!loading}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                padding: '12px 16px', background: '#fff',
                                border: '1px solid #e5e7eb', borderRadius: '12px',
                                color: '#1f2937', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                                transition: 'all 0.2s', opacity: loading ? 0.5 : 1,
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                        >
                            {loading === 'google'
                                ? <span style={{ width: 18, height: 18, border: '2px solid #d1d5db', borderTopColor: '#374151', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                                : <GoogleIcon />}
                            Continue with Google
                        </button>
                    </div>

                    {/* Divider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
                        <span style={{ color: '#6b7280', fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap' }}>or continue with email</span>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
                    </div>

                    {/* ── SIGN IN FORM ── */}
                    {mode === 'signin' && (
                        <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#d1d5db', marginBottom: '6px' }}>Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    required
                                    className={inputClass}
                                    style={{ display: 'block', width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '12px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                                    onFocus={e => e.target.style.borderColor = '#10b981'}
                                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#d1d5db', marginBottom: '6px' }}>Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        style={{ display: 'block', width: '100%', padding: '12px 44px 12px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '12px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                                        onFocus={e => e.target.style.borderColor = '#10b981'}
                                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
                                    />
                                    <button type="button" onClick={() => setShowPassword(v => !v)}
                                        style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                        <EyeIcon open={showPassword} />
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '10px 14px', color: '#f87171', fontSize: '13px' }}>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={!!loading}
                                style={{
                                    width: '100%', padding: '13px', borderRadius: '12px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: '#000', fontWeight: 700, fontSize: '14px',
                                    boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
                                    opacity: loading ? 0.6 : 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {loading === 'email' && <span style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />}
                                Sign In
                            </button>

                            <p style={{ textAlign: 'center', margin: 0 }}>
                                <a href="/forgot-password" style={{ color: '#10b981', fontSize: '13px', textDecoration: 'none' }}>
                                    Forgot password?
                                </a>
                            </p>
                        </form>
                    )}

                    {/* ── SIGN UP FORM ── */}
                    {mode === 'signup' && (
                        <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                            {/* Role selector — pill toggle */}
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#d1d5db', marginBottom: '8px' }}>
                                    I am a <span style={{ color: '#10b981' }}>*</span>
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    {['Entrepreneur', 'Investor'].map((r) => (
                                        <button
                                            key={r}
                                            type="button"
                                            onClick={() => setRole(r)}
                                            style={{
                                                padding: '11px 12px',
                                                borderRadius: '12px',
                                                border: role === r ? '1.5px solid #10b981' : '1.5px solid rgba(255,255,255,0.08)',
                                                background: role === r ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)',
                                                color: role === r ? '#10b981' : '#9ca3af',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '7px',
                                            }}
                                        >
                                            <span style={{ fontSize: '16px' }}>{r === 'Entrepreneur' ? '🚀' : '💼'}</span>
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Full Name + Username row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#d1d5db', marginBottom: '6px' }}>
                                        Full Name <span style={{ color: '#10b981' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={e => setFullName(e.target.value)}
                                        placeholder="John Doe"
                                        required
                                        style={{ display: 'block', width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '12px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                                        onFocus={e => e.target.style.borderColor = '#10b981'}
                                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#d1d5db', marginBottom: '6px' }}>
                                        Username <span style={{ color: '#10b981' }}>*</span>
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#10b981', fontSize: '14px', fontWeight: 600 }}>@</span>
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                                            placeholder="johndoe"
                                            required
                                            minLength={3}
                                            maxLength={30}
                                            style={{ display: 'block', width: '100%', padding: '11px 14px 11px 28px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '12px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                                            onFocus={e => e.target.style.borderColor = '#10b981'}
                                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#d1d5db', marginBottom: '6px' }}>
                                    Email <span style={{ color: '#10b981' }}>*</span>
                                </label>
                                <input
                                    type="email"
                                    value={signupEmail}
                                    onChange={e => setSignupEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    required
                                    style={{ display: 'block', width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '12px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                                    onFocus={e => e.target.style.borderColor = '#10b981'}
                                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
                                />
                            </div>

                            {/* Password */}
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#d1d5db', marginBottom: '6px' }}>
                                    Password <span style={{ color: '#10b981' }}>*</span>
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showSignupPw ? 'text' : 'password'}
                                        value={signupPassword}
                                        onChange={e => setSignupPassword(e.target.value)}
                                        placeholder="Min. 8 characters"
                                        required
                                        minLength={8}
                                        style={{ display: 'block', width: '100%', padding: '11px 44px 11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '12px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                                        onFocus={e => e.target.style.borderColor = '#10b981'}
                                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
                                    />
                                    <button type="button" onClick={() => setShowSignupPw(v => !v)}
                                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                        <EyeIcon open={showSignupPw} />
                                    </button>
                                </div>
                                {/* Strength meter */}
                                {signupPassword && (
                                    <div style={{ marginTop: '8px' }}>
                                        <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <div key={i} style={{
                                                    flex: 1, height: '3px', borderRadius: '2px',
                                                    background: i <= pwStrength.score ? pwStrength.color : 'rgba(255,255,255,0.1)',
                                                    transition: 'background 0.3s',
                                                }} />
                                            ))}
                                        </div>
                                        <span style={{ fontSize: '11px', color: pwStrength.color, fontWeight: 500 }}>{pwStrength.label}</span>
                                    </div>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#d1d5db', marginBottom: '6px' }}>
                                    Confirm Password <span style={{ color: '#10b981' }}>*</span>
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showConfirmPw ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder="Re-enter password"
                                        required
                                        style={{
                                            display: 'block', width: '100%', padding: '11px 44px 11px 14px',
                                            background: 'rgba(255,255,255,0.04)',
                                            border: `1px solid ${confirmPassword && confirmPassword !== signupPassword ? '#ef4444' : confirmPassword && confirmPassword === signupPassword ? '#10b981' : 'rgba(255,255,255,0.09)'}`,
                                            borderRadius: '12px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s'
                                        }}
                                    />
                                    <button type="button" onClick={() => setShowConfirmPw(v => !v)}
                                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                        <EyeIcon open={showConfirmPw} />
                                    </button>
                                    {confirmPassword && confirmPassword === signupPassword && (
                                        <span style={{ position: 'absolute', right: '38px', top: '50%', transform: 'translateY(-50%)', color: '#10b981', fontSize: '14px' }}>✓</span>
                                    )}
                                </div>
                            </div>

                            {/* Bio (optional) */}
                            <div>
                                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: 500, color: '#d1d5db', marginBottom: '6px' }}>
                                    <span>Bio <span style={{ color: '#6b7280', fontWeight: 400 }}>(optional)</span></span>
                                    <span style={{ fontSize: '11px', color: bio.length > 220 ? '#f59e0b' : '#6b7280' }}>{bio.length}/250</span>
                                </label>
                                <textarea
                                    value={bio}
                                    onChange={e => setBio(e.target.value.slice(0, 250))}
                                    placeholder="Tell investors/entrepreneurs about yourself..."
                                    rows={2}
                                    style={{ display: 'block', width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '12px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s', lineHeight: 1.5 }}
                                    onFocus={e => e.target.style.borderColor = '#10b981'}
                                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
                                />
                            </div>

                            {error && (
                                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '10px 14px', color: '#f87171', fontSize: '13px' }}>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={!!loading}
                                style={{
                                    width: '100%', padding: '13px', borderRadius: '12px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: '#000', fontWeight: 700, fontSize: '14px',
                                    boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
                                    opacity: loading ? 0.6 : 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    transition: 'all 0.2s',
                                    marginTop: '2px',
                                }}
                            >
                                {loading === 'email' && <span style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />}
                                Create Account
                            </button>
                        </form>
                    )}
                </div>

                <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#4b5563' }}>
                    By continuing, you agree to Invesa&apos;s Terms of Service
                </p>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                input::placeholder, textarea::placeholder { color: #6b7280; }
                button:hover:not(:disabled) { transform: translateY(-1px); }
                button:active:not(:disabled) { transform: translateY(0); }
            `}</style>
        </div>
    );
};

export default AuthPage;
