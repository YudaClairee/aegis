import admin from 'firebase-admin';
import { env } from '../lib/env';
import { supabase } from './supabase';

// Initialize Firebase Admin SDK (once)
if (admin.apps.length === 0) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY,
      }),
    });
    console.log('🔥 Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error);
  }
}

/**
 * Fetches all unique device tokens for emergency contacts linked to the victim user
 * who have accepted the invitation.
 */
export async function fetchFamilyTokens(victimUserId: string): Promise<string[]> {
  try {
    // 1. Fetch all accepted emergency contacts for the victim
    const { data: contacts, error: contactsErr } = await supabase
      .from('emergency_contacts')
      .select('linked_user_id')
      .eq('user_id', victimUserId)
      .eq('invite_status', 'accepted')
      .not('linked_user_id', 'is', null);

    if (contactsErr || !contacts || contacts.length === 0) {
      return [];
    }

    const familyUserIds = contacts
      .map((c) => c.linked_user_id)
      .filter((id): id is string => typeof id === 'string');

    if (familyUserIds.length === 0) {
      return [];
    }

    // 2. Fetch tokens from both device_tokens table and profiles.fcm_token column
    const [profilesRes, deviceTokensRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('fcm_token')
        .in('id', familyUserIds)
        .not('fcm_token', 'is', null),
      supabase
        .from('device_tokens')
        .select('token')
        .in('user_id', familyUserIds),
    ]);

    const tokensSet = new Set<string>();

    if (profilesRes.data) {
      profilesRes.data.forEach((p) => {
        if (p.fcm_token) tokensSet.add(p.fcm_token.trim());
      });
    }

    if (deviceTokensRes.data) {
      deviceTokensRes.data.forEach((d) => {
        if (d.token) tokensSet.add(d.token.trim());
      });
    }

    return Array.from(tokensSet);
  } catch (error) {
    console.error('❌ Error fetching family tokens:', error);
    return [];
  }
}

/**
 * Cleans up invalid/expired FCM registration tokens from the database.
 */
export async function cleanInvalidTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;

  try {
    console.log(`🗑️ Removing ${tokens.length} invalid FCM tokens...`);
    
    // Delete from device_tokens table
    const deleteTokensPromise = supabase
      .from('device_tokens')
      .delete()
      .in('token', tokens);

    // Nullify fcm_token in profiles table
    const nullifyProfilesPromise = supabase
      .from('profiles')
      .update({ fcm_token: null })
      .in('fcm_token', tokens);

    await Promise.all([deleteTokensPromise, nullifyProfilesPromise]);
    console.log('✅ Invalid tokens cleaned up successfully');
  } catch (error) {
    console.error('❌ Failed to clean up invalid FCM tokens:', error);
  }
}

/**
 * General helper to send a multicast push notification to the given tokens.
 * Gracefully handles partial failures and purges dead/invalid tokens.
 */
async function sendMulticastNotification(
  tokens: string[],
  payload: {
    notification: { title: string; body: string };
    data: Record<string, string>;
  }
): Promise<{ successCount: number; failureCount: number }> {
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  try {
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: payload.notification,
      data: payload.data,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK', // standard deep linking handler config
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            contentAvailable: true,
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`✉️ FCM Multicast Sent: ${response.successCount} success, ${response.failureCount} failure`);

    if (response.failureCount > 0) {
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, index) => {
        if (!resp.success) {
          const error = resp.error;
          // Unregistered or invalid tokens should be deleted
          if (
            error?.code === 'messaging/invalid-registration-token' ||
            error?.code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(tokens[index]);
          } else {
            console.warn(`⚠️ FCM single send failed for token index ${index} with code:`, error?.code, error?.message);
          }
        }
      });

      if (invalidTokens.length > 0) {
        // Fire-and-forget token cleanup so it doesn't block the caller
        cleanInvalidTokens(invalidTokens).catch((err) =>
          console.error('Failed async invalid token cleanup:', err)
        );
      }
    }

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error('❌ Critical error sending multicast FCM notification:', error);
    return { successCount: 0, failureCount: tokens.length };
  }
}

