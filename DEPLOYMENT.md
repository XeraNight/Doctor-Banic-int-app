# 🚀 Deployment Guide - User Management Features

## Prerequisites

✅ Database migration completed (main schema)  
✅ Admin account created in Supabase Auth  
✅ `.env` file configured with Supabase credentials

---

## Step 1: Deploy Database Policies

Open Supabase SQL Editor and run:

**File**: `supabase/migrations/20251230113004_add_user_management_policies.sql`

This adds RLS policies allowing admins and doctors to update profiles and roles.

**Verify**: Query should execute without errors and show "Success" message.

---

## Step 2: Deploy Edge Function

### Option A: Using Supabase CLI (Recommended)

```bash
# Make sure you're logged in
supabase login

# Link to your project
supabase link --project-ref ihlmbwydwknusmkzfddn

# Deploy the function
supabase functions deploy manage-users
```

### Option B: Manual Deployment via Dashboard

1. Go to Supabase Dashboard → Edge Functions
2. Click "Create Function" or select existing `manage-users`
3. Copy entire contents of `supabase/functions/manage-users/index.ts`
4. Paste into editor and deploy

---

## Step 3: Test the Application

### 3.1 Restart Dev Server

```bash
# Stop current server (Ctrl+C if running)
npm run dev
```

### 3.2 Login as Admin

- URL: http://localhost:8080/auth
- Email: `jakubkalina05@gmail.com`
- Password: `EDITHironman1#`

### 3.3 Navigate to Settings

Click your profile → Settings (or navigate to `/settings`)

---

## Step 4: Quick Verification

### Personal Account Section
- [ ] See "Personal Account" card
- [ ] Current email displayed
- [ ] Can enter new email
- [ ] Can enter new password

### User Management Section (Admin/Doctor only)
- [ ] See "User Management" heading
- [ ] See list of users
- [ ] See "Add User" button
- [ ] Can click "Edit" on a user

---

## Troubleshooting

### Edge Function Error: "Insufficient permissions"
**Cause**: RLS policies not applied  
**Fix**: Re-run Step 1 migration

### "User cannot be found" when editing
**Cause**: Edge function not deployed  
**Fix**: Re-run Step 2

### TypeScript errors in IDE
**Cause**: Type mismatch  
**Fix**: Restart TypeScript server (in VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server")

### Email change not working
**Cause**: Email verification required  
**Note**: This is expected - check the new email inbox for verification link

---

## Production Deployment

When deploying to production:

1. **Update environment variables** in hosting platform
2. **Run migrations** on production database
3. **Deploy edge function** to production Supabase project
4. **Test thoroughly** with test accounts first
5. **Monitor logs** for any errors

---

## Security Checklist

Before going live, verify:

- [ ] Admin role cannot be assigned via UI
- [ ] Users cannot change their own role
- [ ] Doctors cannot modify admin/doctor accounts
- [ ] Password minimum length enforced (6 chars)
- [ ] Email changes require verification
- [ ] RLS policies active on all tables
- [ ] Edge function uses service role key

---

## Support

If you encounter issues:

1. Check browser console for errors
2. Check Supabase logs (Dashboard → Logs)
3. Check edge function logs (Dashboard → Edge Functions → manage-users → Logs)
4. Verify database policies are active (Dashboard → Table Editor → Select table → Policies)

---

**Estimated deployment time**: 5-10 minutes

Good luck! 🎉
