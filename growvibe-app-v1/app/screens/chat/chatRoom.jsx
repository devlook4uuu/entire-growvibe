/**
 * chatRoom.jsx — Full real-time group chat room
 *
 * Route params: chatId, chatName, canSend ('true'|'false')
 *
 * Features:
 *  - Supabase Realtime (subscribe on mount, unsubscribe on unmount)
 *  - Reverse-paginated messages (newest at bottom, scroll up to load older)
 *  - Text, image, document, voice messages
 *  - Copy / edit / soft-delete with long-press context menu
 *  - Emoji reactions (one per user; tap again to change/remove; tap reaction to see who reacted)
 *  - Reply-to preview
 *  - Full emoji picker for reactions
 *  - Attachment preview + download
 *  - Smooth pagination (prepend older messages without jerk)
 */

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';

import { supabase } from '../../../lib/supabase';
import { sendPush } from '../../../lib/notifications';
import { Colors } from '../../../constant/colors';
import { Fonts } from '../../../constant/fonts';
import { hp, wp } from '../../../helpers/dimension';
import { CachedImage, CachedAvatar, getSignedUrl } from '../../../helpers/imageCache';
import { ScreenWrapper } from '../../../helpers/screenWrapper';

const PAGE_SIZE      = 30;
const REACTION_EMOJIS = ['👍','❤️','😂','😮','😢','😡','🎉','🔥','👏','🙏'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
function formatDuration(ms) {
  if (!ms) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ─── Attachment label helper (icon + text, no emojis) ────────────────────────
function AttachLabel({ message, color }) {
  if (message.is_deleted) return <Text style={{ color }}>Deleted message</Text>;
  if (message.type === 'text') return <Text style={{ color }} numberOfLines={1}>{message.content}</Text>;
  if (message.type === 'image') return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="image-outline" size={hp(1.6)} color={color} />
      <Text style={{ color }}>Image</Text>
    </View>
  );
  if (message.type === 'document') return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="document-outline" size={hp(1.6)} color={color} />
      <Text style={{ color }} numberOfLines={1}>{message.file_name || 'Document'}</Text>
    </View>
  );
  // voice
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="mic-outline" size={hp(1.6)} color={color} />
      <Text style={{ color }}>Voice message</Text>
    </View>
  );
}

// ─── ReplyPreview (inside input bar) ─────────────────────────────────────────
function ReplyPreview({ message, senderName, onCancel }) {
  return (
    <View style={S.replyBar}>
      <View style={S.replyBarAccent} />
      <View style={{ flex: 1 }}>
        <Text style={S.replyBarName}>{senderName}</Text>
        <AttachLabel message={message} color={Colors.soft} />
      </View>
      <TouchableOpacity onPress={onCancel} hitSlop={8}>
        <Ionicons name="close" size={hp(2.2)} color={Colors.muted} />
      </TouchableOpacity>
    </View>
  );
}

// ─── InlineReplyQuote (inside message bubble) ────────────────────────────────
function InlineReplyQuote({ message, senderName, isMine }) {
  if (!message) return null;
  const textColor = isMine ? 'rgba(255,255,255,0.75)' : Colors.soft;
  return (
    <View style={S.quoteWrap}>
      <View style={S.quoteAccent} />
      <View style={{ flex: 1 }}>
        <Text style={S.quoteName}>{senderName}</Text>
        <AttachLabel message={message} color={textColor} />
      </View>
    </View>
  );
}

// ─── ReactionSummary — WhatsApp-style combined badge ─────────────────────────
// One badge showing up to 3 emoji + total count. Tap → full reactor list sheet.
function ReactionSummary({ reactions, myId, isMine, onBadgePress }) {
  if (!reactions || reactions.length === 0) return null;

  const groups = {};
  reactions.forEach((r) => {
    if (!groups[r.emoji]) groups[r.emoji] = [];
    groups[r.emoji].push(r);
  });

  const totalCount = reactions.length;
  const iReacted   = reactions.some((r) => r.profile_id === myId);
  // Show up to 3 most-used emoji
  const topEmojis  = Object.entries(groups)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .map(([e]) => e);

  return (
    <TouchableOpacity
      style={[S.reactionBadge, iReacted && S.reactionBadgeMine, isMine && { alignSelf: 'flex-end' }]}
      onPress={() => onBadgePress(reactions)}
      activeOpacity={0.75}
    >
      <Text style={S.reactionEmoji}>{topEmojis.join('')}</Text>
      <Text style={[S.reactionCount, iReacted && { color: Colors.primary }]}>{totalCount}</Text>
    </TouchableOpacity>
  );
}

