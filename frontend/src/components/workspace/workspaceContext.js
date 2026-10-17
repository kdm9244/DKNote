import { createContext, useContext } from "react";
export const WorkspaceContext = createContext(null);
export const DEFAULT_PREFERENCES = {
  aiEnabled: true,
  cards: ["calendar", "learning", "ledger", "travel"],
  calendarView: "month",
  weekStart: 0,
  theme: "sky",
  hiddenCalendarIds: [],
  pdfNoteRatio: 55,
  pdfWordRatio: 40,
};
export function useWorkspace() {
  return useContext(WorkspaceContext);
}
