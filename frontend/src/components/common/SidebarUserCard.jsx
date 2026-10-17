import { useNavigate } from 'react-router-dom';
import '../../styles/sidebar-user-card.css';

export default function SidebarUserCard({ user, collapsed = false, active = false }) {
  const navigate = useNavigate();
  const nickname = user?.nickname?.trim() || '사용자';
  const email = user?.email?.trim() || '계정 정보를 불러오는 중입니다.';

  const logout = () => {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('token');
    window.location.replace('/login');
  };

  return (
    <div className={`dk-sidebar-user${collapsed ? ' is-collapsed' : ''}${active ? ' is-active' : ''}`}>
      <button
        type="button"
        className="dk-sidebar-user__profile"
        onClick={() => navigate('/mypage')}
        title="마이페이지"
        aria-label={`${nickname}님의 마이페이지`}
      >
        <span className="dk-sidebar-user__avatar" aria-hidden="true">{nickname.substring(0, 1)}</span>
        {!collapsed && (
          <span className="dk-sidebar-user__identity">
            <strong>{nickname}님</strong>
            <small>{email}</small>
          </span>
        )}
      </button>
      {!collapsed && <button type="button" className="dk-sidebar-user__logout" onClick={logout}>로그아웃</button>}
    </div>
  );
}
