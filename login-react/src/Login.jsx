import React, { useState, useEffect } from 'react';
import './Login.css';

const API = '/attendance-dashboard/api/index.php';
const DASH = '/attendance-dashboard/index.html';

export default function Login() {
    console.log('🔴🔴🔴 LOGIN COMPONENT MOUNTED - MODAL DEBUG ENABLED 🔴🔴🔴');
    const [form, setForm] = useState({ username: '', password: '' });
    const [errors, setErrors] = useState({});
    const [showPass, setShowPass] = useState(false);
    const [remember, setRemember] = useState(false);
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState(null);   // { type, msg }

    const [showPasswordSetup, setShowPasswordSetup] = useState(false);
    const [tempUserId, setTempUserId] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordStrength, setPasswordStrength] = useState('');

    // Debug useEffect - Add this
    useEffect(() => {
        console.log('🔴🔴🔴 showPasswordSetup VALUE CHANGED TO:', showPasswordSetup);
        if (showPasswordSetup === true) {
            console.log('🔴🔴🔴 MODAL SHOULD BE VISIBLE NOW!');
            setTimeout(() => {
                const modal = document.querySelector('.modal-overlay');
                console.log('Modal element in DOM:', modal ? 'YES - FOUND' : 'NO - NOT FOUND');
                if (modal) {
                    console.log('Modal display style:', window.getComputedStyle(modal).display);
                }
            }, 100);
        }
    }, [showPasswordSetup]);

    // Restore remembered username & check session
    useEffect(() => {
        try {
            const mem = JSON.parse(localStorage.getItem('hrms_remember') || 'null');
            if (mem?.username) { setForm(f => ({ ...f, username: mem.username })); setRemember(true); }
            
            // Check local storage for session instead of calling API check_session
            const userSession = localStorage.getItem('hrms_user');
            if (userSession) {
                window.location.replace(DASH);
            }
        } catch (_) { }
    }, []);

    const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

    function validate() {
        const e = {};
        if (!form.username.trim()) e.username = 'Username is required';
        if (!form.password) e.password = 'Password is required';
        setErrors(e);
        return !Object.keys(e).length;
    }

    function checkPasswordStrength(password) {
        if (!password) {
            return '';
        } 
        let strength = 0;
        if (password.length >= 8) {
            strength++;
        } 
        if (/[A-Z]/.test(password)) {
            strength++;
        }
        if (/[a-z]/.test(password)) {
            strength++;
        }
        if (/[0-9]/.test(password)) {
            strength++;
        }
        
        if (strength <= 2) {
            return 'Weak';
        }
        if (strength <= 3) {
            return 'Medium';
        }
        return 'Strong';
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setAlert(null);
        if (!validate()) {
            return;
        } 
        setLoading(true);

        try {
            const res = await fetch(API, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'login',
                    username: form.username.trim(),
                    password: form.password
                })
            });

            const data = await res.json();

            setLoading(false);

            console.log('FULL RESPONSE:', data);
            console.log('require_password_setup value:', data.require_password_setup);

            if (data.require_password_setup === true) {
                console.log('PASSWORD SETUP REQUIRED');

                setTempUserId(data.user_id);
                setShowPasswordSetup(true);

                setAlert({
                    type: 'info',
                    msg: 'First time login! Please set your password.'
                });

                return;
            }

            if (data.success) {

                if (remember) {
                    localStorage.setItem(
                        'hrms_remember',
                        JSON.stringify({
                            username: form.username.trim()
                        })
                    );
                } else {
                    localStorage.removeItem('hrms_remember');
                }

                localStorage.setItem(
                    'hrms_user',
                    JSON.stringify(data.user)
                );

                setAlert({
                    type: 'success',
                    msg: 'Login successful! Redirecting...'
                });

                setTimeout(() => {
                    window.location.replace(DASH);
                }, 900);

            } else {

                setAlert({
                    type: 'error',
                    msg: data.message || 'Invalid credentials.'
                });

                if (res.status === 401) {
                    setForm(f => ({
                        ...f,
                        password: ''
                    }));

                    setErrors({
                        password: 'Incorrect credentials'
                    });
                }
            }

        } catch (error) {
            console.error('Login error:', error);

            setLoading(false);

            setAlert({
                type: 'error',
                msg: 'Server error. Please try again.'
            });
        }
    }

    async function handlePasswordSetup(e) {
        e.preventDefault();
        setPasswordError('');
        
        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match');
            return;
        }
        
        if (newPassword.length < 4) {
            setPasswordError('Password must be at least 4 characters');
            return;
        }
        
        setLoading(true);
        try {
            const res = await fetch(API, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'setup_password', 
                    user_id: tempUserId, 
                    new_password: newPassword,
                    confirm_password: confirmPassword
                }),
            });
            const data = await res.json();
            setLoading(false);
            
            if (data.success) {
                if (remember) localStorage.setItem('hrms_remember', JSON.stringify({ username: form.username.trim() }));
                else localStorage.removeItem('hrms_remember');
                
                localStorage.setItem('hrms_user', JSON.stringify(data.user));
                setAlert({ type: 'success', msg: 'Password set successfully! Redirecting…' });
                setTimeout(() => { window.location.replace(DASH); }, 900);
            } else {
                setPasswordError(data.message);
            }
        } catch (error) {
            setLoading(false);
            setPasswordError('Server error. Please try again.');
        }
    }

    return (
        <div className="page">
            {/* Animated background */}
            <div className="bg">
                <div className="blob b1" /><div className="blob b2" />
                <div className="blob b3" /><div className="blob b4" />
                <div className="dots" />
            </div>

            <div className="layout">
                {/* ─ Left panel ─ */}
                <aside className="left">
                    <div className="brand">
                        <span className="badge"><span className="pulse" />HR System</span>
                        <h1>Smart<br /><em>Attendance</em></h1>
                        <p>Enterprise biometric attendance analytics with real-time dashboards &amp; workforce intelligence.</p>

                        <img src={`${process.env.PUBLIC_URL}/login_illustration.png`} alt="HR Dashboard illustration" className="illo" />

                        <ul className="features">
                            {[['👆', 'Biometric fingerprint integration'], ['📊', 'Advanced analytics & reports'], ['🏢', 'Multi-company support'], ['📤', 'Export PDF & Excel']].map(([icon, text]) => (
                                <li key={text}><span>{icon}</span>{text}</li>
                            ))}
                        </ul>
                    </div>
                </aside>

                {/* ─ Right panel ─ */}
                <main className="right">
                    <div className="card">
                        <div className="card-top">
                            <div className="avatar">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                                </svg>
                            </div>
                            <h2>Welcome Back</h2>
                            <p>Sign in to access your dashboard</p>
                        </div>

                        {alert && (
                            <div className={`alert ${alert.type}`}>
                                {alert.type === 'success' ? '✅' : '⚠️'} {alert.msg}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} noValidate>
                            <Field label="Username" id="username" type="text" placeholder="Enter username"
                                value={form.username} onChange={set('username')} error={errors.username}
                                icon={<UserIcon />}
                                onFocus={() => setErrors(e => ({ ...e, username: '' }))}
                            />
                            <Field label="Password" id="password" type={showPass ? 'text' : 'password'}
                                placeholder="Enter password" value={form.password} onChange={set('password')}
                                error={errors.password} icon={<LockIcon />}
                                onFocus={() => setErrors(e => ({ ...e, password: '' }))}
                                right={
                                    <button type="button" className="eye" onClick={() => setShowPass(p => !p)} aria-label="Toggle">
                                        {showPass ? <EyeOffIcon /> : <EyeIcon />}
                                    </button>
                                }
                            />

                            <label className="remember">
                                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                                <span className="chk" />
                                Remember me
                            </label>

                            <button type="submit" className="submit" disabled={loading}>
                                {loading ? <><Spinner /> Signing in…</> : '🔐  Sign In'}
                            </button>
                        </form>

                        <p className="footer-note">🔒 Secured with end-to-end encryption</p>
                    </div>
                    <p className="copy">&copy; 2025 HRMS Attendance System</p>
                </main>
            </div>
                {/* Password Setup Modal */}
                {showPasswordSetup && (
                    <div className="modal-overlay" onClick={() => setShowPasswordSetup(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <div className="avatar setup-avatar">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <h3>Set Your Password</h3>
                                <p>This is your first login. Please create a password.</p>
                            </div>
                            
                            <form onSubmit={handlePasswordSetup}>
                                <div className="field">
                                    <label>New Password</label>
                                    <div className="inp-wrap">
                                        <input type="password" value={newPassword}
                                            onChange={(e) => {
                                                setNewPassword(e.target.value);
                                                setPasswordStrength(checkPasswordStrength(e.target.value));
                                                setPasswordError('');
                                            }} placeholder="Enter new password" autoFocus
                                        />
                                    </div>
                                    {newPassword && (
                                        <div className={`password-strength ${passwordStrength.toLowerCase()}`}>
                                            Strength: {passwordStrength}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="field">
                                    <label>Confirm Password</label>
                                    <div className="inp-wrap">
                                        <input type="password" value={confirmPassword}
                                            onChange={(e) => {
                                                setConfirmPassword(e.target.value);
                                                setPasswordError('');
                                            }} placeholder="Confirm your password"
                                        />
                                    </div>
                                </div>
                                
                                {passwordError && (
                                    <div className="password-error">
                                        ⚠️ {passwordError}
                                    </div>
                                )}
                                
                                <button type="submit" className="submit" disabled={loading}>{loading ? <><Spinner /> Setting Password…</> : '🔐  Set Password & Continue'}</button>
                                
                                <button type="button" className="logout-link" 
                                    onClick={() => {
                                        setShowPasswordSetup(false);
                                        setForm({ username: '', password: '' });
                                    }}
                                >
                                    ← Back to Login
                                </button>
                            </form>
                        </div>
                    </div>
                )}
        </div>
    );
}

/* ── Sub-components ──────────────────────────────── */
function Field({ label, id, type, placeholder, value, onChange, error, icon, right, onFocus }) {
    return (
        <div className={`field ${error ? 'err' : value ? 'ok' : ''}`}>
            <label htmlFor={id}>{icon}{label}</label>
            <div className="inp-wrap">
                <input id={id} type={type} placeholder={placeholder} value={value}
                    onChange={onChange} onFocus={onFocus} autoComplete={type === 'password' ? 'current-password' : 'username'} />
                {right && <div className="inp-right">{right}</div>}
            </div>
            {error && <span className="field-err">{error}</span>}
        </div>
    );
}

function UserIcon() {
    return <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>;
}
function LockIcon() {
    return <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>;
}
function EyeIcon() {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
}
function EyeOffIcon() {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>;
}
function Spinner() {
    return <svg className="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" opacity="0.2" /><path d="M12 2a10 10 0 010 20" opacity="0.9" /></svg>;
}
