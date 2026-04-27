import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import App from './App';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import { GlobalDataProvider } from './components/GlobalDataContext';

const BASENAME = ((import.meta as any).env?.BASE_URL || '/').replace(/\/+$/, '');

const rootElement = document.getElementById('root');

ReactDOM.createRoot(rootElement!).render(
  <React.StrictMode>
    <BrowserRouter basename={BASENAME}>
      <GlobalDataProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/branch/:branchRoute/*" element={<App />} />
          <Route path="/operation/:operationCode/*" element={<App />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </GlobalDataProvider>
    </BrowserRouter>
  </React.StrictMode>
);