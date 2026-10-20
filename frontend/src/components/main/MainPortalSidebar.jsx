import FeatureSidebar from '../workspace/FeatureSidebar';
const menus = [
  ['home', '⌂', '홈', '/'], ['calendar', '▦', '캘린더', '/calendar'],
  ['learning', '◇', '학습', '/learning'], ['ledger', '▤', '가계부', '/ledger'],
  ['travel', '✈', '여행', '/planner'], ['notes', '✎', '메모', '/notes'],
];
export default function MainPortalSidebar({ active, user }) {
  return <FeatureSidebar scope={active} userOverride={user} menuItems={menus.map(([key, icon, label, path]) => ({ key, icon, label, path, active: active === key, end: true }))} />;
}
