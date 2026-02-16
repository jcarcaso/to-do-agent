import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { aiApi } from '../services/api';

const QUICK_ACTIONS = [
  { label: 'What should I work on next?', message: 'What should I work on next?' },
  { label: 'Summarize my tasks', message: 'Give me a summary of all my current tasks.' },
  { label: 'Help me prioritize', message: 'Help me prioritize my tasks for today.' },
];

function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    e?.preventDefault?.();
    const text = typeof e === 'string' ? e : input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const result = await aiApi.chat(text, conversationId);
      setConversationId(result.conversationId);
      setMessages(prev => [...prev, { role: 'assistant', content: result.message }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const triggerCheckIn = async () => {
    setLoading(true);
    setMessages([]);
    setConversationId(null);

    try {
      const result = await aiApi.morningCheckIn();
      if (result.conversationId) {
        setConversationId(result.conversationId);
        setMessages([
          { role: 'user', content: 'Good morning! What does my day look like?' },
          { role: 'assistant', content: result.message },
        ]);
      } else {
        setMessages([{ role: 'assistant', content: result.message }]);
      }
    } catch (err) {
      setMessages([{ role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const triggerPlanDay = async () => {
    setLoading(true);
    setMessages([]);
    setConversationId(null);

    try {
      const result = await aiApi.planDay();
      setConversationId(result.conversationId);
      setMessages([
        { role: 'user', content: 'Please help me plan my day.' },
        { role: 'assistant', content: result.message },
      ]);
    } catch (err) {
      setMessages([{ role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setInput('');
  };

  return (
    <div className="max-w-3xl mx-auto w-full flex flex-col h-[calc(100vh-130px)] md:h-[calc(100vh-130px)]" style={{ maxHeight: 'calc(100vh - 130px - env(safe-area-inset-bottom, 0px))' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">AI Chat</h2>
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            onClick={triggerCheckIn}
            disabled={loading}
            className="px-3 py-1.5 text-xs sm:text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition disabled:opacity-50"
          >
            Morning Check-in
          </button>
          <button
            onClick={triggerPlanDay}
            disabled={loading}
            className="px-3 py-1.5 text-xs sm:text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
          >
            Plan My Day
          </button>
          <button
            onClick={startNewChat}
            className="px-3 py-1.5 text-xs sm:text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            New Chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="text-center py-12 sm:py-20 text-gray-400 dark:text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-lg">Hi {user?.name?.split(' ')[0]}! How can I help you today?</p>
            <p className="text-sm mt-2 mb-6">Ask me about your tasks, or try one of these:</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-md mx-auto">
              {QUICK_ACTIONS.map(({ label, message }) => (
                <button
                  key={label}
                  onClick={() => sendMessage(message)}
                  className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[80%] px-4 py-3 rounded-2xl whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-md'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-2xl rounded-bl-md text-gray-400 dark:text-gray-500">
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={loading}
          className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="px-4 sm:px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default ChatPage;
