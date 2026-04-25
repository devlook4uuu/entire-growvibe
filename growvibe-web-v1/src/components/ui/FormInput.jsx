import { useState } from 'react';
import { C, FONT, RADIUS } from '../../styles/colors';

// ─── Eye icons ────────────────────────────────────────────────────────────────
function EyeOpenIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  wrapper: { marginBottom: 20 },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: C.ink,
    marginBottom: 6,
    letterSpacing: '-0.1px',
    fontFamily: FONT,
  },
  inputBase: {
    width: '100%',
    height: 48,
    borderRadius: RADIUS.md,
    fontSize: 14,
    color: C.ink,
    background: C.white,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
    fontFamily: FONT,
    letterSpacing: '-0.1px',
  },
  toggleBtn: {
    position: 'absolute',
    right: 13,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: C.muted,
    display: 'flex',
    alignItems: 'center',
    padding: 2,
    borderRadius: 4,
    lineHeight: 0,
  },
  errorText: {
    marginTop: 5,
    fontSize: 12,
    color: C.danger,
    fontFamily: FONT,
  },
};

function borderColor(focused, hasError) {
  if (hasError) return C.danger;
  if (focused) return C.primary;
  return C.border;
}

/**
 * FormInput
 *
 * A labeled input field that integrates directly with Formik via field/form props.
 * Supports optional password visibility toggle.
 *
 * Props:
 *   field      — Formik field object  (from <Field component={FormInput} />)
 *   form       — Formik form object
 *   label      — string
 *   type       — 'text' | 'email' | 'password'
 *   placeholder — string
 *   autoComplete — string
 *   disabled   — bool
 */
export default function FormInput({
  field,
  form,
  label,
  type = 'text',
  placeholder = '',
  autoComplete,
  disabled = false,
}) {
  const [focused,  setFocused]  = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);

  const isPassword = type === 'password';
  const inputType  = isPassword && showPwd ? 'text' : type;

  const touched  = form?.touched?.[field?.name];
  const errorMsg = form?.errors?.[field?.name];
  const hasError = Boolean(touched && errorMsg);

  const inputStyle = {
    ...S.inputBase,
    padding: isPassword ? '0 44px 0 14px' : '0 14px',
    border: `1.5px solid ${borderColor(focused, hasError)}`,
  };

  return (
    <div style={S.wrapper}>
      {label && (
        <label style={S.label} htmlFor={field?.name}>
          {label}
        </label>
      )}

      <div style={{ position: 'relative' }}>
        <input
          {...field}
          id={field?.name}
          type={inputType}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            setFocused(false);
            field?.onBlur?.(e);
          }}
          style={inputStyle}
        />

        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={showPwd ? 'Hide password' : 'Show password'}
            onClick={() => setShowPwd((v) => !v)}
            style={S.toggleBtn}
          >
            {showPwd ? <EyeOpenIcon /> : <EyeClosedIcon />}
          </button>
        )}
      </div>

      {hasError && (
        <div style={S.errorText}>{errorMsg}</div>
      )}
    </div>
  );
}
