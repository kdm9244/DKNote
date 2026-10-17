import { useEffect, useState } from 'react';
import api from '../../api/client';
import MainPortalSidebar from '../../components/main/MainPortalSidebar';
import { Link } from 'react-router-dom';
import '../../styles/main-portal.css';

function errorMessage(error, fallback) {
  const data = error.response?.data;
  if (typeof data === 'string' && data) return data;
  return data?.message || fallback;
}

export default function MyPage() {
  const [user, setUser] = useState(null);
  const [nickname, setNickname] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    api.get('/api/users/myProfile').then((response) => {
      setUser(response.data);
      setNickname(response.data.nickname || '');
    });
  }, []);

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileMessage('');
    try {
      setSavingProfile(true);
      const response = await api.patch('/api/users/myProfile', { nickname: nickname.trim() });
      setUser(response.data);
      setNickname(response.data.nickname || '');
      setProfileMessage('닉네임을 저장했습니다.');
    } catch (error) {
      setProfileMessage(errorMessage(error, '닉네임을 저장하지 못했습니다.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setPasswordMessage('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage('새 비밀번호가 서로 일치하지 않습니다.');
      return;
    }
    try {
      setSavingPassword(true);
      await api.patch('/api/users/myPassword', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordMessage('비밀번호를 변경했습니다.');
    } catch (error) {
      setPasswordMessage(errorMessage(error, '비밀번호를 변경하지 못했습니다.'));
    } finally {
      setSavingPassword(false);
    }
  };

  const joinedAt = user?.createdAt
    ? new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(user.createdAt))
    : '-';

  return (
    <div className="main-portal-layout workspace-layout feature-layout feature-mypage">
      <MainPortalSidebar active="mypage" user={user} />
      <main className="main-portal-content mypage-content">
        <header className="main-portal-heading">
          <span>내 정보</span>
          <h1>마이페이지</h1>
          <p>계정 정보와 로그인 보안을 관리합니다.</p>
        </header>

        <section className="mypage-profile-summary">
          <span>{(user?.nickname || '사').substring(0, 1)}</span>
          <div><h2>{user?.nickname || '사용자'}님</h2><p>{user?.email || '사용자 정보를 불러오는 중입니다.'}</p></div>
          <dl><div><dt>가입 방식</dt><dd>{user?.provider === 'GOOGLE' ? 'Google 로그인' : '이메일 로그인'}</dd></div><div><dt>가입일</dt><dd>{joinedAt}</dd></div></dl>
        </section>

        <div className="mypage-form-grid">
          <form className="mypage-card" onSubmit={saveProfile}>
            <header><span>01</span><div><h2>기본 정보</h2><p>서비스에서 사용할 이름을 관리합니다.</p></div></header>
            <label><span>이메일</span><input type="email" value={user?.email || ''} disabled /></label>
            <label><span>닉네임</span><input type="text" value={nickname} maxLength="50" onChange={(event) => setNickname(event.target.value)} required /></label>
            {profileMessage && <p className="mypage-form-message">{profileMessage}</p>}
            <button type="submit" disabled={savingProfile || !nickname.trim()}>{savingProfile ? '저장 중…' : '기본 정보 저장'}</button>
          </form>

          <form className="mypage-card" onSubmit={savePassword}>
            <header><span>02</span><div><h2>비밀번호 변경</h2><p>주기적인 변경으로 계정을 안전하게 보호하세요.</p></div></header>
            {user?.provider === 'GOOGLE' ? (
              <div className="mypage-google-notice"><strong>Google 계정으로 로그인 중입니다.</strong><p>비밀번호는 Google 계정에서 관리할 수 있습니다.</p></div>
            ) : (
              <>
                <label><span>현재 비밀번호</span><input type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} required /></label>
                <label><span>새 비밀번호</span><input type="password" minLength="4" value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} required /></label>
                <label><span>새 비밀번호 확인</span><input type="password" minLength="4" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} required /></label>
                {passwordMessage && <p className="mypage-form-message">{passwordMessage}</p>}
                <button type="submit" disabled={savingPassword}>{savingPassword ? '변경 중…' : '비밀번호 변경'}</button>
              </>
            )}
          </form>

          <section className="mypage-card"><h2>미카 AI와 화면 설정</h2><p>홈 카드, 캘린더, AI 성격과 기억은 설정 페이지에서 관리합니다.</p><Link to="/settings">설정 페이지 열기 →</Link></section>
        </div>
      </main>
    </div>
  );
}
