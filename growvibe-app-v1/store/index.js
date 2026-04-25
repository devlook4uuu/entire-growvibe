import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import appReducer from './appSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    app:  appReducer,
  },
});
