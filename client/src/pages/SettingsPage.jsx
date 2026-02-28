import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { userApi } from '../services/api';
import { useToast } from '../components/Toast';

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Pacific/Auckland',
];

function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { addToast } = useToast();
  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    userApi.getPreferences().then(setPrefs).catch(() => {});
  }, []);

  const save = async (updates) => {
    setSaving(true);
    try {
      const result = await userApi.updatePreferences(updates);
      setPrefs(result);
      addToast('Settings saved', 'success');
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    save({ theme: newTheme });
  };

  if (!prefs) {
    return (
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Settings</h2>
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  const inputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Settings</h2>

      {/* Profile */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Profile</h3>
        <div className="flex items-center gap-4">
          {user.picture && <img src={user.picture} alt="" className="w-16 h-16 rounded-full" />}
          <div>
            <p className="font-medium text-gray-800 dark:text-gray-100">{user.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Morning Check-in */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Morning Check-in</h3>
        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Check-in time</label>
        <input
          type="time"
          value={prefs.morningCheckInTime || '08:00'}
          onChange={(e) => save({ morningCheckInTime: e.target.value })}
          className={inputClass + ' max-w-xs'}
        />
      </div>

      {/* Timezone */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Timezone</h3>
        <select
          value={prefs.timezone || 'America/New_York'}
          onChange={(e) => save({ timezone: e.target.value })}
          className={inputClass + ' max-w-xs'}
        >
          {TIMEZONES.map(tz => (
            <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Notifications */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Notifications</h3>
        <div className="space-y-3">
          {[
            { key: 'inApp', label: 'In-app notifications' },
            { key: 'email', label: 'Email notifications' },
            { key: 'sms', label: 'SMS notifications' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.notificationChannels?.[key] ?? false}
                onChange={(e) => save({
                  notificationChannels: { [key]: e.target.checked },
                })}
                className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700 dark:text-gray-300">{label}</span>
            </label>
          ))}
        </div>

        {prefs.notificationChannels?.sms && (
          <div className="mt-4">
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Phone number</label>
            <input
              type="tel"
              value={prefs.phoneNumber || ''}
              onChange={(e) => setPrefs({ ...prefs, phoneNumber: e.target.value })}
              onBlur={(e) => save({ phoneNumber: e.target.value })}
              placeholder="+1 (555) 123-4567"
              className={inputClass + ' max-w-xs'}
            />
          </div>
        )}
      </div>

      {/* Task Cleanup */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Task Cleanup</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Archive completed tasks after</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={365}
                value={prefs.archiveAfterDays ?? 2}
                onChange={(e) => save({ archiveAfterDays: parseInt(e.target.value, 10) })}
                className={inputClass + ' max-w-[100px]'}
              />
              <span className="text-gray-700 dark:text-gray-300">days</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Permanently delete archived tasks after</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={7}
                max={365}
                value={prefs.purgeAfterDays ?? 90}
                onChange={(e) => save({ purgeAfterDays: parseInt(e.target.value, 10) })}
                className={inputClass + ' max-w-[100px]'}
              />
              <span className="text-gray-700 dark:text-gray-300">days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Theme */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Theme</h3>
        <div className="flex gap-3">
          {['light', 'dark', 'system'].map((t) => (
            <button
              key={t}
              onClick={() => handleThemeChange(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                theme === t
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {saving && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Saving...</p>
      )}
    </div>
  );
}

export default SettingsPage;
