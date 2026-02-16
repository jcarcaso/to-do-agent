import { useAuth } from '../context/AuthContext';

function Header() {
  const { user, loading, login, logout } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <h1 className="text-xl font-semibold text-gray-800">To-Do Agent</h1>
      <nav>
        {loading ? null : user ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {user.picture && (
                <img src={user.picture} alt="" className="w-8 h-8 rounded-full" />
              )}
              <span className="text-sm text-gray-700">{user.name}</span>
            </div>
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-700 transition"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={login}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Sign in with Google
          </button>
        )}
      </nav>
    </header>
  );
}

export default Header;
