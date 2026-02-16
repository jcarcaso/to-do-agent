import { Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import TasksPage from './pages/TasksPage';
import ChatPage from './pages/ChatPage';

function App() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        {user && <Sidebar />}
        <main className="flex-1 p-6">
          {loading ? (
            <p className="text-gray-500 text-center py-20">Loading...</p>
          ) : !user ? (
            <div className="text-center py-20">
              <h1 className="text-3xl font-bold text-gray-800">To-Do Agent</h1>
              <p className="mt-4 text-gray-500">Sign in with Google to get started.</p>
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<TasksPage />} />
              <Route path="/chat" element={<ChatPage />} />
            </Routes>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
