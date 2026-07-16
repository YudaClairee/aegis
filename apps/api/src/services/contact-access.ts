import { HTTPException } from 'hono/http-exception';
import { supabase } from './supabase';

/**
 * Asserts that the emergency contact exists and belongs to the given user.
 * Throws 404 if the contact is not found, and 403 if it belongs to another user.
 */
export async function assertOwnContact(userId: string, contactId: string) {
  const { data, error } = await supabase
    .from('emergency_contacts')
    .select('*')
    .eq('id', contactId)
    .single();

  if (error || !data) {
    throw new HTTPException(404, { message: 'Contact not found' });
  }

  if (data.user_id !== userId) {
    throw new HTTPException(403, { message: 'Forbidden: You do not own this contact' });
  }

  return data;
}

/**
 * Asserts that the incident exists and is owned by the given user.
 * Throws 404 if the incident is not found, and 403 if it is owned by another user.
 */
export async function assertIsIncidentOwner(userId: string, incidentId: string) {
  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .eq('id', incidentId)
    .single();

  if (error || !data) {
    throw new HTTPException(404, { message: 'Incident not found' });
  }

  if (data.user_id !== userId) {
    throw new HTTPException(403, { message: 'Forbidden: You are not the owner of this incident' });
  }

  return data;
}

/**
 * Asserts that the user is a linked family member with accepted status for the given incident's owner.
 * Throws 404 if the incident is not found, and 403 if the user is not linked.
 */
export async function assertIsLinkedFamilyForIncident(userId: string, incidentId: string) {
  const { data: incident, error: incidentErr } = await supabase
    .from('incidents')
    .select('user_id')
    .eq('id', incidentId)
    .single();

  if (incidentErr || !incident) {
    throw new HTTPException(404, { message: 'Incident not found' });
  }

  const victimId = incident.user_id;

  const { data: contact, error: contactErr } = await supabase
    .from('emergency_contacts')
    .select('*')
    .eq('user_id', victimId)
    .eq('linked_user_id', userId)
    .eq('invite_status', 'accepted')
    .maybeSingle();

  if (contactErr || !contact) {
    throw new HTTPException(403, { message: 'Forbidden: You are not a linked family member for this incident' });
  }

  return contact;
}

/**
 * Asserts that the user can access the incident (either as the owner or as a linked family member).
 * Throws 404 if the incident does not exist, and 403 if access is denied.
 */
export async function assertCanAccessIncident(userId: string, incidentId: string) {
  try {
    return await assertIsIncidentOwner(userId, incidentId);
  } catch (err: any) {
    if (err instanceof HTTPException && err.status === 404) {
      throw err;
    }

    try {
      return await assertIsLinkedFamilyForIncident(userId, incidentId);
    } catch (familyErr) {
      throw new HTTPException(403, { message: 'Forbidden: You do not have access to this incident' });
    }
  }
}
