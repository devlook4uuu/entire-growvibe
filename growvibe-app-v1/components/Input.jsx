import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Svg, Circle, Line, Path } from 'react-native-svg';
import { Colors } from '../constant/colors';
import { Fonts } from '../constant/fonts';
import { hp } from '../helpers/dimension';

// ─── Eye icons ────────────────────────────────────────────────────────────────
function EyeOpenIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke={Colors.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx={12} cy={12} r={3} />
    </Svg>
  );
}

function EyeClosedIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke={Colors.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <Line x1={1} y1={1} x2={23} y2={23} />
    </Svg>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
/**
 * Reusable Input component — works standalone or with Formik.
 *
 * Formik usage:
 *   <Input
 *     type="email"
 *     placeholder="Email"
 *     value={values.email}
 *     onChangeText={handleChange('email')}
 *     onBlur={handleBlur('email')}
 *     error={touched.email && errors.email}
 *   />
 *
 * Props:
 *   type         — 'text' | 'email' | 'password'  (default: 'text')
 *   placeholder  — string
 *   value        — string
 *   onChangeText — function
 *   onBlur       — function
 *   error        — string | false | undefined
 *   editable     — bool (default true)
 *   inputStyle   — extra style for TextInput
 *   containerStyle — extra style for outer wrapper
 */
export default function Input({
  type = 'text',
  placeholder,
  value,
  onChangeText,
  onBlur,
  error,
  editable = true,
  inputStyle,
  containerStyle,
}) {
  const [focused,  setFocused]  = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);

  const isPassword    = type === 'password';
  const isEmail       = type === 'email';
  const secureText    = isPassword && !showPwd;
  const keyboardType  = isEmail ? 'email-address' : 'default';

  const borderColor = error
    ? Colors.danger
    : focused
      ? Colors.primary
      : Colors.border;

  return (
    <View style={[S.wrapper, containerStyle]}>
      <View style={[S.inputRow, { borderColor }, focused && S.inputRowFocused]}>
        <TextInput
          style={[S.input, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
          placeholderTextColor={Colors.muted}
          secureTextEntry={secureText}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable}
        />

        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPwd((v) => !v)}
            style={S.eyeBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {showPwd ? <EyeOpenIcon /> : <EyeClosedIcon />}
          </TouchableOpacity>
        )}
      </View>

      {!!error && (
        <Text style={S.errorText}>{error}</Text>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: hp(5.8),
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  inputRowFocused: {
    borderColor: Colors.primary,
  },
  input: {
    flex: 1,
    fontSize: hp(1.7),
    fontFamily: Fonts.regular,
    color: Colors.ink,
    letterSpacing: -0.1,
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 4,
    marginLeft: 6,
  },
  errorText: {
    marginTop: 5,
    fontSize: hp(1.4),
    fontFamily: Fonts.regular,
    color: Colors.danger,
  },
});
