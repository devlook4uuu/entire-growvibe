# 19 — Profile Feature

## What Was Built

A personal profile page for every role — available on both web and app. Users can view their own profile, edit personal fields (bio, date of birth, social links, interests), and upload an avatar photo. Logout is also handled from this screen.

---

## Editable Fields

| Field | Validation |
|-------|-----------|
| `bio` | Max 300 characters |
| `date_of_birth` | Date string |
| `facebook_url` | Valid URL (must include https://) |
| `instagram_url` | Valid URL (must include https://) |
| `interests` | Free text |
| `avatar_url` | Uploaded to Supabase Storage `avatars` bucket |

Read-only fields displayed (not editable):
- `name`, `email`, `phone`, `role`, `school_id`, `branch_id`, `class_id`, `grow_coins`

---

## Database

Profile data lives in the `profiles` table. Avatar images stored in Supabase Storage.

### `20260425110000_storage_avatars_bucket_and_policies.sql`
- Storage bucket: `avatars` — public read, authenticated write
- RLS policies: users can upload/update/delete their own avatar (`owner = auth.uid()`)

### `20260413000001_profiles_add_personal_fields.sql`
- Adds: `bio text`, `date_of_birth date`, `facebook_url text`, `instagram_url text`, `interests text`

---

## Web — `ProfilePage.jsx`

Route: `/profile` — all roles

- Two-column layout on large screens (avatar + info left, edit form right); single column on mobile
- Role badge with color from `ROLE_CONFIG` map
- Avatar: image if `avatar_url` set, else initials circle
- Edit mode toggle: "Edit Profile" button → shows Formik form inline
- Formik + Yup validation: `EditSchema`
- On save: dispatches `updateProfileThunk` → updates `profiles` row via Supabase, updates Redux state
- `formatDate(iso)` helper for displaying date_of_birth as "April 12, 2000"
- Social links rendered as clickable `<a>` tags (open in new tab)
- Interests rendered as a comma-split chip list

---

## App — `app/(tabs)/profile.jsx`

Tab: Profile (bottom tab, all roles)

- Same data fields as web
- Avatar upload via `expo-image-picker` (camera roll) → `uploadImage()` helper → `storageUpload.js`
- `CachedAvatar` component for optimistic image display from cache
- Date of birth picker: `@react-native-community/datetimepicker` (iOS: inline wheel, Android: dialog)
- Formik + Yup: same `EditSchema` as web
- On save: dispatches `updateProfileThunk`
- Logout button at bottom → dispatches `logoutThunk` → Supabase signOut + clears Redux
- Interests rendered as comma-split chips

### Avatar upload flow
1. `ImagePicker.launchImageLibraryAsync({ mediaTypes: 'Images', allowsEditing: true, aspect: [1,1] })`
2. `uploadImage(uri, 'avatars', profile.id)` → uploads to `avatars/{userId}` path in Storage
3. Public URL stored in `profiles.avatar_url`
4. Redux profile updated optimistically

---

## Shared Redux — `updateProfileThunk`

In `authSlice.js` (both web and app):
```js
export const updateProfileThunk = createAsyncThunk('auth/updateProfile', async (updates, { getState }) => {
  const { profile } = getState().auth;
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', profile.id)
    .select()
    .single();
  if (error) throw error;
  return data;
});
```
`fulfilled` handler: `state.profile = action.payload`

---

## Key Decisions

1. **Read-only name/email/role** — these are managed by admins via the create-user/update-credentials flow. Self-edit of identity fields is not allowed.
2. **`grow_coins` displayed but not editable** — shown for motivation (students see their coin balance). Only the DB cron and `submit_growtask` RPC can change it.
3. **Avatar stored in Supabase Storage, URL in profiles** — avoids base64 in DB. CDN-served public URL in `avatar_url`.
4. **Logout from profile screen** — natural UX placement. Calls `logoutThunk` which signs out from Supabase and clears Redux session + profile.

---

## Gotchas

- `facebook_url` and `instagram_url` must include `https://` — Yup's `.url()` validator requires the protocol. Users must enter full URLs.
- On iOS, `DateTimePicker` renders inline (always visible when editing DOB). On Android it renders as a modal dialog. The `display` prop must be set accordingly: `display={Platform.OS === 'ios' ? 'inline' : 'default'}`.
- `uploadImage` helper lives in `helpers/storageUpload.js` — it handles the Supabase Storage upload and returns the public URL. If the bucket policies are missing, uploads silently fail.
- `CachedAvatar` uses `expo-image` with `cachePolicy="disk"` — avatars are cached on-device. After updating an avatar, the URL must change (or include a cache-bust param) for the new image to appear immediately.