// ─── VoicePlayer ─────────────────────────────────────────────────────────────
function VoicePlayer({ bucket, path, duration, isMine }) {
  // 'idle'    — not started yet
  // 'fetching'— getting signed URL
  // 'buffering'— URL loaded into player, waiting for isLoaded
  // 'ready'   — loaded and playable
  const [phase, setPhase] = useState('idle');

  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  const playing  = status.playing ?? false;
  const position = status.currentTime != null ? status.currentTime * 1000 : 0;
  const totalDur = status.duration   != null ? status.duration   * 1000 : (duration ?? 0);

  // Transition from buffering → ready once loaded and no longer buffering
  useEffect(() => {
    if (phase === 'buffering' && status.isLoaded && !status.isBuffering) {
      setPhase('ready');
      player.play();
    }
  }, [phase, status.isLoaded, status.isBuffering]);

  async function loadAndPlay() {
    if (phase !== 'idle') return;
    setPhase('fetching');
    const url = await getSignedUrl(bucket, path);
    if (!url) {
      setPhase('idle');
      Alert.alert('Error', 'Could not load voice message.');
      return;
    }
    player.replace({ uri: url });
    setPhase('buffering');  // spinner stays on until isLoaded fires
  }

  async function toggle() {
    if (phase === 'fetching' || phase === 'buffering') return;
    if (phase === 'idle') { loadAndPlay(); return; }
    if (playing) {
      player.pause();
    } else {
      if (totalDur > 0 && position >= totalDur - 100) {
        player.seekTo(0);
      }
      player.play();
    }
  }

  const loading  = phase === 'fetching' || phase === 'buffering';
  const progress = totalDur > 0 ? Math.min(position / totalDur, 1) : 0;

  return (
    <View style={S.voiceWrap}>
      <TouchableOpacity onPress={toggle} style={S.voicePlayBtn} activeOpacity={0.8}>
        {loading
          ? <ActivityIndicator size="small" color={isMine ? Colors.white : Colors.primary} />
          : <Ionicons
              name={playing ? 'pause-circle' : 'play-circle'}
              size={hp(3.2)}
              color={isMine ? Colors.white : Colors.primary}
            />
        }
      </TouchableOpacity>
      <View style={S.voiceTrack}>
        <View style={[S.voiceProgress, {
          width: `${progress * 100}%`,
          backgroundColor: isMine ? 'rgba(255,255,255,0.9)' : Colors.primary,
        }]} />
      </View>
      <Text style={[S.voiceDuration, isMine && { color: 'rgba(255,255,255,0.8)' }]}>
        {formatDuration(playing ? position : (duration ?? 0))}
      </Text>
    </View>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────
// Receives pre-resolved sender + replySenderName so React.memo can shallow-compare
function MessageBubble({
  item, myId, sender, replySenderName, onLongPress, onBadgePress, onImagePress,
}) {
  const isMine   = item.sender_id === myId;
  const replyMsg = item.reply_msg;

  if (item.is_deleted) {
    return (
      <View style={[S.bubbleRow, isMine ? S.bubbleRowRight : S.bubbleRowLeft]}>
        {!isMine && (
          <CachedAvatar
            name={sender?.name}
            avatarUrl={sender?.avatar_url}
            size={hp(3.8)}
            style={{ alignSelf: 'flex-end', marginBottom: hp(0.4) }}
          />
        )}
        <View style={{ maxWidth: '75%' }}>
          {!isMine && sender?.name && (
            <Text style={S.senderName}>{sender.name}</Text>
          )}
          <View style={[S.bubble, S.bubbleDeleted]}>
            <Text style={S.deletedText}>
              {isMine ? 'You deleted this message' : 'This message was deleted'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[S.bubbleRow, isMine ? S.bubbleRowRight : S.bubbleRowLeft]}>
      {/* Avatar — only for others */}
      {!isMine && (
        <CachedAvatar
          name={sender?.name}
          avatarUrl={sender?.avatar_url}
          size={hp(3.8)}
          style={{ alignSelf: 'flex-end', marginBottom: hp(0.4) }}
        />
      )}

      <View style={{ maxWidth: '75%', overflow: 'hidden' }}>
        {/* Sender name — only for others in group */}
        {!isMine && sender?.name && (
          <Text style={S.senderName}>{sender.name}</Text>
        )}

        <Pressable
          onLongPress={() => onLongPress(item)}
          delayLongPress={350}
        >
          <View style={[S.bubble, isMine ? S.bubbleMine : S.bubbleOther]}>
            {/* Reply quote */}
            {replyMsg && (
              <InlineReplyQuote message={replyMsg} senderName={replySenderName} isMine={isMine} />
            )}

            {/* Content */}
            {item.type === 'text' && (
              <Text style={[S.bubbleText, isMine && S.bubbleTextMine]}>
                {item.content}
              </Text>
            )}

            {item.type === 'image' && (
              <TouchableOpacity onPress={() => onImagePress(item)} activeOpacity={0.9}>
                <CachedImage
                  bucket="chat-images"
                  path={item.content}
                  style={S.imageThumb}
                  contentFit="cover"
                />
              </TouchableOpacity>
            )}

            {item.type === 'document' && (
              <TouchableOpacity style={S.docCard} onPress={() => onImagePress(item)} activeOpacity={0.8}>
                <View style={[S.docIconWrap, isMine && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <Ionicons name="document-text-outline" size={hp(2.6)} color={isMine ? Colors.white : Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[S.docName, isMine && { color: Colors.white }]} numberOfLines={2}>{item.file_name}</Text>
                  <Text style={[S.docSize, isMine && { color: 'rgba(255,255,255,0.7)' }]}>{formatFileSize(item.file_size)}</Text>
                </View>
                <Ionicons name="download-outline" size={hp(2.2)} color={isMine ? 'rgba(255,255,255,0.8)' : Colors.muted} />
              </TouchableOpacity>
            )}

            {item.type === 'voice' && (
              <VoicePlayer
                bucket="chat-voice"
                path={item.content}
                duration={item.duration_ms}
                isMine={isMine}
              />
            )}

            {/* Time + edited */}
            <View style={[S.bubbleMeta, isMine && { justifyContent: 'flex-end' }]}>
              {item.is_edited && (
                <Text style={[S.editedLabel, isMine && { color: 'rgba(255,255,255,0.6)' }]}>edited · </Text>
              )}
              <Text style={[S.timeLabel, isMine && { color: 'rgba(255,255,255,0.7)' }]}>
                {formatTime(item.created_at)}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Reactions — combined WhatsApp-style badge */}
        <ReactionSummary
          reactions={item.reactions}
          myId={myId}
          isMine={isMine}
          onBadgePress={(allReactions) => onBadgePress(allReactions)}
        />
      </View>
    </View>
  );
}
const MessageBubbleMemo = React.memo(MessageBubble);

// ─── DateDivider ──────────────────────────────────────────────────────────────
function DateDivider({ date }) {
  const label = (() => {
    const d   = new Date(date);
    const now = new Date();
    const diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  })();
  return (
    <View style={S.dateDivider}>
      <View style={S.dateDividerLine} />
      <Text style={S.dateDividerText}>{label}</Text>
      <View style={S.dateDividerLine} />
    </View>
  );
}

// ─── Context Menu Modal ───────────────────────────────────────────────────────
function ContextMenu({ visible, message, myId, canSend, onClose, onCopy, onEdit, onDelete, onReply, onReact }) {
  if (!visible || !message) return null;
  const isMine = message.sender_id === myId;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={S.ctxOverlay} onPress={onClose}>
        <View style={S.ctxMenu}>
          {/* Emoji row */}
          <View style={S.ctxEmojiRow}>
            {REACTION_EMOJIS.map((e) => (
              <TouchableOpacity key={e} onPress={() => { onReact(message, e); onClose(); }} style={S.ctxEmojiBtn}>
                <Text style={S.ctxEmoji}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={S.ctxDivider} />

          {canSend && (
            <TouchableOpacity style={S.ctxItem} onPress={() => { onReply(message); onClose(); }}>
              <Ionicons name="return-down-back-outline" size={hp(2.2)} color={Colors.ink} />
              <Text style={S.ctxLabel}>Reply</Text>
            </TouchableOpacity>
          )}

          {message.type === 'text' && !message.is_deleted && (
            <TouchableOpacity style={S.ctxItem} onPress={() => { onCopy(message); onClose(); }}>
              <Ionicons name="copy-outline" size={hp(2.2)} color={Colors.ink} />
              <Text style={S.ctxLabel}>Copy</Text>
            </TouchableOpacity>
          )}

          {isMine && message.type === 'text' && !message.is_deleted && (
            <TouchableOpacity style={S.ctxItem} onPress={() => { onEdit(message); onClose(); }}>
              <Ionicons name="create-outline" size={hp(2.2)} color={Colors.ink} />
              <Text style={S.ctxLabel}>Edit</Text>
            </TouchableOpacity>
          )}

          {isMine && !message.is_deleted && (
            <TouchableOpacity style={S.ctxItem} onPress={() => { onDelete(message); onClose(); }}>
              <Ionicons name="trash-outline" size={hp(2.2)} color={Colors.danger} />
              <Text style={[S.ctxLabel, { color: Colors.danger }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Reaction Detail Modal (full list: emoji + name) ─────────────────────────
function ReactionDetailModal({ visible, reactors, members, onClose }) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={S.ctxOverlay} onPress={onClose}>
        <View style={S.reactionDetailSheet}>
          <View style={S.reactionDetailHandle} />
          <Text style={S.reactionDetailTitle}>Reactions</Text>
          <ScrollView>
            {(reactors || []).map((r) => {
              const m = members[r.profile_id];
              return (
                <View key={r.id} style={S.reactionDetailRow}>
                  <Text style={{ fontSize: hp(2.4) }}>{r.emoji}</Text>
                  <CachedAvatar name={m?.name} avatarUrl={m?.avatar_url} size={hp(4)} />
                  <Text style={S.reactionDetailName}>{m?.name || 'Unknown'}</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Attachment Preview (full-screen, uses ScreenWrapper) ────────────────────
function AttachmentPreview({ visible, message, onClose }) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!message) return;
    setDownloading(true);
    try {
      const bucket = message.type === 'image' ? 'chat-images' : 'chat-documents';
      const url    = await getSignedUrl(bucket, message.content);
      if (!url) { Alert.alert('Error', 'Could not get download URL'); return; }
      const ext  = message.file_name?.split('.').pop() || (message.type === 'image' ? 'jpg' : 'pdf');
      const dest = FileSystem.documentDirectory + (message.file_name || `attachment.${ext}`);
      await FileSystem.downloadAsync(url, dest);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dest);
      } else {
        Alert.alert('Downloaded', `Saved to ${dest}`);
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setDownloading(false);
    }
  }

  if (!visible || !message) return null;

  const isImage = message.type === 'image';

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose}>
      <ScreenWrapper bg={isImage ? '#000' : Colors.white} style="light">
        {/* Header */}
        <View style={S.previewHeader}>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={S.previewHeaderBtn}>
            <Ionicons name="arrow-back" size={hp(2.8)} color={Colors.white} />
          </TouchableOpacity>
          <Text style={S.previewTitle} numberOfLines={1}>
            {message.file_name || 'Preview'}
          </Text>
          <TouchableOpacity onPress={handleDownload} hitSlop={8} style={S.previewHeaderBtn} disabled={downloading}>
            {downloading
              ? <ActivityIndicator color={Colors.white} size="small" />
              : <Ionicons name="download-outline" size={hp(2.8)} color={Colors.white} />
            }
          </TouchableOpacity>
        </View>

        {/* Content */}
        {isImage ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <CachedImage
              bucket="chat-images"
              path={message.content}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
            />
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: hp(2.5), padding: wp(8) }}>
            <View style={S.previewDocIconWrap}>
              <Ionicons name="document-text-outline" size={hp(7)} color={Colors.primary} />
            </View>
            <Text style={S.previewDocName}>{message.file_name}</Text>
            {!!message.file_size && (
              <Text style={S.previewDocSize}>{formatFileSize(message.file_size)}</Text>
            )}
            <TouchableOpacity style={S.previewDownloadBtn} onPress={handleDownload} disabled={downloading} activeOpacity={0.85}>
              {downloading
                ? <ActivityIndicator color={Colors.white} size="small" />
                : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="download-outline" size={hp(2.2)} color={Colors.white} />
                    <Text style={S.previewDownloadText}>Download & Open</Text>
                  </View>
                )
              }
            </TouchableOpacity>
          </View>
        )}
      </ScreenWrapper>
    </Modal>
  );
}

// ─── Attachment Preview Bar (above input, before send) ───────────────────────
function AttachmentPreviewBar({ attachment, onSend, onCancel, uploading }) {
  const isImage = attachment.type === 'image';
  return (
    <View style={S.attachBar}>
      <View style={S.attachBarLeft}>
        {isImage ? (
          <Image
            source={{ uri: attachment.previewUri }}
            style={S.attachThumb}
            contentFit="cover"
          />
        ) : (
          <View style={S.attachDocIcon}>
            <Ionicons name="document-text-outline" size={hp(2.6)} color={Colors.primary} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={S.attachFileName} numberOfLines={1}>
            {attachment.fileName || (isImage ? 'Image' : 'Document')}
          </Text>
          {attachment.fileSize ? (
            <Text style={S.attachFileSize}>{formatFileSize(attachment.fileSize)}</Text>
          ) : null}
        </View>
      </View>
      <View style={S.attachBarActions}>
        <TouchableOpacity onPress={onCancel} style={S.attachCancelBtn} hitSlop={8} disabled={uploading}>
          <Ionicons name="close" size={hp(2.2)} color={Colors.danger} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSend}
          style={[S.attachSendBtn, uploading && { opacity: 0.6 }]}
          disabled={uploading}
          activeOpacity={0.8}
        >
          {uploading
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <Ionicons name="send" size={hp(2)} color={Colors.white} />
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Recording Bar ────────────────────────────────────────────────────────────
function RecordingBar({ duration, onStop, onCancel }) {
  return (
    <View style={S.recordingBar}>
      <TouchableOpacity onPress={onCancel} hitSlop={8}>
        <Ionicons name="close" size={hp(2.4)} color={Colors.danger} />
      </TouchableOpacity>
      <View style={S.recordingDot} />
      <Text style={S.recordingTime}>{formatDuration(duration)}</Text>
      <View style={{ flex: 1 }} />
      <TouchableOpacity onPress={onStop} style={S.recordingStopBtn} activeOpacity={0.8}>
        <Ionicons name="stop" size={hp(2.2)} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ChatRoom() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const profile = useSelector((s) => s.auth.profile);
  const { chatId, chatName, chatImageUrl: chatImageUrlParam, canSend: canSendParam } = useLocalSearchParams();

  const myId    = profile?.id;

  // Group image + real member count + live can_send_message — re-fetch on every focus
  const [groupImageUri,  setGroupImageUri]  = useState(null);
  const [memberCount,    setMemberCount]    = useState(null);
  // canSend starts from route param but is refreshed from DB on every focus
  const [canSend, setCanSend] = useState(canSendParam === 'true');

  useFocusEffect(useCallback(() => {
    if (!chatId) return;
    let cancelled = false;

    // Fetch image_url, member count, and own can_send_message in parallel
    Promise.all([
      supabase.from('chats').select('image_url').eq('id', chatId).maybeSingle(),
      supabase.from('chat_members').select('profile_id', { count: 'exact', head: true }).eq('chat_id', chatId),
      supabase.from('chat_members').select('can_send_message').eq('chat_id', chatId).eq('profile_id', myId).maybeSingle(),
    ]).then(async ([chatRes, countRes, memberRes]) => {
      if (cancelled) return;
      // Member count
      if (countRes.count != null) setMemberCount(countRes.count);
      // Live send permission
      if (memberRes.data != null) setCanSend(memberRes.data.can_send_message);
      // Group image
      const path = chatRes.data?.image_url || chatImageUrlParam || '';
      if (!path) { setGroupImageUri(null); return; }
      const url = await getSignedUrl('chat-images', path);
      if (!cancelled) setGroupImageUri(url || null);
    });

    return () => { cancelled = true; };
  }, [chatId, chatImageUrlParam, myId]));

  // ── State ──────────────────────────────────────────────────────────────────
  const [messages,    setMessages]    = useState([]);
  const [members,     setMembers]     = useState({});   // { profileId: profile }
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(true);
  const [text,        setText]        = useState('');
  const [sending,     setSending]     = useState(false);
  const [replyTo,     setReplyTo]     = useState(null);  // message being replied to
  const [editMsg,     setEditMsg]     = useState(null);  // message being edited
  const [ctxMsg,      setCtxMsg]      = useState(null);  // long-press context target
  const [ctxVisible,  setCtxVisible]  = useState(false);
  const [previewMsg,  setPreviewMsg]  = useState(null);
  const [reactionDetail, setReactionDetail] = useState(null); // all reactions array for the tapped message
  const [uploading,        setUploading]        = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null); // { uri, type, fileName, mimeType, fileSize, previewUri }

  // Voice recording
  const recorder   = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording,  setIsRecording]  = useState(false);
  const [recDuration,  setRecDuration]  = useState(0);
  const recTimer = useRef(null);

  const flatRef           = useRef(null);
  const channelRef        = useRef(null);
  const oldestDateRef     = useRef(null);   // oldest created_at loaded — for pagination cursor
  const isFetchingMore    = useRef(false);
  const membersRef        = useRef({});     // always-fresh mirror of members state for Realtime callbacks

  // Keep membersRef in sync with members state
  useEffect(() => { membersRef.current = members; }, [members]);

  // ── Mark chat as read on mount + when returning to screen ────────────────
  useEffect(() => {
    if (!chatId || !myId) return;
    supabase
      .from('chat_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .eq('profile_id', myId)
      .then(() => {});
  }, [chatId, myId]);

  // ── Build messages with reactions + reply snapshots ───────────────────────
  function attachReactions(msgs, reactions) {
    const rMap = {};
    (reactions || []).forEach((r) => {
      if (!rMap[r.message_id]) rMap[r.message_id] = [];
      rMap[r.message_id].push(r);
    });
    return msgs.map((m) => ({ ...m, reactions: rMap[m.id] || [] }));
  }

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function initialLoad() {
      setLoading(true);

      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('*, sender:sender_id(id,name,avatar_url), reply_to:reply_to_id(id, type, content, file_name, sender_id, is_deleted)')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (!msgs || msgs.length === 0) { setLoading(false); return; }

      oldestDateRef.current = msgs[msgs.length - 1].created_at;

      // Build members map from embedded sender data
      setMembers((prev) => {
        const next = { ...prev };
        msgs.forEach((m) => { if (m.sender) next[m.sender.id] = m.sender; });
        return next;
      });

      // Load reactions for these messages
      const ids = msgs.map((m) => m.id);
      const { data: reactions } = await supabase
        .from('message_reactions')
        .select('*')
        .in('message_id', ids);

      // Keep newest-first — matches inverted FlatList order (no reverse needed)
      const enriched = attachReactions(msgs, reactions);
      setMessages(enriched);
      setHasMore(msgs.length === PAGE_SIZE);
      setLoading(false);
    }
    initialLoad();
  }, [chatId]);

  // ── Supabase Realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `chat_id=eq.${chatId}` },
        async (payload) => {
          const msg = payload.new;
          if (!msg) return;

          // Fetch sender profile if not already cached
          if (msg.sender_id && !membersRef.current[msg.sender_id]) {
            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('id, name, avatar_url')
              .eq('id', msg.sender_id)
              .maybeSingle();
            if (senderProfile) {
              setMembers((prev) => ({ ...prev, [senderProfile.id]: senderProfile }));
            }
          }

          // Fetch reply snapshot if needed
          let reply_msg = null;
          if (msg.reply_to_id) {
            const { data } = await supabase
              .from('chat_messages')
              .select('id, type, content, file_name, sender_id, is_deleted')
              .eq('id', msg.reply_to_id)
              .maybeSingle();
            reply_msg = data;
          }
          setMessages((prev) => {
            // Deduplicate: if we already have this ID (from optimistic insert), skip
            if (prev.some((m) => m.id === msg.id)) return prev;
            // Prepend — inverted list shows newest at bottom
            return [{ ...msg, reactions: [], reply_msg }, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const updated = payload.new;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id
                // Preserve local-only enrichments (reactions, reply_msg) that DB doesn't return
                ? { ...m, ...updated, reactions: m.reactions, reply_msg: m.reply_msg }
                : m
            )
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const r = payload.new;
          setMessages((prev) => prev.map((m) => {
            if (m.id !== r.message_id) return m;
            const filtered = (m.reactions || []).filter((x) => x.profile_id !== r.profile_id);
            return { ...m, reactions: [...filtered, r] };
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const r = payload.new;
          setMessages((prev) => prev.map((m) => {
            if (m.id !== r.message_id) return m;
            const filtered = (m.reactions || []).filter((x) => x.profile_id !== r.profile_id);
            return { ...m, reactions: [...filtered, r] };
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const r = payload.old;
          setMessages((prev) => prev.map((m) => {
            if (m.id !== r.message_id) return m;
            return { ...m, reactions: (m.reactions || []).filter((x) => x.id !== r.id) };
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_members',
          filter: `chat_id=eq.${chatId}` },
        (payload) => {
          // If our own send permission changed, update canSend in real-time
          if (payload.new?.profile_id === myId) {
            setCanSend(payload.new.can_send_message);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [chatId, myId]);

  // ── Load more (older messages) ────────────────────────────────────────────
  async function loadMore() {
    if (isFetchingMore.current || !hasMore || !oldestDateRef.current) return;
    isFetchingMore.current = true;
    setLoadingMore(true);

    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('*, sender:sender_id(id,name,avatar_url), reply_to:reply_to_id(id, type, content, file_name, sender_id, is_deleted)')
      .eq('chat_id', chatId)
      .lt('created_at', oldestDateRef.current)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (!msgs || msgs.length === 0) {
      setHasMore(false);
      setLoadingMore(false);
      isFetchingMore.current = false;
      return;
    }

    oldestDateRef.current = msgs[msgs.length - 1].created_at;

    // Merge any new senders into members map
    setMembers((prev) => {
      const next = { ...prev };
      msgs.forEach((m) => { if (m.sender) next[m.sender.id] = m.sender; });
      return next;
    });

    const ids = msgs.map((m) => m.id);
    const { data: reactions } = await supabase
      .from('message_reactions')
      .select('*')
      .in('message_id', ids);

    // Keep newest-first order from query; append older messages to end of array
    // (inverted FlatList shows array-end at the top of the screen)
    const enriched = attachReactions(msgs, reactions);
    setMessages((prev) => [...prev, ...enriched]);
    setHasMore(msgs.length === PAGE_SIZE);
    setLoadingMore(false);
    isFetchingMore.current = false;
  }

  // ── Send text ─────────────────────────────────────────────────────────────
  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    if (editMsg) {
      // Optimistic edit — update locally immediately
      const updated = { ...editMsg, content: trimmed, is_edited: true };
      setMessages((prev) => prev.map((m) => m.id === editMsg.id ? updated : m));
      setText('');
      setEditMsg(null);
      await supabase
        .from('chat_messages')
        .update({ content: trimmed, is_edited: true })
        .eq('id', editMsg.id);
      return;
    }

    // Optimistic send — show message immediately, deduplicate on Realtime event
    const tempId  = `temp_${Date.now()}`;
    const tempMsg = {
      id:          tempId,
      chat_id:     chatId,
      school_id:   profile.school_id,
      sender_id:   myId,
      type:        'text',
      content:     trimmed,
      reply_to_id: replyTo?.id ?? null,
      reply_msg:   replyTo ?? null,
      reactions:   [],
      is_edited:   false,
      is_deleted:  false,
      created_at:  new Date().toISOString(),
    };
    setSending(true);
    setText('');
    const currentReplyTo = replyTo;
    setReplyTo(null);
    setMessages((prev) => [tempMsg, ...prev]);

    const { data: inserted, error } = await supabase.from('chat_messages').insert({
      chat_id:     chatId,
      school_id:   profile.school_id,
      sender_id:   myId,
      type:        'text',
      content:     trimmed,
      reply_to_id: currentReplyTo?.id ?? null,
    }).select('id').single();

    if (error) {
      // Rollback optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setText(trimmed);
      setReplyTo(currentReplyTo);
      Alert.alert('Send failed', error.message);
    } else if (inserted) {
      // Replace temp message with real ID so Realtime dedup works
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, id: inserted.id } : m));
      // Notify other chat members who may be offline (fire-and-forget)
      supabase
        .from('chat_members')
        .select('profile_id')
        .eq('chat_id', chatId)
        .neq('profile_id', myId)
        .then(({ data: memberRows }) => {
          if (!memberRows || memberRows.length === 0) return;
          const recipientIds = memberRows.map((r) => r.profile_id);
          const senderName = profile?.name || 'Someone';
          sendPush(
            recipientIds,
            chatName || 'New message',
            `${senderName}: ${trimmed.slice(0, 50)}${trimmed.length > 50 ? '…' : ''}`,
            { type: 'chat_message', chatId },
          );
        });
    }
    setSending(false);
  }

  // ── Upload helper ─────────────────────────────────────────────────────────
  async function uploadAndSend({ uri, type, fileName, mimeType, fileSize }) {
    setUploading(true);
    try {
      const bucket   = type === 'image' ? 'chat-images' : 'chat-documents';
      const ext      = fileName?.split('.').pop() || (type === 'image' ? 'jpg' : 'bin');
      const safeSchoolId = (profile.school_id || '').replace(/[^a-zA-Z0-9\-_]/g, '');
      const safeChatId   = (chatId || '').replace(/[^a-zA-Z0-9\-_]/g, '');
      const path     = `${safeSchoolId}/${safeChatId}/${Date.now()}.${ext}`;
      const base64   = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const arrayBuf = decodeBase64(base64);

      const { error: upErr } = await supabase.storage.from(bucket).upload(path, arrayBuf, {
        contentType: mimeType || 'application/octet-stream',
        upsert: false,
      });
      if (upErr) { Alert.alert('Upload failed', upErr.message); return; }

      const { data: inserted } = await supabase.from('chat_messages').insert({
        chat_id:   chatId,
        school_id: profile.school_id,
        sender_id: myId,
        type,
        content:   path,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
        reply_to_id: replyTo?.id ?? null,
      }).select('id').single();

      // Show immediately — Realtime will dedup
      if (inserted) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === inserted.id)) return prev;
          return [{
            id: inserted.id, chat_id: chatId, school_id: profile.school_id,
            sender_id: myId, type, content: path,
            file_name: fileName, file_size: fileSize, mime_type: mimeType,
            reply_to_id: replyTo?.id ?? null, reply_msg: replyTo ?? null,
            reactions: [], is_edited: false, is_deleted: false,
            created_at: new Date().toISOString(),
          }, ...prev];
        });
        // Notify other chat members (fire-and-forget)
        supabase
          .from('chat_members')
          .select('profile_id')
          .eq('chat_id', chatId)
          .neq('profile_id', myId)
          .then(({ data: memberRows }) => {
            if (!memberRows || memberRows.length === 0) return;
            const recipientIds = memberRows.map((r) => r.profile_id);
            const senderName   = profile?.name || 'Someone';
            const preview      = type === 'image' ? 'Image' : type === 'document' ? (fileName || 'Document') : 'Voice message';
            sendPush(
              recipientIds,
              chatName || 'New message',
              `${senderName}: ${preview}`.slice(0, 50),
              { type: 'chat_message', chatId },
            );
          });
      }
      setReplyTo(null);
    } finally {
      setUploading(false);
    }
  }

  // ── Pick image — show preview, don't send yet ─────────────────────────────
  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPendingAttachment({
      uri: asset.uri, type: 'image',
      fileName: asset.uri.split('/').pop(),
      mimeType: asset.mimeType || 'image/jpeg',
      fileSize: asset.fileSize,
      previewUri: asset.uri,
    });
  }

  // ── Pick document — show preview, don't send yet ──────────────────────────
  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/msword',
             'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
             'application/vnd.ms-excel',
             'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
             'text/plain'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPendingAttachment({
      uri: asset.uri, type: 'document',
      fileName: asset.name, mimeType: asset.mimeType,
      fileSize: asset.size,
      previewUri: null,
    });
  }

  // ── Send pending attachment ───────────────────────────────────────────────
  async function sendPendingAttachment() {
    if (!pendingAttachment) return;
    const att = pendingAttachment;
    setPendingAttachment(null);
    await uploadAndSend(att);
  }

  // ── Voice recording ───────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) { Alert.alert('Permission denied', 'Microphone access is required.'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setRecDuration(0);
      recTimer.current = setInterval(() => setRecDuration((d) => d + 1000), 1000);
    } catch (e) {
      Alert.alert('Microphone error', e.message);
    }
  }

  async function stopRecording() {
    if (!isRecording) return;
    clearInterval(recTimer.current);
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    const uri        = recorder.uri;
    const durationMs = recDuration;
    setIsRecording(false);
    setRecDuration(0);

    if (!uri) return;
    setUploading(true);
    try {
      const safeSchoolIdV = (profile.school_id || '').replace(/[^a-zA-Z0-9\-_]/g, '');
      const safeChatIdV   = (chatId || '').replace(/[^a-zA-Z0-9\-_]/g, '');
      const path     = `${safeSchoolIdV}/${safeChatIdV}/${Date.now()}.m4a`;
      const base64   = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const arrayBuf = decodeBase64(base64);
      const { error: upErr } = await supabase.storage.from('chat-voice').upload(path, arrayBuf, {
        contentType: 'audio/m4a', upsert: false,
      });
      if (upErr) { Alert.alert('Upload failed', upErr.message); return; }
      const { data: voiceInserted } = await supabase.from('chat_messages').insert({
        chat_id: chatId, school_id: profile.school_id, sender_id: myId,
        type: 'voice', content: path, duration_ms: durationMs,
        reply_to_id: replyTo?.id ?? null,
      }).select('id').single();
      // Optimistic append — show immediately without waiting for Realtime
      if (voiceInserted) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === voiceInserted.id)) return prev;
          return [{
            id: voiceInserted.id, chat_id: chatId, school_id: profile.school_id,
            sender_id: myId, type: 'voice', content: path,
            duration_ms: durationMs,
            reply_to_id: replyTo?.id ?? null, reply_msg: replyTo ?? null,
            reactions: [], is_edited: false, is_deleted: false,
            created_at: new Date().toISOString(),
          }, ...prev];
        });
      }
      // Notify other chat members (fire-and-forget)
      supabase
        .from('chat_members')
        .select('profile_id')
        .eq('chat_id', chatId)
        .neq('profile_id', myId)
        .then(({ data: memberRows }) => {
          if (!memberRows || memberRows.length === 0) return;
          const recipientIds = memberRows.map((r) => r.profile_id);
          const senderName   = profile?.name || 'Someone';
          sendPush(
            recipientIds,
            chatName || 'New message',
            `${senderName}: Voice message`.slice(0, 50),
            { type: 'chat_message', chatId },
          );
        });
      setReplyTo(null);
    } finally {
      setUploading(false);
    }
  }

  async function cancelRecording() {
    clearInterval(recTimer.current);
    if (isRecording) { await recorder.stop().catch(() => {}); }
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    setIsRecording(false);
    setRecDuration(0);
  }

  // ── Reactions ─────────────────────────────────────────────────────────────
  async function handleReact(message, emoji) {
    const existing = (message.reactions || []).find((r) => r.profile_id === myId);
    if (existing) {
      if (existing.emoji === emoji) {
        // Remove
        await supabase.from('message_reactions').delete().eq('id', existing.id);
      } else {
        // Replace
        await supabase.from('message_reactions').update({ emoji }).eq('id', existing.id);
      }
    } else {
      await supabase.from('message_reactions').insert({
        message_id: message.id,
        profile_id: myId,
        school_id:  profile.school_id,
        emoji,
      });
    }
  }

  // ── Copy / Edit / Delete ──────────────────────────────────────────────────
  function handleCopy(message) {
    Clipboard.setStringAsync(message.content || '');
  }


  function handleEdit(message) {
    setEditMsg(message);
    setText(message.content);
  }

  async function handleDelete(message) {
    Alert.alert('Delete message', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          // Optimistic update — mark deleted locally immediately
          setMessages((prev) =>
            prev.map((m) =>
              m.id === message.id
                ? { ...m, is_deleted: true, content: '' }
                : m
            )
          );
          const { error: delErr } = await supabase
            .from('chat_messages')
            .update({ is_deleted: true, content: '' })
            .eq('id', message.id);
          if (delErr) {
            // Rollback optimistic update
            setMessages((prev) =>
              prev.map((m) =>
                m.id === message.id
                  ? { ...m, is_deleted: false, content: message.content }
                  : m
              )
            );
            Alert.alert('Delete failed', delErr.message);
          }
        },
      },
    ]);
  }

  // ── Build flat list data with date dividers ───────────────────────────────
  // Messages are newest-first; inverted FlatList renders index-0 at the bottom.
  // We collect unique date strings first, then insert one divider per day
  // (after the oldest message of that day in array order = renders above group).
  const listData = (() => {
    const result = [];
    // First pass: find the index of the last (oldest) message per date group
    const lastIndexForDate = {};
    messages.forEach((m, i) => {
      const d = new Date(m.created_at).toDateString();
      lastIndexForDate[d] = i; // keeps overwriting — ends up with highest index (oldest)
    });
    messages.forEach((m, i) => {
      const d = new Date(m.created_at).toDateString();
      result.push({ ...m, _type: 'msg', key: m.id });
      if (lastIndexForDate[d] === i) {
        result.push({ _type: 'date', key: `date-${d}`, date: m.created_at });
      }
    });
    return result;
  })();

  // ── Render item ───────────────────────────────────────────────────────────
  // Fetch any reactor profiles not yet in the members map, then open the sheet
  const openReactionDetail = useCallback(async (allReactions) => {
    const missingIds = allReactions
      .map((r) => r.profile_id)
      .filter((id) => id && !membersRef.current[id]);
    if (missingIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', missingIds);
      if (data && data.length > 0) {
        setMembers((prev) => {
          const next = { ...prev };
          data.forEach((p) => { next[p.id] = p; });
          return next;
        });
      }
    }
    setReactionDetail(allReactions);
  }, []);

  // Stable callbacks — defined once, never re-created
  const onLongPressStable  = useCallback((msg) => { setCtxMsg(msg); setCtxVisible(true); }, []);
  const onImagePressStable = useCallback((msg) => setPreviewMsg(msg), []);

  // renderItem reads membersRef.current so it never needs members in its deps
  const renderItem = useCallback(({ item }) => {
    if (item._type === 'date') {
      return <DateDivider date={item.date} />;
    }
    const m   = membersRef.current;
    const sender          = m[item.sender_id];
    const replySenderName = item.reply_msg ? (m[item.reply_msg.sender_id]?.name || '') : '';
    return (
      <MessageBubbleMemo
        item={item}
        myId={myId}
        sender={sender}
        replySenderName={replySenderName}
        onLongPress={onLongPressStable}
        onBadgePress={openReactionDetail}
        onImagePress={onImagePressStable}
      />
    );
  }, [myId, onLongPressStable, onImagePressStable]);

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <View style={[S.screen, { paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={[S.header, { paddingTop: insets.top + hp(1) }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={S.backBtn}>
          <Ionicons name="arrow-back" size={hp(2.6)} color={Colors.ink} />
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: wp(2.5) }}
          activeOpacity={0.7}
          onPress={() => router.push({ pathname: '/screens/chat/chatInfo', params: { chatId, chatName } })}
        >
          {/* Group avatar */}
          {groupImageUri ? (
            <Image
              source={{ uri: groupImageUri }}
              style={S.headerAvatar}
              contentFit="cover"
              transition={150}
              cachePolicy="disk"
            />
          ) : (
            <View style={S.headerAvatarFallback}>
              <Text style={S.headerAvatarInitials}>
                {(chatName || 'G').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={S.headerTitle} numberOfLines={1}>{chatName || 'Group Chat'}</Text>
            <Text style={S.headerSub}>
              {memberCount != null ? `${memberCount} members` : `${Object.keys(members).length} members`}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/screens/chat/chatInfo', params: { chatId, chatName } })}
          hitSlop={8}
        >
          <Ionicons name="information-circle-outline" size={hp(3)} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? hp(1) : 0}
      >
        {loading ? (
          <View style={S.center}>
            <ActivityIndicator color={Colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            data={listData}
            keyExtractor={(item) => item.key || item.id}
            renderItem={renderItem}
            contentContainerStyle={S.listPad}
            showsVerticalScrollIndicator={false}
            inverted
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loadingMore ? (
                <View style={{ alignItems: 'center', paddingVertical: hp(1.5) }}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              ) : hasMore ? (
                <TouchableOpacity style={S.loadMoreBtn} onPress={loadMore}>
                  <Text style={S.loadMoreText}>Load older messages</Text>
                </TouchableOpacity>
              ) : null
            }
          />
        )}

        {/* Input area — always shown; send controls gated by canSend */}
        <View style={[S.inputArea, { paddingBottom: Platform.OS === 'ios' ? 0 : hp(1) }]}>
          {/* Recording bar — visible to sender only */}
          {canSend && isRecording ? (
            <RecordingBar
              duration={recDuration}
              onStop={stopRecording}
              onCancel={cancelRecording}
            />
          ) : (
            <>

              {canSend && (
                <>
                  {/* Attachment preview bar — shown when image/doc picked but not sent yet */}
                  {pendingAttachment && (
                    <AttachmentPreviewBar
                      attachment={pendingAttachment}
                      onSend={sendPendingAttachment}
                      onCancel={() => setPendingAttachment(null)}
                      uploading={uploading}
                    />
                  )}

                  {/* Reply / Edit bar */}
                  {replyTo && !editMsg && (
                    <ReplyPreview
                      message={replyTo}
                      senderName={members[replyTo.sender_id]?.name || 'Unknown'}
                      onCancel={() => setReplyTo(null)}
                    />
                  )}
                  {editMsg && (
                    <View style={S.editBar}>
                      <Ionicons name="create-outline" size={hp(2)} color={Colors.primary} />
                      <Text style={S.editBarText}>Editing message</Text>
                      <TouchableOpacity onPress={() => { setEditMsg(null); setText(''); }} hitSlop={8}>
                        <Ionicons name="close" size={hp(2.2)} color={Colors.muted} />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={S.inputRow}>
                    {/* Attach */}
                    <TouchableOpacity onPress={pickImage} style={S.inputAction} disabled={uploading} hitSlop={4}>
                      <Ionicons name="image-outline" size={hp(2.6)} color={uploading ? Colors.muted : Colors.soft} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={pickDocument} style={S.inputAction} disabled={uploading} hitSlop={4}>
                      <Ionicons name="attach-outline" size={hp(2.6)} color={uploading ? Colors.muted : Colors.soft} />
                    </TouchableOpacity>

                    <TextInput
                      style={S.inputField}
                      placeholder={editMsg ? 'Edit message…' : 'Message…'}
                      placeholderTextColor={Colors.muted}
                      value={text}
                      onChangeText={setText}
                      multiline
                      maxLength={4000}
                    />

                    {/* Send or Voice */}
                    {text.trim() ? (
                      <TouchableOpacity
                        onPress={handleSend}
                        style={[S.sendBtn, sending && { opacity: 0.5 }]}
                        disabled={sending || uploading}
                        activeOpacity={0.8}
                      >
                        {sending
                          ? <ActivityIndicator size="small" color={Colors.white} />
                          : <Ionicons name="send" size={hp(2.2)} color={Colors.white} />
                        }
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={startRecording}
                        style={S.voiceBtn}
                        disabled={uploading}
                        activeOpacity={0.8}
                      >
                        {uploading
                          ? <ActivityIndicator size="small" color={Colors.primary} />
                          : <Ionicons name="mic-outline" size={hp(2.6)} color={Colors.primary} />
                        }
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Context menu */}
      <ContextMenu
        visible={ctxVisible}
        message={ctxMsg}
        myId={myId}
        canSend={canSend}
        onClose={() => setCtxVisible(false)}
        onCopy={handleCopy}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onReply={(m) => { setReplyTo(m); setEditMsg(null); }}
        onReact={handleReact}
      />

      {/* Reaction detail */}
      <ReactionDetailModal
        visible={!!reactionDetail}
        reactors={reactionDetail}
        members={members}
        onClose={() => setReactionDetail(null)}
      />

      {/* Attachment preview */}
      <AttachmentPreview
        visible={!!previewMsg}
        message={previewMsg}
        onClose={() => setPreviewMsg(null)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: Colors.canvas },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: wp(3),
    paddingHorizontal: wp(4), paddingBottom: hp(1.4),
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  backBtn:    { padding: 4 },
  headerTitle: { fontSize: hp(1.9), fontFamily: Fonts.semiBold, color: Colors.ink, letterSpacing: -0.3 },
  headerSub:   { fontSize: hp(1.3), fontFamily: Fonts.regular, color: Colors.muted, marginTop: 1 },
  headerAvatar: {
    width: hp(4.4), height: hp(4.4), borderRadius: hp(2.2), flexShrink: 0,
  },
  headerAvatarFallback: {
    width: hp(4.4), height: hp(4.4), borderRadius: hp(2.2), flexShrink: 0,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  headerAvatarInitials: {
    fontSize: hp(1.8), fontFamily: Fonts.bold, color: Colors.primary,
  },

  listPad: { paddingHorizontal: wp(3), paddingVertical: hp(1.5), gap: hp(0.4) },

  loadMoreBtn: { alignItems: 'center', paddingVertical: hp(1.2) },
  loadMoreText: { fontSize: hp(1.45), color: Colors.primary, fontFamily: Fonts.medium },

  // Bubbles
  bubbleRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: wp(2), marginVertical: hp(0.3) },
  bubbleRowLeft:  { justifyContent: 'flex-start' },
  bubbleRowRight: { justifyContent: 'flex-end' },

  bubble: {
    borderRadius: 16, paddingHorizontal: wp(3.5), paddingVertical: hp(0.9),
    maxWidth: '100%',
  },
  bubbleMine:    { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleOther:   { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderLight, borderBottomLeftRadius: 4 },
  bubbleDeleted: { backgroundColor: Colors.borderLight, borderRadius: 12 },
  deletedText:   { fontSize: hp(1.5), color: Colors.muted, fontFamily: Fonts.regular, fontStyle: 'italic' },

  senderName: { fontSize: hp(1.3), fontFamily: Fonts.semiBold, color: Colors.primary, marginBottom: 2, marginLeft: 4 },

  bubbleText:     { fontSize: hp(1.7), fontFamily: Fonts.regular, color: Colors.ink, lineHeight: hp(2.5) },
  bubbleTextMine: { color: Colors.white },

  bubbleMeta:   { flexDirection: 'row', alignItems: 'center', marginTop: hp(0.4) },
  editedLabel:  { fontSize: hp(1.1), color: Colors.muted, fontFamily: Fonts.regular },
  timeLabel:    { fontSize: hp(1.1), color: Colors.muted, fontFamily: Fonts.regular },

  // Reply quote inside bubble
  quoteWrap:  { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 8, padding: 6, marginBottom: 6, gap: 6, overflow: 'hidden' },
  quoteAccent:{ width: 3, borderRadius: 2, backgroundColor: Colors.primary },
  quoteName:  { fontSize: hp(1.2), fontFamily: Fonts.semiBold, color: Colors.primary },
  quoteText:  { fontSize: hp(1.4), fontFamily: Fonts.regular, color: Colors.soft },

  // Image
  imageThumb: { width: wp(55), height: wp(55), borderRadius: 12 },

  // Document
  docCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 10, padding: 10, minWidth: wp(50),
  },
  docIconWrap: { width: hp(4.5), height: hp(4.5), borderRadius: 10, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  docName:     { fontSize: hp(1.5), fontFamily: Fonts.semiBold, color: Colors.ink, flexShrink: 1 },
  docSize:     { fontSize: hp(1.25), fontFamily: Fonts.regular, color: Colors.muted },

  // Voice
  voiceWrap:     { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: wp(45) },
  voicePlayBtn:  { width: hp(4), height: hp(4), borderRadius: hp(2), backgroundColor: 'rgba(0,0,0,0.1)', alignItems: 'center', justifyContent: 'center' },
  voiceTrack:    { flex: 1, height: 4, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 2, overflow: 'hidden' },
  voiceProgress: { height: 4, borderRadius: 2 },
  voiceDuration: { fontSize: hp(1.3), fontFamily: Fonts.medium, color: Colors.muted, minWidth: 36 },

  // Reactions — combined WhatsApp-style badge
  reactionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderLight,
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, marginTop: 4,
  },
  reactionBadgeMine: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  reactionEmoji: { fontSize: hp(1.7) },
  reactionCount: { fontSize: hp(1.3), fontFamily: Fonts.semiBold, color: Colors.soft },


  // Date divider
  dateDivider:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: hp(1.5) },
  dateDividerLine: { flex: 1, height: 1, backgroundColor: Colors.borderLight },
  dateDividerText: { fontSize: hp(1.3), fontFamily: Fonts.medium, color: Colors.muted },

  // Input area
  inputArea: {
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  replyBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: wp(4), paddingTop: hp(1), paddingBottom: 0,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
    backgroundColor: Colors.canvas,
  },
  replyBarAccent: { width: 3, height: '100%', borderRadius: 2, backgroundColor: Colors.primary },
  replyBarName:   { fontSize: hp(1.3), fontFamily: Fonts.semiBold, color: Colors.primary },
  replyBarText:   { fontSize: hp(1.45), fontFamily: Fonts.regular, color: Colors.soft },

  editBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: wp(4), paddingVertical: hp(0.8),
    backgroundColor: Colors.primaryLight,
  },
  editBarText: { flex: 1, fontSize: hp(1.4), fontFamily: Fonts.medium, color: Colors.primary },

  // Attachment preview bar
  attachBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: wp(4), paddingVertical: hp(1),
    backgroundColor: Colors.canvas,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
    gap: wp(3),
  },
  attachBarLeft: { flexDirection: 'row', alignItems: 'center', gap: wp(3), flex: 1 },
  attachThumb:   { width: hp(6), height: hp(6), borderRadius: 10 },
  attachDocIcon: {
    width: hp(6), height: hp(6), borderRadius: 10,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  attachFileName: { fontSize: hp(1.6), fontFamily: Fonts.semiBold, color: Colors.ink },
  attachFileSize: { fontSize: hp(1.3), fontFamily: Fonts.regular, color: Colors.muted, marginTop: 2 },
  attachBarActions: { flexDirection: 'row', alignItems: 'center', gap: wp(2) },
  attachCancelBtn:  { width: hp(4), height: hp(4), borderRadius: hp(2), backgroundColor: Colors.dangerLight, alignItems: 'center', justifyContent: 'center' },
  attachSendBtn:    { width: hp(4.8), height: hp(4.8), borderRadius: hp(2.4), backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: wp(2),
    paddingHorizontal: wp(3), paddingVertical: hp(1),
  },
  inputAction: { padding: 4, marginBottom: 4 },
  inputField: {
    flex: 1, backgroundColor: Colors.canvas, borderRadius: 22,
    paddingHorizontal: wp(4), paddingVertical: hp(1),
    fontSize: hp(1.7), fontFamily: Fonts.regular, color: Colors.ink,
    maxHeight: hp(14),
  },
  sendBtn: {
    width: hp(4.8), height: hp(4.8), borderRadius: hp(2.4),
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  voiceBtn: {
    width: hp(4.8), height: hp(4.8), borderRadius: hp(2.4),
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },

  // Recording bar
  recordingBar: {
    flexDirection: 'row', alignItems: 'center', gap: wp(3),
    paddingHorizontal: wp(4), paddingVertical: hp(1.2),
  },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.danger },
  recordingTime: { fontSize: hp(1.7), fontFamily: Fonts.semiBold, color: Colors.danger },
  recordingStopBtn: {
    width: hp(4.8), height: hp(4.8), borderRadius: hp(2.4),
    backgroundColor: Colors.danger, alignItems: 'center', justifyContent: 'center',
  },

  // Context menu
  ctxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  ctxMenu: {
    backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: hp(4), paddingTop: hp(1.5),
  },
  ctxEmojiRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingHorizontal: wp(4), paddingVertical: hp(1.2),
  },
  ctxEmojiBtn: { padding: 4 },
  ctxEmoji:    { fontSize: hp(3.2) },
  ctxDivider:  { height: 1, backgroundColor: Colors.borderLight, marginVertical: hp(0.8) },
  ctxItem:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: wp(6), paddingVertical: hp(1.4) },
  ctxLabel:    { fontSize: hp(1.8), fontFamily: Fonts.medium, color: Colors.ink },

  // Reaction detail sheet
  reactionDetailSheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: hp(4), paddingTop: hp(1.5), maxHeight: hp(60),
  },
  reactionDetailHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.borderLight, alignSelf: 'center', marginBottom: hp(1.5) },
  reactionDetailTitle:  { fontSize: hp(1.9), fontFamily: Fonts.semiBold, color: Colors.ink, paddingHorizontal: wp(5), marginBottom: hp(1) },
  reactionDetailRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: wp(5), paddingVertical: hp(1.2) },
  reactionDetailName:   { fontSize: hp(1.7), fontFamily: Fonts.medium, color: Colors.ink },

  // Preview
  previewContainer: { flex: 1, backgroundColor: '#111' },
  previewHeader: {
    flexDirection: 'row', alignItems: 'center', gap: wp(3),
    paddingHorizontal: wp(4), paddingVertical: hp(1.5),
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  previewHeaderBtn:    { padding: 4 },
  previewTitle:        { flex: 1, fontSize: hp(1.8), fontFamily: Fonts.semiBold, color: Colors.white },
  previewDocName:      { fontSize: hp(2), fontFamily: Fonts.semiBold, color: Colors.ink, textAlign: 'center' },
  previewDocSize:      { fontSize: hp(1.5), fontFamily: Fonts.regular, color: Colors.muted },
  previewDownloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: wp(6), paddingVertical: hp(1.6), marginTop: hp(1),
  },
  previewDownloadText: { fontSize: hp(1.7), fontFamily: Fonts.semiBold, color: Colors.white },
});
