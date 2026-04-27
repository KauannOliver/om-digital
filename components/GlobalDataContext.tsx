import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllOrders, fetchBranches, fetchOperations } from '../api';
import type { MainOrderRow, BranchInfo, OperationInfo } from '../types';

interface GlobalDataContextType {
  allOrders: MainOrderRow[];
  branches: BranchInfo[];
  operations: OperationInfo[];
  initialLoading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdate: Date;
  syncData: (force?: boolean) => Promise<void>;
}

const GlobalDataContext = createContext<GlobalDataContextType | undefined>(undefined);

export const GlobalDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allOrders, setAllOrders] = useState<MainOrderRow[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [operations, setOperations] = useState<OperationInfo[]>([]);
  
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const firstLoadRef = useRef(true);

  const syncData = useCallback(async (isFirstSync: boolean = false) => {
    if (isFirstSync) setInitialLoading(true);
    else setRefreshing(true);

    try {
      // Fetch everything in parallel on first load, or just orders on refresh
      const promises: [Promise<MainOrderRow[]>, Promise<BranchInfo[]>?, Promise<OperationInfo[]>?] = [
        fetchAllOrders()
      ];

      if (isFirstSync || branches.length === 0) {
        promises.push(fetchBranches({ cache: 'no-store' }));
        promises.push(fetchOperations({ cache: 'no-store' }));
      }

      const [ordersData, branchesData, operationsData] = await Promise.all(promises);

      setAllOrders(ordersData);
      if (branchesData) setBranches(branchesData);
      if (operationsData) setOperations(operationsData);
      
      setError(null);
      const now = new Date();
      setLastUpdate(now);
      console.log(`${now.toLocaleTimeString('pt-BR', { hour12: false })} atualizado`);
    } catch (e: any) {
      const msg = e?.message || 'Erro ao sincronizar dados';
      if (isFirstSync && allOrders.length === 0) {
        setError(msg);
      } else {
        console.warn('Sincronização falhou:', msg);
      }
    } finally {
      if (isFirstSync) setInitialLoading(false);
      setRefreshing(false);
    }
  }, [allOrders.length, branches.length]);

  // Initial Sync
  useEffect(() => {
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      syncData(true);
    }
    
    const syncMs = Number((import.meta as any).env?.VITE_GLOBAL_SYNC_MS || 120000);
    const interval = setInterval(() => syncData(false), syncMs);
    return () => clearInterval(interval);
  }, [syncData]);

  // Console Countdown Effect
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const elapsed = now.getTime() - lastUpdate.getTime();
      const syncMs = Number((import.meta as any).env?.VITE_GLOBAL_SYNC_MS || 120000);
      const remainingMs = syncMs - elapsed;
      const hhmmss = now.toLocaleTimeString('pt-BR', { hour12: false });

      if (remainingMs > 500) {
        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        let text = '';
        if (mins > 0) text = `${mins}min${secs}seg`;
        else text = `${secs}seg`;
        console.log(`${hhmmss} falta ${text}`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lastUpdate]);

  return (
    <GlobalDataContext.Provider
      value={{
        allOrders,
        branches,
        operations,
        initialLoading,
        refreshing,
        error,
        lastUpdate,
        syncData: () => syncData(false)
      }}
    >
      {children}
    </GlobalDataContext.Provider>
  );
};

export const useGlobalData = () => {
  const context = useContext(GlobalDataContext);
  if (context === undefined) {
    throw new Error('useGlobalData must be used within a GlobalDataProvider');
  }
  return context;
};
