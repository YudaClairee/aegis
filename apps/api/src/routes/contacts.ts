import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { supabase } from '../services/supabase';
import { authMiddleware, AuthVariables } from '../middleware/auth';
import { assertOwnContact } from '../services/contact-access';
import { CreateContactSchema, UpdateContactSchema } from '@aegis/shared';
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

const contactsRouter = new Hono<{ Variables: AuthVariables }>();

// All contacts routes require authentication
contactsRouter.use('*', authMiddleware);

// 1. GET / - List all emergency contacts for the user
contactsRouter.get('/', async (c) => {
  const userId = c.get('userId');

  const { data, error } = await supabase
    .from('emergency_contacts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new HTTPException(500, { message: error.message });
  }

  const contacts = (data || []).map(mapContactRow);
  return c.json({ contacts });
});

// 2. POST / - Add a new contact
contactsRouter.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const parseResult = CreateContactSchema.safeParse(body);
  if (!parseResult.success) {
    throw new HTTPException(400, { message: parseResult.error.message });
  }

  const validatedData = parseResult.data;

  // If setting as primary, reset other primary contacts first
  if (validatedData.isPrimary) {
    const { error: resetErr } = await supabase
      .from('emergency_contacts')
      .update({ is_primary: false })
      .eq('user_id', userId);

    if (resetErr) {
      throw new HTTPException(500, { message: 'Failed to reset existing primary contact' });
    }
  }

  const { data, error } = await supabase
    .from('emergency_contacts')
    .insert({
      user_id: userId,
      name: validatedData.name,
      phone: validatedData.phone,
      relationship: validatedData.relationship || null,
      is_primary: validatedData.isPrimary || false,
      invite_status: 'pending' // ensure default state
    })
    .select()
    .single();

  if (error || !data) {
    throw new HTTPException(500, { message: error?.message || 'Failed to create emergency contact' });
  }

  return c.json({ contact: mapContactRow(data) }, 201);
});

// 3. PUT /:id - Update an existing contact
contactsRouter.put('/:id', async (c) => {
  const userId = c.get('userId');
  const contactId = c.req.param('id');
  const body = await c.req.json();

  const parseResult = UpdateContactSchema.safeParse(body);
  if (!parseResult.success) {
    throw new HTTPException(400, { message: parseResult.error.message });
  }

  const validatedData = parseResult.data;

  // Ensure contact exists and belongs to user
  await assertOwnContact(userId, contactId);

  // If changing to primary, reset other primary contacts first
  if (validatedData.isPrimary) {
    const { error: resetErr } = await supabase
      .from('emergency_contacts')
      .update({ is_primary: false })
      .eq('user_id', userId);

    if (resetErr) {
      throw new HTTPException(500, { message: 'Failed to reset existing primary contact' });
    }
  }

  const updatePayload: any = {};
  if (validatedData.name !== undefined) updatePayload.name = validatedData.name;
  if (validatedData.phone !== undefined) updatePayload.phone = validatedData.phone;
  if (validatedData.relationship !== undefined) updatePayload.relationship = validatedData.relationship || null;
  if (validatedData.isPrimary !== undefined) updatePayload.is_primary = validatedData.isPrimary;

  const { data, error } = await supabase
    .from('emergency_contacts')
    .update(updatePayload)
    .eq('id', contactId)
    .select()
    .single();

  if (error || !data) {
    throw new HTTPException(500, { message: error?.message || 'Failed to update emergency contact' });
  }

  return c.json({ contact: mapContactRow(data) });
});

// 4. DELETE /:id - Delete a contact
contactsRouter.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const contactId = c.req.param('id');

  // Ensure contact exists and belongs to user
  await assertOwnContact(userId, contactId);

  const { error } = await supabase
    .from('emergency_contacts')
    .delete()
    .eq('id', contactId);

  if (error) {
    throw new HTTPException(500, { message: error.message });
  }

  return c.json({ success: true, message: 'Contact deleted successfully' });
});

// 5. PUT /:id/primary - Set a contact as primary
contactsRouter.put('/:id/primary', async (c) => {
  const userId = c.get('userId');
  const contactId = c.req.param('id');

  // Ensure contact exists and belongs to user
  await assertOwnContact(userId, contactId);

  // Reset all primary contacts for this user
  const { error: resetErr } = await supabase
    .from('emergency_contacts')
    .update({ is_primary: false })
    .eq('user_id', userId);

  if (resetErr) {
    throw new HTTPException(500, { message: 'Failed to reset existing primary contact' });
  }

  // Set the specific contact to primary
  const { data, error } = await supabase
    .from('emergency_contacts')
    .update({ is_primary: true })
    .eq('id', contactId)
    .select()
    .single();

  if (error || !data) {
    throw new HTTPException(500, { message: error?.message || 'Failed to set contact as primary' });
  }

  return c.json({ contact: mapContactRow(data) });
});

export { contactsRouter };
