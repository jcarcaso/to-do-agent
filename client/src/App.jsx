import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineIndicator from './components/OfflineIndicator';
import LoadingSkeleton from './components/LoadingSkeleton';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

const TasksPage = lazy(() => import('./pages/TasksPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function App() {
  const { user, loading } = useAuth();
  useKeyboardShortcuts();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <OfflineIndicator />
      <div className="flex">
        {user && <Sidebar />}
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          <ErrorBoundary>
            {loading ? (
              <LoadingSkeleton type="page" />
            ) : !user ? (
              <div className="text-center py-20">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">To-Do Agent</h1>
                <p className="mt-4 text-gray-500 dark:text-gray-400">Sign in with Google to get started.</p>
              </div>
            ) : (
              <Suspense fallback={<LoadingSkeleton type="page" />}>
                <Routes>
                  <Route path="/" element={<TasksPage />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </Suspense>
            )}
          </ErrorBoundary>
        </main>
      </div>
      {user && <BottomNav />}
    </div>
  );
}

export default App;
