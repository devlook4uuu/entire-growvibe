import { createSlice } from '@reduxjs/toolkit';

// ─── App Slice ────────────────────────────────────────────────────────────────
// Stores UI-scoped global context that many screens need but is not auth state.
// selectedBranchId  — the branch the owner is currently working in
// selectedSessionId — the active session for that branch (null if none exists)

const appSlice = createSlice({
  name: 'app',
  initialState: {
    selectedBranchId:  null,
    selectedSessionId: null,
  },
  reducers: {
    setSelectedBranch(state, action) {
      // When branch changes, clear session — caller must set it after fetching
      state.selectedBranchId  = action.payload;
      state.selectedSessionId = null;
    },
    setSelectedSession(state, action) {
      state.selectedSessionId = action.payload;
    },
    clearAppContext(state) {
      state.selectedBranchId  = null;
      state.selectedSessionId = null;
    },
  },
});

export const { setSelectedBranch, setSelectedSession, clearAppContext } = appSlice.actions;
export default appSlice.reducer;
