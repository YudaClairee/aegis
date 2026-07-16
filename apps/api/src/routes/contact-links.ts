import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { supabase } from '../services/supabase';
import { authMiddleware, AuthVariables } from '../middleware/auth';
import { assertOwnContact } from '../services/contact-access';
import type { EmergencyContact } from '@aegis/shared';

// Helper to map DB row to EmergencyContact type
function mapContactRow(row: any): EmergencyContact {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    phone: row.phone,
    relationship: row.relationship || null,
    isPrimary: row.is_primary || false,
    fcmToken: row.fcm_token || null,
    createdAt: row.created_at,
  };
}

// Function to generate an 8-character uppercase alphanumeric code
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const contactLinksRouter = new Hono<{ Variables: AuthVariables }>();

// All routes require authentication
contactLinksRouter.use('*', authMiddleware);

// 1. POST /:contactId/invite - Generate/regenerate invite code for a contact
contactLinksRouter.post('/:contactId/invite', async (c) => {
  const userId = c.get('userId');
  const contactId = c.req.param('contactId');

  // Verify the user owns the contact
  await assertOwnContact(userId, contactId);

  // Generate a unique invite code
  let inviteCode = '';
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 5) {
    inviteCode = generateInviteCode();
    const { data } = await supabase
      .from('emergency_contacts')
      .select('id')
      .eq('invite_code', inviteCode)
      .maybeSingle();

    if (!data) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new HTTPException(500, { message: 'Failed to generate unique invite code. Please try again.' });
  }

  const { data, error } = await supabase
    .from('emergency_contacts')
    .update({
      invite_code: inviteCode,
      invite_status: 'pending',
      linked_user_id: null,
      accepted_at: null,
    })
    .eq('id', contactId)
    .select()
    .single();

  if (error || !data) {
    throw new HTTPException(500, { message: error?.message || 'Failed to update contact with invite code' });
  }

  return c.json({
    inviteCode,
    contact: mapContactRow(data),
  });
});

// 2. POST /accept - Family accepts an invite code
contactLinksRouter.post('/accept', async (c) => {
  const familyUserId = c.get('userId');
  const { inviteCode } = await c.req.json();

  if (!inviteCode || typeof inviteCode !== 'string') {
    throw new HTTPException(400, { message: 'Invite code is required' });
  }

  // Find the pending contact with this invite code
  const { data: contact, error: findErr } = await supabase
    .from('emergency_contacts')
    .select('*')
    .eq('invite_code', inviteCode.trim().toUpperCase())
    .eq('invite_status', 'pending')
    .maybeSingle();

  if (findErr || !contact) {
    throw new HTTPException(400, { message: 'Invalid or expired invite code' });
  }

  // Security rule: cannot accept own invite code
  if (contact.user_id === familyUserId) {
    throw new HTTPException(400, { message: 'You cannot accept your own emergency contact invite' });
  }

  // Update contact to accepted state
  const now = new Date().toISOString();
  const { data: updatedContact, error: updateErr } = await supabase
    .from('emergency_contacts')
    .update({
      linked_user_id: familyUserId,
      invite_status: 'accepted',
      accepted_at: now,
    })
    .eq('id', contact.id)
    .select()
    .single();

  if (updateErr || !updatedContact) {
    throw new HTTPException(500, { message: updateErr?.message || 'Failed to link account' });
  }

  // Get the victim's profile detail
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', contact.user_id)
    .single();

  const victimName = profileErr || !profile ? 'User' : profile.full_name;

  return c.json({
    contact: mapContactRow(updatedContact),
    linkedTo: {
      userId: contact.user_id,
      fullName: victimName,
    },
  });
});

// 3. GET /me - List relations where the user is the linked family member
contactLinksRouter.get('/me', async (c) => {
  const userId = c.get('userId');

  const { data: contacts, error } = await supabase
    .from('emergency_contacts')
    .select('*')
    .eq('linked_user_id', userId)
    .eq('invite_status', 'accepted')
    .order('accepted_at', { ascending: false });

  if (error) {
    throw new HTTPException(500, { message: error.message });
  }

  if (!contacts || contacts.length === 0) {
    return c.json({ links: [] });
  }

  // Query profiles in batch to resolve victim information
  const victimIds = contacts.map((c) => c.user_id);
  const { data: profiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', victimIds);

  if (profilesErr) {
    throw new HTTPException(500, { message: profilesErr.message });
  }

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

  const links = contacts.map((contact) => {
    const profile = profileMap.get(contact.user_id);
    return {
      id: contact.id,
      name: contact.name,
      relationship: contact.relationship,
      inviteStatus: contact.invite_status,
      acceptedAt: contact.accepted_at,
      victim: profile
        ? {
            id: profile.id,
            fullName: profile.full_name,
            phone: profile.phone || null,
          }
        : null,
    };
  });

  return c.json({ links });
});

// 4. DELETE /:contactId - Revoke a contact link (can be done by either owner or linked family user)
contactLinksRouter.delete('/:contactId', async (c) => {
  const userId = c.get('userId');
  const contactId = c.req.param('contactId');

  // Verify the contact exists
  const { data: contact, error: findErr } = await supabase
    .from('emergency_contacts')
    .select('*')
    .eq('id', contactId)
    .maybeSingle();

  if (findErr || !contact) {
    throw new HTTPException(404, { message: 'Contact link not found' });
  }

  // Verify authorization (must be either the victim or the linked family user)
  if (contact.user_id !== userId && contact.linked_user_id !== userId) {
    throw new HTTPException(403, { message: 'Forbidden: You do not have permission to revoke this link' });
  }

  // Reset the family link columns back to default/null
  const { error: updateErr } = await supabase
    .from('emergency_contacts')
    .update({
      linked_user_id: null,
      invite_code: null,
      invite_status: 'pending',
      accepted_at: null,
    })
    .eq('id', contactId);

  if (updateErr) {
    throw new HTTPException(500, { message: updateErr.message });
  }

  return c.json({ success: true, message: 'Contact link revoked successfully' });
});

export { contactLinksRouter };
