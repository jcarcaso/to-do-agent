function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-65px)] p-4 hidden md:block">
      <nav className="space-y-2">
        <a href="/" className="block px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-medium">
          Tasks
        </a>
        <a href="/calendar" className="block px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-50">
          Calendar
        </a>
        <a href="/chat" className="block px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-50">
          AI Chat
        </a>
        <a href="/settings" className="block px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-50">
          Settings
        </a>
      </nav>
    </aside>
  );
}

export default Sidebar;
