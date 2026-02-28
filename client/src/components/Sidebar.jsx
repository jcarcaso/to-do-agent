import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Tasks' },
  { to: '/chat', label: 'AI Chat' },
  { to: '/settings', label: 'Settings' },
];

function Sidebar() {
  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-[calc(100vh-65px)] p-4 hidden md:block">
      <nav className="space-y-2">
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-lg font-medium transition ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
