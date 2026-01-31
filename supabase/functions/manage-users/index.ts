// @ts-nocheck
/// <reference types="https://esm.sh/@supabase/supabase-js@2/dist/module/index.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  action: string;
  [key: string]: any;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user is authenticated
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Get caller's role
    const { data: callerRoleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || !callerRoleData) {
      throw new Error('Unable to determine user role')
    }

    const callerRole = callerRoleData.role as string

    // Only admin and doctor can manage users
    if (callerRole !== 'admin' && callerRole !== 'doctor') {
      throw new Error('Insufficient permissions')
    }

    // Parse request body
    const body = await req.json() as RequestBody
    const { action, ...params } = body

    // Handle different actions
    switch (action) {
      case 'create':
        return await handleCreateUser(supabaseAdmin, params, callerRole)

      case 'update':
        return await handleUpdateUser(supabaseAdmin, params, callerRole, user.id)

      case 'delete':
        return await handleDeleteUser(supabaseAdmin, params, callerRole)

      default:
        throw new Error(`Unknown action: ${action}`)
    }

  } catch (error) {
    let errorMessage = 'Unknown error'
    if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === 'object' && error !== null && 'message' in error) {
      errorMessage = (error as any).message
    } else if (typeof error === 'string') {
      errorMessage = error
    } else {
      errorMessage = JSON.stringify(error)
    }
    console.error('Error:', errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function handleCreateUser(supabaseAdmin: any, params: any, callerRole: string) {
  const { email, password, fullName, phone, role } = params

  // Validate required fields
  if (!email || !password || !fullName || !role) {
    throw new Error('Missing required fields')
  }

  // Validate password
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters')
  }

  // Role restrictions
  if (callerRole === 'doctor' && role === 'admin') {
    throw new Error('Doctors cannot create admin accounts')
  }

  // Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: role,
      is_manual_creation: true
    }
  })

  if (authError) {
    throw new Error(`Failed to create user: ${authError.message}`)
  }

  const userId = authData.user.id

  try {
    // Delete any existing records from trigger (safeguard)
    await supabaseAdmin.from('user_roles').delete().eq('user_id', userId)
    await supabaseAdmin.from('profiles').delete().eq('id', userId)
    if (role === 'patient') {
      await supabaseAdmin.from('patients').delete().eq('user_id', userId)
    }

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        email,
        full_name: fullName,
        phone: phone || null
      })

    if (profileError) throw profileError

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role
      })

    if (roleError) throw roleError

    // If patient, create patient record
    if (role === 'patient') {
      const { error: patientError } = await supabaseAdmin
        .from('patients')
        .insert({
          user_id: userId,
          full_name: fullName,
          email,
          phone: phone || null
        })

      if (patientError) throw patientError
    }

    return new Response(
      JSON.stringify({ success: true, userId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    // Rollback: delete the auth user if profile/role creation failed
    await supabaseAdmin.auth.admin.deleteUser(userId)
    throw error
  }
}

async function handleUpdateUser(supabaseAdmin: any, params: any, callerRole: string, callerId: string) {
  const { userId, fullName, phone, newEmail, newPassword, newRole } = params

  if (!userId) {
    throw new Error('Missing userId')
  }

  // Prevent self-role change
  if (userId === callerId && newRole) {
    throw new Error('You cannot change your own role')
  }

  // Get target user's current role
  const { data: targetRoleData, error: targetRoleError } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()

  if (targetRoleError) {
    throw new Error('Target user not found')
  }

  const targetCurrentRole = targetRoleData.role as string

  // Permission checks
  if (callerRole === 'doctor') {
    // Doctors cannot modify admin accounts
    if (targetCurrentRole === 'admin') {
      throw new Error('Doctors cannot modify admin accounts')
    }
    // Doctors cannot assign admin roles
    if (newRole === 'admin') {
      throw new Error('Doctors cannot assign admin role')
    }
  }

  // Admin cannot change role to admin (security measure)
  if (newRole === 'admin') {
    throw new Error('Cannot assign admin role through this interface')
  }

  // Update profile
  if (fullName || phone !== undefined) {
    const updateData: any = {}
    if (fullName) updateData.full_name = fullName
    if (phone !== undefined) updateData.phone = phone || null

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', userId)

    if (profileError) throw profileError
  }

  // Update email if provided
  if (newEmail) {
    const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { email: newEmail }
    )

    if (emailError) {
      throw new Error(`Failed to update email: ${emailError.message}`)
    }

    // Also update in profiles table
    await supabaseAdmin
      .from('profiles')
      .update({ email: newEmail })
      .eq('id', userId)
  }

  // Update password if provided
  if (newPassword) {
    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters')
    }

    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (passwordError) {
      throw new Error(`Failed to update password: ${passwordError.message}`)
    }
  }

  // Update role if provided and different
  if (newRole && newRole !== targetCurrentRole) {
    // Delete old role
    const { error: deleteRoleError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)

    if (deleteRoleError) throw deleteRoleError

    // Insert new role
    const { error: insertRoleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: newRole
      })

    if (insertRoleError) throw insertRoleError

    // Handle patient record
    if (newRole === 'patient' && targetCurrentRole !== 'patient') {
      // Create patient record
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name, phone')
        .eq('id', userId)
        .single()

      if (profileData) {
        await supabaseAdmin
          .from('patients')
          .insert({
            user_id: userId,
            full_name: profileData.full_name,
            email: profileData.email,
            phone: profileData.phone
          })
      }
    }
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleDeleteUser(supabaseAdmin: any, params: any, callerRole: string) {
  const { userId } = params

  if (!userId) {
    throw new Error('Missing userId')
  }

  // Get target user's role
  const { data: targetRoleData, error: targetRoleError } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()

  if (targetRoleError) {
    throw new Error('Target user not found')
  }

  const targetRole = targetRoleData.role as string

  // Permission checks
  if (targetRole === 'admin') {
    throw new Error('Cannot delete admin accounts')
  }

  if (callerRole === 'doctor' && targetRole === 'admin') {
    throw new Error('Doctors cannot delete admin accounts')
  }

  // Delete user (cascades to profiles, user_roles, patients, etc.)
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

  if (deleteError) {
    throw new Error(`Failed to delete user: ${deleteError.message}`)
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
