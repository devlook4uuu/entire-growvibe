import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabase } from '../lib/supabase';
import { setRole } from './roleSlice';
import { checkActiveStatus, INACTIVE_ERRORS } from '../lib/activeStatusCheck';

// ─── Error messages ───────────────────────────────────────────────────────────
const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid email or password.',
  PROFILE_LOAD_FAILED: 'Failed to load your profile. Please try again.',
  CONNECTION_ERROR:    'Connection error. Please try again.',
  MAX_DEVICES:         'You are already logged in on 2 devices. Please log out from one device first.',
};

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const loginThunk = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { dispatch, rejectWithValue }) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        const isInvalidCreds =
          error.message.toLowerCase().includes('invalid') || error.status === 400;
        return rejectWithValue(
          isInvalidCreds ? AUTH_ERRORS.INVALID_CREDENTIALS : AUTH_ERRORS.CONNECTION_ERROR
        );
      }

      const { session } = data;
      const userId = data.user.id;

      // Fetch full profile row
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        return rejectWithValue(AUTH_ERRORS.PROFILE_LOAD_FAILED);
      }

      // isActive checks (UX layer — real enforcement is RLS on backend)
      const inactiveError = await checkActiveStatus(profile.role);
      if (inactiveError) {
        await supabase.auth.signOut();
        return rejectWithValue(inactiveError);
      }

      dispatch(setRole(profile.role));

      return { session, profile };
    } catch {
      return rejectWithValue(AUTH_ERRORS.CONNECTION_ERROR);
    }
  }
);

export const updateProfileThunk = createAsyncThunk(
  'auth/updateProfile',
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) return rejectWithValue(error.message);
      return data;
    } catch {
      return rejectWithValue('Failed to update profile. Please try again.');
    }
  }
);

export const logoutThunk = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await supabase.auth.signOut();
    } catch {
      return rejectWithValue('Logout failed.');
    }
  }
);

export const initAuthThunk = createAsyncThunk(
  'auth/init',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) return null;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error || !profile) return null;

      // Run active status check on session restore
      const inactiveError = await checkActiveStatus(profile.role);
      if (inactiveError) {
        await supabase.auth.signOut();
        return { forceLogoutError: inactiveError };
      }

      dispatch(setRole(profile.role));

      return { session, profile };
    } catch {
      return rejectWithValue('Failed to restore session.');
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    session: null,
    profile: null,
    loading: true,  // true on first load while checking session
    error: null,
  },
  reducers: {
    clearAuth(state) {
      state.session = null;
      state.profile = null;
      state.error   = null;
      state.loading = false;
    },
    clearError(state) {
      state.error = null;
    },
    setProfile(state, action) {
      state.profile = action.payload;
    },
    // Triggered by the periodic active-status check when a deactivation is detected
    forceLogout(state, action) {
      state.session = null;
      state.profile = null;
      state.error   = action.payload || INACTIVE_ERRORS.USER;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initAuthThunk.pending, (state) => {
        state.loading = true;
      })
      .addCase(initAuthThunk.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload?.forceLogoutError) {
          state.session = null;
          state.profile = null;
          state.error   = action.payload.forceLogoutError;
        } else if (action.payload) {
          state.session = action.payload.session;
          state.profile = action.payload.profile;
        }
      })
      .addCase(initAuthThunk.rejected, (state) => {
        state.loading = false;
      });

    builder
      .addCase(loginThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.session = action.payload.session;
        state.profile = action.payload.profile;
        state.error = null;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Login failed.';
      });

    builder
      .addCase(updateProfileThunk.fulfilled, (state, action) => {
        state.profile = action.payload;
      });

    builder
      .addCase(logoutThunk.fulfilled, (state) => {
        state.session = null;
        state.profile = null;
        state.error = null;
        state.loading = false;
      });
  },
});

export const { clearAuth, clearError, setProfile, forceLogout } = authSlice.actions;
export default authSlice.reducer;
