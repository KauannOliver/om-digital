import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppScreen } from './types';
import type { Announcement, BranchInfo, OperationInfo, MainOrderRow } from './types';

import Header from './components/Header';
import OMTable from './components/OMTable';
import SidePanel from './components/SidePanel';
import AnnouncementDisplay from './components/AnnouncementDisplay';
import LoginScreen from './components/LoginScreen';
import AnnouncementManager from './components/AnnouncementManager';

import {
  fetchBranchInfo,
  fetchOperationInfo
} from './api';
import { useGlobalData } from './components/GlobalDataContext';

function normalizeRoute(v: string) {
  return (v || '').replace(/\s+/g, '').trim();
}

function isAnnouncementActiveForTarget(a: Announcement, target: string) {
  const now = Date.now();
  const exp = a.expirationDate ? new Date(a.expirationDate).getTime() : Number.POSITIVE_INFINITY;
  const notExpired = exp > now;
  const targets = a.operations || [];
  return notExpired && (targets.includes(target) || targets.includes('*'));
}

const App: React.FC = () => {
  const params = useParams();
  const navigate = useNavigate();

  const {
    allOrders,
    initialLoading,
    refreshing,
    error,
    lastUpdate,
    syncData
  } = useGlobalData();

  const branchRoute = params.branchRoute ? normalizeRoute(params.branchRoute) : '';
  const operationCode = params.operationCode ? normalizeRoute(params.operationCode) : '';

  const mode: 'branch' | 'operation' = operationCode ? 'operation' : 'branch';
  const targetKey = mode === 'operation' ? operationCode : branchRoute;

  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.MAIN);
  const [branchInfo, setBranchInfo] = useState<BranchInfo | null>(null);
  const [operationInfo, setOperationInfo] = useState<OperationInfo | null>(null);

  const [announcements, setAnnouncements] = useState<Announcement[]>([
    {
      id: 'default-ann',
      imageUrl: 'https://framerusercontent.com/images/pM5NZ5D7GPOXU2ZCZGCqWUZxk.jpg?',
      durationSeconds: 10,
      expirationDate: '2030-01-01T00:00',
      operations: ['*']
    }
  ]);

  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const fetchMetadata = useCallback(async () => {
    if (!targetKey) return;
    try {
      if (mode === 'branch') {
        const b = await fetchBranchInfo(branchRoute);
        setBranchInfo(b);
        setOperationInfo(null);
      } else {
        const op = await fetchOperationInfo(operationCode);
        setOperationInfo(op);
        setBranchInfo(null);
      }
    } catch (e) {
      console.warn('Falha ao carregar metadados:', e);
    }
  }, [mode, targetKey, branchRoute, operationCode]);

  // Metadata Sync Effect (on route change)
  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);


  const orders = useMemo(() => {
    if (mode === 'branch') {
      return allOrders.filter((o) => o.branch_route === branchRoute);
    } else {
      return allOrders.filter((o) => o.operation_code === operationCode);
    }
  }, [allOrders, mode, branchRoute, operationCode]);



  const activeAnnouncement = useMemo(() => {
    const candidates = announcements.filter((a) => isAnnouncementActiveForTarget(a, targetKey));
    return candidates.length ? candidates[candidates.length - 1] : undefined;
  }, [announcements, targetKey]);

  useEffect(() => {
    let timer: any;

    if (currentScreen === AppScreen.MAIN) {
      if (activeAnnouncement) {
        const timeoutMs = Number((import.meta as any).env?.VITE_IDLE_TIMEOUT_MS || 600000);
        timer = setTimeout(() => setCurrentScreen(AppScreen.ANNOUNCEMENT), timeoutMs);
      }
    } else if (currentScreen === AppScreen.ANNOUNCEMENT) {
      const ms = (activeAnnouncement?.durationSeconds ?? 10) * 1000;
      timer = setTimeout(() => setCurrentScreen(AppScreen.MAIN), ms);
    }

    return () => clearTimeout(timer);
  }, [currentScreen, activeAnnouncement]);

  const handleLogoClick = () => {
    navigate('/');
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setCurrentScreen(AppScreen.MANAGER);
  };

  const handleAddAnnouncement = (newAnnouncement: Announcement) => {
    setAnnouncements((prev) => [...prev, newAnnouncement]);
    setCurrentScreen(AppScreen.MAIN);
  };

  const handleBackToMain = () => setCurrentScreen(AppScreen.MAIN);

  const headerTitle = useMemo(() => {
    if (currentScreen === AppScreen.ANNOUNCEMENT || currentScreen === AppScreen.MANAGER) {
      return 'OM DIGITAL - COMUNICADO';
    }
    return 'OM DIGITAL - PAINEL DA OFICINA';
  }, [currentScreen]);

  const headerOperation =
    mode === 'branch'
      ? (orders[0]?.branch_name || branchInfo?.branch_name || branchRoute || 'CARREGANDO...')
      : (operationInfo?.operation || orders[0]?.operation || operationCode || 'CARREGANDO...');

  const renderMain = () => {
    if (initialLoading && orders.length === 0) {
      return (
        <div className="flex h-[calc(100vh-80px)] w-full p-4">
          <div className="w-full bg-white rounded-xl shadow-2xl border border-gray-100 flex items-center justify-center">
            <div className="text-[#212A57] font-black text-xl">Carregando dados do banco…</div>
          </div>
        </div>
      );
    }

    if (error && orders.length === 0) {
      return (
        <div className="flex h-[calc(100vh-80px)] w-full p-4">
          <div className="w-full bg-white rounded-xl shadow-2xl border border-gray-100 p-8">
            <div className="text-red-700 font-black text-2xl">Erro</div>
            <div className="mt-2 text-gray-700 font-bold">{error}</div>
            <button
              onClick={() => syncData()}
              className="mt-6 bg-[#079AE1] text-white font-black px-6 py-3 rounded-xl hover:opacity-90"
            >
              TENTAR NOVAMENTE
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-[calc(100vh-80px)] w-full gap-4 p-4 animate-in fade-in duration-500">
        <div className="w-3/4 h-full bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-100 relative">
          {refreshing && (
            <div className="absolute top-3 right-3 z-30 bg-black/70 text-white text-[10px] font-black px-3 py-1 rounded-full">
              ATUALIZANDO…
            </div>
          )}
          <OMTable rows={orders} />
        </div>

        <div className="w-1/4 h-full">
          <SidePanel rows={orders} scope={{ mode, code: targetKey }} lastUpdate={lastUpdate} />
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (currentScreen) {
      case AppScreen.MAIN:
        return renderMain();
      case AppScreen.ANNOUNCEMENT:
        return <AnnouncementDisplay announcement={activeAnnouncement} />;
      case AppScreen.LOGIN:
        return <LoginScreen onLoginSuccess={handleLoginSuccess} onCancel={handleBackToMain} />;
      case AppScreen.MANAGER:
        return <AnnouncementManager onAdd={handleAddAnnouncement} onCancel={handleBackToMain} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#212A57] overflow-hidden">
      <Header
        title={headerTitle}
        operation={headerOperation}
        lastUpdate={lastUpdate}
        onLogoClick={handleLogoClick}
      />
      <main className="flex-grow overflow-hidden relative">{renderContent()}</main>
    </div>
  );
};

export default App;
