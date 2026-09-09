import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { api, User, Monitor, NotificationChannel } from './lib/api.js';

import { Navbar } from './components/Navbar.js';
import { Sidebar } from './components/Sidebar.js';
import { CreateMonitorModal } from './components/CreateMonitorModal.js';
import { CreateHeartbeatModal } from './components/CreateHeartbeatModal.js';
import { CreateIncidentModal } from './components/CreateIncidentModal.js';
import { NotificationModal } from './components/NotificationModal.js';

import { Dashboard } from './pages/Dashboard.js';
import { MonitorsPage } from './pages/MonitorsPage.js';
import { HeartbeatsPage } from './pages/HeartbeatsPage.js';
import { IncidentsPage } from './pages/IncidentsPage.js';
import { StatusPageAdmin } from './pages/StatusPageAdmin.js';
import { PublicStatusPage } from './pages/PublicStatusPage.js';
import { NotificationsPage } from './pages/NotificationsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { LoginPage } from './pages/LoginPage.js';

function ProtectedLayout({ user, onOpenCreateMonitor }: { user: User; onOpenCreateMonitor: () => void }) {
  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      <Navbar user={user} onOpenNewMonitor={onOpenCreateMonitor} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar onOpenCreateModal={onOpenCreateMonitor} />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard onOpenCreateMonitor={onOpenCreateMonitor} />} />
              <Route
                path="/monitors"
                element={
                  <MonitorsPage
                    onOpenCreateModal={onOpenCreateMonitor}
                    onEditMonitor={() => {}}
                  />
                }
              />
              <Route path="/heartbeats" element={<HeartbeatsPage onOpenCreateModal={() => {}} />} />
              <Route path="/incidents" element={<IncidentsPage onOpenCreateModal={() => {}} monitors={[]} />} />
              <Route path="/status-page" element={<StatusPageAdmin />} />
              <Route
                path="/notifications"
                element={<NotificationsPage onOpenCreateModal={() => {}} onEditChannel={() => {}} />}
              />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Global Modals
  const [isMonitorModalOpen, setIsMonitorModalOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null);

  const [isHeartbeatModalOpen, setIsHeartbeatModalOpen] = useState(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);
  const [monitorsList, setMonitorsList] = useState<Monitor[]>([]);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const res = await api.auth.me();
      setUser(res.user);
      const mList = await api.monitors.list().catch(() => []);
      setMonitorsList(mList);
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateMonitor = (monitor?: Monitor) => {
    setEditingMonitor(monitor || null);
    setIsMonitorModalOpen(true);
  };

  const handleOpenNotificationModal = (channel?: NotificationChannel) => {
    setEditingChannel(channel || null);
    setIsNotificationModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-500 font-mono text-xs">
        Yükleniyor...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Status Page (Accessible to everyone) */}
        <Route path="/status" element={<PublicStatusPage />} />
        <Route path="/status/:slug" element={<PublicStatusPage />} />

        {/* Login / Setup Page */}
        <Route
          path="/login"
          element={
            user ? <Navigate to="/" replace /> : <LoginPage onLoginSuccess={(u) => { setUser(u); }} />
          }
        />

        {/* Admin Dashboard & Management Routes */}
        <Route
          path="/*"
          element={
            user ? (
              <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
                <Navbar user={user} onOpenNewMonitor={() => handleOpenCreateMonitor()} />
                <div className="flex-1 flex overflow-hidden">
                  <Sidebar onOpenCreateModal={() => handleOpenCreateMonitor()} />
                  <main className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
                    <div className="max-w-7xl mx-auto">
                      <Routes>
                        <Route
                          path="/"
                          element={<Dashboard onOpenCreateMonitor={() => handleOpenCreateMonitor()} />}
                        />
                        <Route
                          path="/monitors"
                          element={
                            <MonitorsPage
                              onOpenCreateModal={() => handleOpenCreateMonitor()}
                              onEditMonitor={(m) => handleOpenCreateMonitor(m)}
                            />
                          }
                        />
                        <Route
                          path="/heartbeats"
                          element={<HeartbeatsPage onOpenCreateModal={() => setIsHeartbeatModalOpen(true)} />}
                        />
                        <Route
                          path="/incidents"
                          element={
                            <IncidentsPage
                              onOpenCreateModal={() => setIsIncidentModalOpen(true)}
                              monitors={monitorsList}
                            />
                          }
                        />
                        <Route path="/status-page" element={<StatusPageAdmin />} />
                        <Route
                          path="/notifications"
                          element={
                            <NotificationsPage
                              onOpenCreateModal={() => handleOpenNotificationModal()}
                              onEditChannel={(ch) => handleOpenNotificationModal(ch)}
                            />
                          }
                        />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </div>
                  </main>
                </div>
              </div>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>

      {/* Global Modals */}
      <CreateMonitorModal
        isOpen={isMonitorModalOpen}
        onClose={() => setIsMonitorModalOpen(false)}
        onSuccess={() => checkUser()}
        editMonitor={editingMonitor}
      />

      <CreateHeartbeatModal
        isOpen={isHeartbeatModalOpen}
        onClose={() => setIsHeartbeatModalOpen(false)}
        onSuccess={() => checkUser()}
      />

      <CreateIncidentModal
        isOpen={isIncidentModalOpen}
        onClose={() => setIsIncidentModalOpen(false)}
        onSuccess={() => checkUser()}
        monitors={monitorsList}
      />

      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        onSuccess={() => checkUser()}
        editChannel={editingChannel}
      />
    </BrowserRouter>
  );
}
export default App;
