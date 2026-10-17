import React from 'react';
import { useNavigate } from 'react-router-dom';
import LedgerMainView from '../../components/ledger/LedgerMainView';

export default function InvestmentAccountDetailRoute() {
  const navigate = useNavigate();

  return (
    <LedgerMainView
      initialTab="investment-detail"
      onNavigateBack={() => navigate('/')}
    />
  );
}
