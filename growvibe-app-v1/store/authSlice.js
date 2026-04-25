import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabase } from '../lib/supabase';
import { setSelectedBranch, setSelectedSession } from './appSlice';
import { registerForPushNotificationsAsync, deletePushToken } from '../lib/notifications';

// After loading a non-owner profile, auto-set their branch + active session
async function resolveAndDispatchContext(profile, dispatch) {
  const nonOwnerRoles = ['principal', 'coordinator', 'teacher', 'student'];
  if (!nonOwnerRoles.includes(profile.role) || !profile.branch_id) return;

  dispatch(setSelectedBranch(profile.branch_id));

  const { data: session } = await supabase
    .from('sessions')
    .select('id')
    .eq('branch_id', profile.branch_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (session?.id) dispatch(setSelectedSession(session.id));
}

// ─── Error messages ───────────────────────────────────────────────────────────
const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid email or password.',
  ACCOUNT_INACTIVE:    'Your account is inactive. Please contact your school.',
  SCHOOL_INACTIVE:     'Your school is currently inactive. Please contact the administrator.',
  BRANCH_INACTIVE:     'Your branch is currently inactive. Please contact your school.',
  PROFILE_LOAD_FAILED: 'Failed to load your profile. Please try again.',
  CONNECTION_ERROR:    'Connection error. Please try again.',
};

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const loginThunk = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue, dispatch }) => {
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

      // isActive checks (UX layer — real enforcement is RLS)
      if (!profile.is_active) {
        await supabase.auth.signOut();
        return rejectWithValue(AUTH_ERRORS.ACCOUNT_INACTIVE);
      }

      if (profile.school_id) {
        const { data: school } = await supabase
          .from('schools')
          .select('is_active')
          .eq('id', profile.school_id)
          .maybeSingle();

        if (school && !school.is_active) {
          await supabase.auth.signOut();
          return rejectWithValue(AUTH_ERRORS.SCHOOL_INACTIVE);
        }
      }

      if (profile.branch_id) {
        const { data: branch } = await supabase
          .from('branches')
          .select('is_active')
          .eq('id', profile.branch_id)
          .maybeSingle();

        if (branch && !branch.is_active) {
          await supabase.auth.signOut();
          return rejectWithValue(AUTH_ERRORS.BRANCH_INACTIVE);
        }
      }

      await resolveAndDispatchContext(profile, dispatch);

      // Register push token after all auth checks pass (non-blocking)
      registerForPushNotificationsAsync(userId);

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
  async (userId, { rejectWithValue }) => {
    try {
      // Delete push token before signing out so RLS still allows the delete
      if (userId) await deletePushToken(userId);
      await supabase.auth.signOut();
    } catch {
      return rejectWithValue('Logout failed.');
    }
  }
);

export const initAuthThunk = createAsyncThunk(
  'auth/init',
  async (_, { rejectWithValue, dispatch }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) return null;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error || !profile) return null;

      await resolveAndDispatchContext(profile, dispatch);
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
    error:   null,
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
  },
  extraReducers: (builder) => {
    builder
      .addCase(initAuthThunk.pending, (state) => {
        state.loading = true;
      })
      .addCase(initAuthThunk.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.session = action.payload.session;
          state.profile = action.payload.profile;
        }
      })
      .addCase(initAuthThunk.rejected, (state) => {
        state.loading = false;
      });

    builder
      .addCase(loginThunk.pending, (state) => {
        // Do NOT set loading=true here — that flag controls the full-screen
        // splash and would unmount the navigator, resetting the route to index.
        // The login button has its own Formik isSubmitting spinner.
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.session = action.payload.session;
        state.profile = action.payload.profile;
        state.error   = null;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.error = action.payload || 'Login failed.';
      });

    builder
      .addCase(logoutThunk.fulfilled, (state) => {
        state.session = null;
        state.profile = null;
        state.error   = null;
        state.loading = false;
      });

    builder
      .addCase(updateProfileThunk.fulfilled, (state, action) => {
        state.profile = action.payload;
      });
  },
});

export const { clearAuth, clearError, setProfile } = authSlice.actions;
export default authSlice.reducer;
