import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const redirectTimer = useRef(null);
  const navigate = useNavigate();

  useEffect(() => () => window.clearTimeout(redirectTimer.current), []);

  const handleSignUp = async (event) => {
    event.preventDefault();
    if (loading || success) return;
    setError('');
    setLoading(true);

    try {
      await api.post('/api/auth/signup', {
        email: email.trim(),
        password,
        nickname: nickname.trim(),
      });
      setSuccess(true);
      redirectTimer.current = window.setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch (signupError) {
      setError(!signupError.response
        ? '서버에 연결할 수 없습니다. 실행 상태와 네트워크를 확인해 주세요.'
        : signupError.response?.data?.message || '회원가입 중 문제가 발생했습니다. 입력 정보를 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-view" key="signup">
      <header className="auth-login-heading">
        <h1>회원가입</h1>
        <p>DKNote에서 함께 기록할 계정을 만들어 주세요.</p>
      </header>

      {success && (
        <div className="auth-login-success" role="status">
          <span aria-hidden="true">✓</span>
          <p><strong>가입이 완료되었습니다.</strong> 잠시 후 로그인으로 이동합니다.</p>
        </div>
      )}
      {error && <div className="auth-login-error" role="alert"><span aria-hidden="true">!</span><p>{error}</p></div>}

      <form className="auth-login-form" onSubmit={handleSignUp}>
        <label htmlFor="signup-nickname">
          <span>닉네임</span>
          <input id="signup-nickname" type="text" autoComplete="nickname" maxLength="50" placeholder="사용할 이름을 입력해 주세요" value={nickname} onChange={(event) => setNickname(event.target.value)} disabled={loading || success} required />
        </label>

        <label htmlFor="signup-email">
          <span>이메일</span>
          <input id="signup-email" type="email" inputMode="email" autoComplete="email" maxLength="100" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading || success} required />
        </label>

        <label htmlFor="signup-password">
          <span>비밀번호 <small>4자 이상</small></span>
          <div className="auth-login-password-field">
            <input id="signup-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength="4" maxLength="100" placeholder="비밀번호를 입력해 주세요" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading || success} required />
            <button type="button" onClick={() => setShowPassword((value) => !value)} disabled={loading || success} aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}>{showPassword ? '숨김' : '보기'}</button>
          </div>
        </label>

        <button className="auth-login-primary" type="submit" disabled={loading || success}><span>{success ? '가입 완료' : loading ? '가입 중…' : '회원가입'}</span><span aria-hidden="true">→</span></button>
      </form>

      <p className="auth-login-signup">이미 계정이 있으신가요? <Link to="/login">로그인</Link></p>
      <p className="auth-login-security"><span aria-hidden="true">●</span> 입력한 정보는 계정 생성과 로그인에만 사용됩니다.</p>
    </div>
  );
}
