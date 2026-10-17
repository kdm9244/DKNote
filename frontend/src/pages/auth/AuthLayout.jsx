import { Outlet, useLocation } from 'react-router-dom';
import '../../styles/login-notebook.css';

export default function AuthLayout() {
  const { pathname } = useLocation();
  const isSignup = pathname === '/signup';

  return (
    <main className="auth-login-page">
      <section className="auth-login-stage" aria-label={isSignup ? 'DKNote 회원가입' : 'DKNote 로그인'}>
        <article className={`auth-login-content${isSignup ? ' auth-login-content--signup' : ''}`}>
          <div className="auth-login-card-brand">
            <span aria-hidden="true">D</span>
            <div>
              <strong>DKNote</strong>
              <small>일상과 배움, 여행의 기록</small>
            </div>
          </div>
          <Outlet />
        </article>
      </section>
    </main>
  );
}