/**
 * Sends a manual or sensor-triggered SOS alert to the victim's emergency contacts.
 */
export async function sendSOSNotification(params: {
  incidentId: string;
  victimUserId: string;
  victimName: string;
  triggerType: 'manual' | 'keyword' | 'risk_engine' | 'notification_button';
}) {
  const tokens = await fetchFamilyTokens(params.victimUserId);
  if (tokens.length === 0) return { successCount: 0, failureCount: 0 };

  const title = '🚨 SafeHer SOS Alert';
  const body = `${params.victimName} membutuhkan bantuan. Tap untuk melihat lokasi live.`;

  return sendMulticastNotification(tokens, {
    notification: { title, body },
    data: {
      type: 'sos_alert',
      incidentId: params.incidentId,
      victimUserId: params.victimUserId,
      victimName: params.victimName,
      triggerType: params.triggerType,
      deepLink: `aegis://tracking/${params.incidentId}`,
    },
  });
}

/**
 * Sends an automated "No-Response" escalation alert to the victim's emergency contacts.
 */
export async function sendNoResponseNotification(params: {
  incidentId: string;
  victimUserId: string;
  victimName: string;
}) {
  const tokens = await fetchFamilyTokens(params.victimUserId);
  if (tokens.length === 0) return { successCount: 0, failureCount: 0 };

  const title = '⚠️ SafeHer No-Response Alert';
  const body = `${params.victimName} tidak merespons Guardian check-in. Tap untuk melihat lokasi terakhir/live.`;

  return sendMulticastNotification(tokens, {
    notification: { title, body },
    data: {
      type: 'no_response_alert',
      incidentId: params.incidentId,
      victimUserId: params.victimUserId,
      victimName: params.victimName,
      triggerType: 'no_response',
      deepLink: `aegis://tracking/${params.incidentId}`,
    },
  });
}

/**
 * Sends a notification indicating that an incident has a newly analyzed AI summary.
 */
export async function sendAISummaryNotification(params: {
  incidentId: string;
  victimUserId: string;
  classification: string;
  riskScore: number;
  summary: string;
}) {
  const tokens = await fetchFamilyTokens(params.victimUserId);
  if (tokens.length === 0) return { successCount: 0, failureCount: 0 };

  const title = '🧠 Analisis AI SafeHer Baru';
  const body = `Klasifikasi: ${params.classification} (Risiko: ${params.riskScore}%). Tap untuk melihat rangkuman.`;

  return sendMulticastNotification(tokens, {
    notification: { title, body },
    data: {
      type: 'ai_summary_ready',
      incidentId: params.incidentId,
      classification: params.classification,
      risk: String(params.riskScore),
      deepLink: `aegis://tracking/${params.incidentId}`,
    },
  });
}

/**
 * Sends a notification informing the family that the incident is resolved or marked as false alarm.
 */
export async function sendResolutionNotification(params: {
  incidentId: string;
  victimUserId: string;
  type: 'incident_resolved' | 'false_alarm';
}) {
  const tokens = await fetchFamilyTokens(params.victimUserId);
  if (tokens.length === 0) return { successCount: 0, failureCount: 0 };

  const isFalseAlarm = params.type === 'false_alarm';
  const title = isFalseAlarm ? '✅ Status SOS: False Alarm' : '✅ Status SOS: Selesai';
  const body = isFalseAlarm
    ? 'Korban telah menandai peringatan ini sebagai False Alarm. Kondisi aman.'
    : 'Korban telah menyatakan insiden telah selesai dan teratasi.';

  return sendMulticastNotification(tokens, {
    notification: { title, body },
    data: {
      type: params.type,
      incidentId: params.incidentId,
      deepLink: `aegis://incidents/${params.incidentId}`,
    },
  });
}
