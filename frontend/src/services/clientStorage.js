// Preserve drafts, notes and preferences. Remove only obsolete persistent credentials.
export function prepareClientStorage(storage) {
  storage.removeItem('accessToken');
  storage.removeItem('token');
  for (let i=0;i<storage.length;i++) {
    const key=storage.key(i);
    if (!key?.startsWith('mika_settings_')) continue;
    try {
      const settings=JSON.parse(storage.getItem(key));
      if (!settings || typeof settings!=='object' || Array.isArray(settings)) continue;
      if (!('geminiApiKey' in settings) && !('openaiApiKey' in settings)) continue;
      delete settings.geminiApiKey;delete settings.openaiApiKey;
      storage.setItem(key,JSON.stringify(settings));
    } catch { /* Keep unrelated or unreadable preferences. */ }
  }
}
