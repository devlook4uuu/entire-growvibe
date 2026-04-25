import { configureStore } from '@reduxjs/toolkit';
import roleReducer from './roleSlice';
import authReducer from './authSlice';
import appReducer  from './appSlice';

export const store = configureStore({
  reducer: {
    role: roleReducer,
    auth: authReducer,
    app:  appReducer,
  },
});
