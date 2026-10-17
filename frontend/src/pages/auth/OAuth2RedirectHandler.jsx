import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// 구글 로그인 성공 후 발급된 토큰을 처리하는 중계 화면
function OAuth2RedirectHandler() {
  const navigate = useNavigate();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const fragmentParams = new URLSearchParams(window.location.hash.slice(1));
    const queryParams = new URLSearchParams(window.location.search);
    const token = fragmentParams.get('token') || queryParams.get('token');

    if (token) {
      window.history.replaceState({}, document.title, '/oauth2/redirect');
      sessionStorage.setItem('accessToken', token);
      navigate('/', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
      <div className="flex space-x-2 mb-4">
        <div className="w-3 h-3 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-3 h-3 bg-fuchsia-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-3 h-3 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
      </div>
      <p className="text-slate-400 text-sm font-semibold tracking-wide">구글 로그인 정보를 안전하게 연동 중입니다...</p>
    </div>
  );
}

export default OAuth2RedirectHandler;
