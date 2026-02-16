import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => {
      // Don't trigger shortcuts when typing in inputs
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) {
        if (e.key === 'Escape') {
          e.target.blur();
        }
        return;
      }

      // Don't trigger with modifier keys
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case 'n':
          navigate('/');
          // Dispatch custom event for TasksPage to pick up
          window.dispatchEvent(new CustomEvent('shortcut:new-task'));
          break;
        case '/':
          e.preventDefault();
          navigate('/chat');
          break;
        case 'Escape':
          window.dispatchEvent(new CustomEvent('shortcut:escape'));
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
}
