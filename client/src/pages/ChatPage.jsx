import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { aiApi } from '../services/api';
import { useConversations, useUpdateConversation } from '../hooks/useConversations';

const QUICK_ACTIONS = [
  { label: 'What should I work on next?', message: 'What should I work on next?' },
  { label: 'Summarize my tasks', message: 'Give me a summary of all my current tasks.' },
  { label: 'Help me prioritize', message: 'Help me prioritize my tasks for today.' },
];

const ACTION_STYLES = {
  create_task: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', icon: '+', label: 'Created' },
  complete_task: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', icon: '✓', label: 'Completed' },
  update_task: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', icon: '✎', label: 'Updated' },
  start_task: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', icon: '▶', label: 'Started' },
  delete_task: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', icon: '✕', label: 'Archived' },
};

// Module-level cache to survive component unmount/remount
const chatCache = { messages: [], conversationId: null };

function ActionCard({ action }) {
  const style = ACTION_STYLES[action.type] || ACTION_STYLES.update_task;

  if (!action.success) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-sm">
        <span className="text-red-500 font-bold">!</span>
        <span className="text-red-700 dark:text-red-300">
          Failed to {action.type.replace('_', ' ')}: {action.error}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${style.bg} ${style.border} text-sm`}>
      <span className="font-bold text-base leading-none">{style.icon}</span>
      <span className="text-gray-700 dark:text-gray-300">
        {style.label}: <strong>{action.task?.title || 'Task'}</strong>
      </span>
    </div>
  );
}

const TYPE_LABELS = {
  chat: 'Chat',
  'morning-checkin': 'Check-in',
  'plan-day': 'Plan Day',
};

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function ChatPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState(chatCache.messages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(chatCache.conversationId);
  const [showHistory, setShowHistory] = useState(false);
  const [editingConvoId, setEditingConvoId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const { data: conversations, isLoading: historyLoading } = useConversations();
  const updateConversation = useUpdateConversation();

  // Sync state back to module-level cache
  useEffect(() => {
    chatCache.messages = messages;
    chatCache.conversationId = conversationId;
  }, [messages, conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const invalidateConversations = () => {
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  };

  const handleResult = (result, userContent) => {
    setConversationId(result.conversationId);
    const assistantMsg = { role: 'assistant', content: result.message };
    if (result.actions?.length) {
      assistantMsg.actions = result.actions;
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }

    if (userContent) {
      setMessages(prev => [
        ...prev.filter(m => m !== prev[prev.length - 1] || m.role !== 'user'),
        { role: 'user', content: userContent },
        assistantMsg,
      ]);
    } else {
      setMessages(prev => [...prev, assistantMsg]);
    }
  };

  const sendMessage = async (e) => {
    e?.preventDefault?.();
    const text = typeof e === 'string' ? e : input.trim();
    if (!text || loading) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const result = await aiApi.chat(text, conversationId);
      setConversationId(result.conversationId);
      const assistantMsg = { role: 'assistant', content: result.message };
      if (result.actions?.length) {
        assistantMsg.actions = result.actions;
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }
      setMessages(prev => [...prev, assistantMsg]);
      invalidateConversations();
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
        const assistantMsg = { role: 'assistant', content: result.message };
        if (result.actions?.length) {
          assistantMsg.actions = result.actions;
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }
        setMessages([
          { role: 'user', content: 'Good morning! What does my day look like?' },
          assistantMsg,
        ]);
      } else {
        setMessages([{ role: 'assistant', content: result.message }]);
      }
      invalidateConversations();
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
      const assistantMsg = { role: 'assistant', content: result.message };
      if (result.actions?.length) {
        assistantMsg.actions = result.actions;
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }
      setMessages([
        { role: 'user', content: 'Please help me plan my day.' },
        assistantMsg,
      ]);
      invalidateConversations();
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
    setShowHistory(false);
    invalidateConversations();
  };

  const loadConversation = async (id) => {
    setLoading(true);
    setShowHistory(false);
    try {
      const convo = await aiApi.getConversation(id);
      setConversationId(convo._id || id);
      const loadedMessages = (convo.messages || [])
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content, actions: m.actions }));
      setMessages(loadedMessages);
    } catch (err) {
      setMessages([{ role: 'assistant', content: `Error loading conversation: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const conversationList = conversations || [];

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
            onClick={() => setShowHistory(prev => !prev)}
            className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg transition ${
              showHistory
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            History
          </button>
          <button
            onClick={startNewChat}
            className="px-3 py-1.5 text-xs sm:text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            New Chat
          </button>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className="flex-1 overflow-y-auto pb-4">
          <div className="space-y-2">
            {historyLoading && (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                Loading conversations...
              </div>
            )}
            {!historyLoading && conversationList.length === 0 && (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                No past conversations yet.
              </div>
            )}
            {conversationList.map((convo) => {
              const preview = convo.preview || 'No messages';
              const msgCount = convo.messageCount || 0;
              const typeLabel = TYPE_LABELS[convo.type] || convo.type || 'Chat';
              const isActive = convo._id === conversationId;
              const isEditing = editingConvoId === convo._id;
              const displayTitle = convo.title || preview;

              const saveTitle = () => {
                const trimmed = editTitle.trim();
                if (trimmed && trimmed !== convo.title) {
                  updateConversation.mutate({ id: convo._id, data: { title: trimmed } });
                }
                setEditingConvoId(null);
              };

              return (
                <div
                  key={convo._id}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer ${
                    isActive
                      ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                  onClick={() => !isEditing && loadConversation(convo._id)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {typeLabel}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatDate(convo.updatedAt || convo.createdAt)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingConvoId(convo._id);
                          setEditTitle(convo.title || '');
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                        title="Rename conversation"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveTitle();
                        if (e.key === 'Escape') setEditingConvoId(null);
                      }}
                      onBlur={saveTitle}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="w-full text-sm px-2 py-1 border border-blue-400 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Conversation title..."
                    />
                  ) : (
                    <p className="text-sm text-gray-800 dark:text-gray-100 truncate font-medium">
                      {displayTitle}
                    </p>
                  )}
                  {!isEditing && convo.title && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">
                      {preview}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {msgCount} message{msgCount !== 1 ? 's' : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Messages */}
      {!showHistory && (
        <>
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
              <div key={i}>
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
                {msg.actions?.length > 0 && (
                  <div className="flex justify-start mt-2">
                    <div className="max-w-[85%] sm:max-w-[80%] space-y-1.5">
                      {msg.actions.map((action, j) => (
                        <ActionCard key={j} action={action} />
                      ))}
                    </div>
                  </div>
                )}
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
          <form onSubmit={(e) => e.preventDefault()} className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                const el = e.target;
                el.style.height = 'auto';
                const maxHeight = 6 * 24; // ~6 rows
                el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
                el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type a message..."
              disabled={loading}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none overflow-hidden"
            />
            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="px-4 sm:px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50 self-end"
            >
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default ChatPage;
