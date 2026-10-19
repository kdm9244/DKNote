import { useEffect, useState } from 'react';
import { Link, useNavigate,useOutletContext } from 'react-router-dom';
import api, { startGoogleLogin } from '../../api/client';

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="auth-login-google-icon" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function LoginPage() {
  const [signupEnabled,setSignupEnabled]=useState(false);
  useEffect(()=>{api.get('/api/auth/policy').then(r=>setSignupEnabled(r.data.signupEnabled)).catch(()=>{});},[]);
  const {loginDraft,setLoginDraft}=useOutletContext();
  const {email,password}=loginDraft;
  const setEmail=email=>setLoginDraft(d=>({...d,email}));
  const setPassword=password=>setLoginDraft(d=>({...d,password}));
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleLogin = startGoogleLogin;

  const handleLogin = async (event) => {
    event.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/api/auth/login', { email: email.trim(), password });
      sessionStorage.setItem('accessToken', response.data.accessToken);
      const claims=JSON.parse(atob(response.data.accessToken.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      navigate(claims.role==='NOTICE_PUBLISHER'?'/updates':'/', { replace: true });
    } catch (loginError) {
      setError(!loginError.response
        ? '서버에 연결할 수 없습니다. 실행 상태와 네트워크를 확인해 주세요.'
        : loginError.response?.data?.message || '이메일 또는 비밀번호를 다시 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-view" key="login">
      <header className="auth-login-heading">
        <h1>로그인</h1>
        <p>등록한 계정으로 DKNote를 시작하세요.</p>
      </header>

      {error && <div className="auth-login-error" role="alert"><span aria-hidden="true">!</span><p>{error}</p></div>}

      <form className="auth-login-form" onSubmit={handleLogin}>
        <label htmlFor="login-email">
          <span>아이디 또는 이메일</span>
          <input id="login-email" type="text" autoComplete="username" placeholder="아이디 또는 name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} required />
        </label>

        <label htmlFor="login-password">
          <span>비밀번호</span>
          <div className="auth-login-password-field">
            <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="비밀번호를 입력해 주세요" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} required />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}>{showPassword ? '숨김' : '보기'}</button>
          </div>
        </label>

        <button className="auth-login-primary" type="submit" disabled={loading}><span>{loading ? '로그인 중…' : '로그인'}</span><span aria-hidden="true">→</span></button>
      </form>

      <div className="auth-login-divider"><span>또는</span></div>
      <button className="auth-login-google" type="button" disabled={loading} onClick={handleGoogleLogin}><GoogleIcon />Google로 계속하기</button>
      {signupEnabled && <p className="auth-login-signup">아직 계정이 없으신가요? <Link to="/signup">회원가입</Link></p>}
      <p className="auth-login-security"><span aria-hidden="true">●</span> 개인 기기에서만 로그인 상태를 유지해 주세요.</p>
    </div>
  );
}

