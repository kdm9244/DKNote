import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LedgerMainView from '../../components/ledger/LedgerMainView';

const LEDGER_TABS = new Set(['dashboard', 'accounts', 'transactions', 'transfer-create', 'planning', 'tax']);

export default function LedgerRoute() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab = LEDGER_TABS.has(requestedTab) ? requestedTab : 'dashboard';

  return (
    <div className="w-full min-h-screen bg-[#f8f6f0]">
      <LedgerMainView initialTab={initialTab} onNavigateBack={() => navigate('/')} />
    </div>
  );
}
