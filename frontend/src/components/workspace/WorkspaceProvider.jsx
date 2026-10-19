import { useEffect, useState, useCallback } from "react";
import { WorkspaceContext, DEFAULT_PREFERENCES } from "./workspaceContext";
import api, { getCurrentUserId } from "../../api/client";
import { workspaceApi, messageOf } from "../../api/workspace";
import { memoryService } from "../../services/memory";

export function WorkspaceProvider({ children }) {
  const [entries, setEntries] = useState([]);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      setEntries(await workspaceApi.entries());
      setError("");
    } catch (e) {
      setError(messageOf(e));
      throw e;
    }
  }, []);
  useEffect(() => {
    let active = true;
    if (!sessionStorage.getItem("accessToken")) {
      setLoading(false);
      return;
    }
    api.get('/api/users/myProfile').then(profile=>profile.data.role==='NOTICE_PUBLISHER'?[[],{},profile]:Promise.all([workspaceApi.entries(),workspaceApi.settings(),Promise.resolve(profile)]))
      .then(([data, prefs, profile]) => {
        if (!active) return;
        setEntries(data);
        setSettings({ ...DEFAULT_PREFERENCES, ...prefs });
        setUser(profile.data);
        if (prefs.mikaProfile) memoryService.saveProfile(prefs.mikaProfile);
        if (prefs.mikaSettings) memoryService.saveSettings(prefs.mikaSettings);
        if (prefs.mikaMemories) memoryService.saveMemories(prefs.mikaMemories);
      })
      .catch((e) => {
        if (active) setError(messageOf(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.workspaceTheme = settings.theme;
  }, [settings.theme]);
  const save = async (item, changes = {}) => {
    const result = item.id
      ? await workspaceApi.save(item, changes)
      : await workspaceApi.create(item.kind, { ...item, ...changes });
    setEntries((current) =>
      [...current.filter((e) => e.id !== result.id), result].sort(
        (a, b) =>
          a.position - b.position || a.createdAt.localeCompare(b.createdAt),
      ),
    );
    return result;
  };
  const remove = async (id) => {
    await workspaceApi.remove(id);
    await refresh();
  };
  const preferences = async (changes) => {
    const next = await workspaceApi.preferences(changes);
    setSettings({ ...DEFAULT_PREFERENCES, ...next });
    return next;
  };
  const upload = async (file, parentId) => {
    const result = await workspaceApi.upload(file, parentId);
    setEntries((current) => [...current, result]);
    return result;
  };
  const replace = (results) => {
    const ids = new Set(results.map((e) => e.id));
    setEntries((current) =>
      [...current.filter((e) => !ids.has(e.id)), ...results].sort(
        (a, b) =>
          a.position - b.position || a.createdAt.localeCompare(b.createdAt),
      ),
    );
  };
  const reorder = async (items) => {
    replace(await workspaceApi.reorder(items));
  };
  const mastery = async (ids, complete) => {
    replace(await workspaceApi.mastery(ids, complete));
  };
  return (
    <WorkspaceContext.Provider
      value={{
        entries,
        user,
        settings,
        loading,
        error,
        refresh,
        save,
        remove,
        preferences,
        upload,
        reorder,
        mastery,
        importWords: async (data) => {const results=await workspaceApi.importWords(data);replace(results);return results;},
        savePdfPage: async (id,page,data) => {const result=await workspaceApi.savePdfPage(id,page,data);replace([result]);return result;},
        uid: getCurrentUserId(),
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
