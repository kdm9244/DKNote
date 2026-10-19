import { Outlet, useLocation } from 'react-router-dom';
import '../../styles/login-notebook.css';
import loginStudy from '../../assets/login-study.webp';
import LoginNotices from '../../components/notices/LoginNotices';
import {useState} from 'react';

export default function AuthLayout() {
  const { pathname } = useLocation();
  const isSignup = pathname === '/signup';
  const [loginDraft,setLoginDraft]=useState({email:'',password:''});
  if(pathname==='/news')return <main className="public-news-shell"><Outlet context={{loginDraft,setLoginDraft}}/></main>;

  return (
    <main className={`auth-login-page${isSignup ? '' : ' auth-login-page--illustrated'}`}>
      {!isSignup && <div className="auth-login-illustration" aria-hidden="true"><img src={loginStudy} alt="" fetchPriority="high" /></div>}
      <section className="auth-login-stage" aria-label={isSignup ? 'DKNote 회원가입' : 'DKNote 로그인'}>
        <article className={`auth-login-content${isSignup ? ' auth-login-content--signup' : ''}`}>
          <div className="auth-login-card-brand">
            <span aria-hidden="true">D</span>
            <div>
              <strong>DKNote</strong>
              <small>일상과 배움, 여행의 기록</small>
            </div>
          </div>
          <Outlet context={{loginDraft,setLoginDraft}}/>
        </article>
        {!isSignup&&<LoginNotices/>}
      </section>
    </main>
  );
}
