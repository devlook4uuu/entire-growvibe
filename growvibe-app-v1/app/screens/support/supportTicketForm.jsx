/**
 * supportTicketForm.jsx
 *
 * Create a new support ticket.
 */

import { useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';
import { ScreenWrapper } from '../../../helpers/screenWrapper';
import { supabase } from '../../../lib/supabase';
import { invalidateSupportTicketCache } from './supportTicketList';

const PRIORITIES = [
  { key: 'low',    label: 'Low',    color: Colors.success, bg: Colors.successLight },
  { key: 'medium', label: 'Medium', color: Colors.warning, bg: Colors.warningLight },
  { key: 'high',   label: 'High',   color: Colors.danger,  bg: Colors.dangerLight  },
];

export default function SupportTicketForm() {
  const router  = useRouter();
  const profile = useSelector((s) => s.auth.profile);

  const [title,    setTitle]    = useState('');
  const [message,  setMessage]  = useState('');
  const [priority, setPriority] = useState('medium');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit() {
    if (!title.trim())   { setError('Title is required.'); return; }
    if (!message.trim()) { setError('Message is required.'); return; }
    if (!profile?.school_id) { setError('Unable to submit ticket — school not found.'); return; }

    setSaving(true);
    setError('');

    const { error: err } = await supabase.from('support_tickets').insert({
      school_id:  profile.school_id,
      created_by: profile.id,
      role:       profile.role,
      title:      title.trim(),
      message:    message.trim(),
      priority,
    });

    setSaving(false);
    if (err) { setError(err.message); return; }
    invalidateSupportTicketCache(profile.id, profile.role);
    router.back();
  }

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={S.backBtn}>
          <Ionicons name="arrow-back" size={hp(2.6)} color={Colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle}>New Support Ticket</Text>
          <Text style={S.headerSub}>Describe your issue</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={S.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <Text style={S.label}>Title</Text>
        <TextInput
          style={S.input}
          placeholder="Brief summary of the issue"
          placeholderTextColor={Colors.muted}
          value={title}
          onChangeText={setTitle}
          maxLength={120}
        />

        {/* Priority */}
        <Text style={S.label}>Priority</Text>
        <View style={S.priorityRow}>
          {PRIORITIES.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[S.priorityBtn, { backgroundColor: priority === p.key ? p.color : p.bg }]}
              onPress={() => setPriority(p.key)}
              activeOpacity={0.8}
            >
              <Text style={[S.priorityBtnText, { color: priority === p.key ? Colors.white : p.color }]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Message */}
        <Text style={S.label}>Message</Text>
        <TextInput
          style={[S.input, S.textarea]}
          placeholder="Describe your issue in detail…"
          placeholderTextColor={Colors.muted}
          value={message}
          onChangeText={setMessage}
          multiline
          textAlignVertical="top"
        />

        {!!error && <Text style={S.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[S.submitBtn, saving && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color={Colors.white} size="small" />
            : <Text style={S.submitBtnText}>Submit Ticket</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </ScreenWrapper>
  );
}

const S = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: wp(3),
    paddingHorizontal: wp(4), paddingTop: hp(1.5), paddingBottom: hp(1.5),
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: hp(2), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },
  headerSub:   { fontSize: hp(1.4), fontFamily: Fonts.regular, color: Colors.muted, marginTop: 2 },

  content: { paddingHorizontal: wp(4), paddingTop: hp(2), paddingBottom: hp(4), gap: hp(0.6) },

  label: { fontSize: hp(1.5), fontFamily: Fonts.semiBold, color: Colors.soft, marginBottom: hp(0.6), marginTop: hp(1.2) },
  input: {
    backgroundColor: Colors.white, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.borderLight,
    paddingHorizontal: wp(4), paddingVertical: hp(1.4),
    fontSize: hp(1.65), fontFamily: Fonts.regular, color: Colors.ink,
  },
  textarea: { height: hp(16), paddingTop: hp(1.4) },

  priorityRow: { flexDirection: 'row', gap: wp(2) },
  priorityBtn: {
    flex: 1, paddingVertical: hp(1.2), borderRadius: 10,
    alignItems: 'center',
  },
  priorityBtnText: { fontSize: hp(1.55), fontFamily: Fonts.semiBold },

  errorText: { fontSize: hp(1.4), fontFamily: Fonts.regular, color: Colors.danger, marginTop: hp(0.5) },

  submitBtn: {
    marginTop: hp(2), backgroundColor: Colors.primary,
    borderRadius: 12, paddingVertical: hp(1.7), alignItems: 'center',
  },
  submitBtnText: { fontSize: hp(1.7), fontFamily: Fonts.semiBold, color: Colors.white },
});
