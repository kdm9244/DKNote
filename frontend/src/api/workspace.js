import api from "./client";
export const workspaceApi = {
  importWords: (data) => api.post('/api/workspace/words/import',data).then(r=>r.data),
  savePdfPage: (id,page,data) => api.put(`/api/workspace/pdf/${id}/pages/${page}`,data).then(r=>r.data),
  entries: () => api.get("/api/workspace/entries").then((r) => r.data),
  create: (kind, data) =>
    api.post(`/api/workspace/entries/${kind}`, data).then((r) => r.data),
  save: (item, changes = {}) =>
    api
      .put(`/api/workspace/entries/${item.id}`, { ...item, ...changes })
      .then((r) => r.data),
  remove: (id) => api.delete(`/api/workspace/entries/${id}`),
  reorder: (items) =>
    api
      .put(
        "/api/workspace/order",
        items.map((e) => ({ id: e.id, version: e.version })),
      )
      .then((r) => r.data),
  mastery: (ids, completed) =>
    api
      .patch("/api/workspace/words/mastery", { ids, completed })
      .then((r) => r.data),
  settings: () => api.get("/api/workspace/settings").then((r) => r.data),
  preferences: (data) =>
    api.patch("/api/workspace/settings", data).then((r) => r.data),
  upload: (file, parentId = "") => {
    const form = new FormData();
    form.append("file", file);
    if (parentId) form.append("parentId", parentId);
    return api.post("/api/workspace/pdf", form).then((r) => r.data);
  },
  pdf: (id) =>
    api
      .get(`/api/workspace/pdf/${id}/file`, { responseType: "blob" })
      .then((r) => r.data),
};
export const googleApi = {
  status: () => api.get("/api/calendar/google/status").then((r) => r.data),
  connect: () =>
    api
      .post("/api/calendar/google/connect", { origin: window.location.origin })
      .then((r) => r.data),
  disconnect: () => api.delete("/api/calendar/google/connect"),
  calendars: () =>
    api.get("/api/calendar/google/calendars").then((r) => r.data),
  events: (calendarId, start, end) =>
    api
      .get("/api/calendar/google/events", {
        params: { calendarId, start, end },
      })
      .then((r) => r.data),
  save: (calendarId, data, id) =>
    (id
      ? api.patch(
          `/api/calendar/google/events/${encodeURIComponent(id)}`,
          data,
          { params: { calendarId } },
        )
      : api.post("/api/calendar/google/events", data, {
          params: { calendarId },
        })
    ).then((r) => r.data),
  remove: (calendarId, id, etag) =>
    api.delete(`/api/calendar/google/events/${encodeURIComponent(id)}`, {
      params: { calendarId, etag },
    }),
};
export function messageOf(e) {
  return (
    e.response?.data?.message ||
    e.response?.data?.detail ||
    "처리하지 못했습니다. 연결 상태를 확인하고 다시 시도하세요."
  );
}
