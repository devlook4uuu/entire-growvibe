import { createSlice } from '@reduxjs/toolkit';

const LS_KEY = 'gv_app_context';

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { selectedBranchId: null, selectedSessionId: null };
    return JSON.parse(raw);
  } catch {
    return { selectedBranchId: null, selectedSessionId: null };
  }
}

function saveToStorage(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      selectedBranchId:  state.selectedBranchId,
      selectedSessionId: state.selectedSessionId,
    }));
  } catch { /* ignore */ }
}

const appSlice = createSlice({
  name: 'app',
  initialState: loadFromStorage(),
  reducers: {
    setSelectedBranch(state, action) {
      state.selectedBranchId  = action.payload;
      state.selectedSessionId = null;
      saveToStorage(state);
    },
    setSelectedSession(state, action) {
      state.selectedSessionId = action.payload;
      saveToStorage(state);
    },
    clearAppContext(state) {
      state.selectedBranchId  = null;
      state.selectedSessionId = null;
      saveToStorage(state);
    },
  },
});

export const { setSelectedBranch, setSelectedSession, clearAppContext } = appSlice.actions;
export default appSlice.reducer;
