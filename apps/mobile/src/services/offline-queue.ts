import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../lib/env';
import { supabase } from '../lib/supabase';
import { uploadIncidentAudio } from './upload';

export type QueuedRequest = {
  id: string;
  type: 'sos_trigger' | 'audio_upload' | 'tracking_location' | 'tracking_batch';
  endpoint: string;
  method: 'POST' | 'PUT';
  body?: any;
  fileUri?: string;
  incidentId?: string;
  timestamp: string;
  retryCount: number;
};

const QUEUE_KEY = '@safeher_offline_queue';
let isProcessing = false;

export async function queueRequest(
  type: QueuedRequest['type'],
  endpoint: string,
  method: QueuedRequest['method'],
  body?: any,
  fileUri?: string,
  incidentId?: string
) {
  try {
    const rawQueue = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: QueuedRequest[] = rawQueue ? JSON.parse(rawQueue) : [];

    const newItem: QueuedRequest = {
      id: Math.random().toString(36).substring(7),
      type,
      endpoint,
      method,
      body,
      fileUri,
      incidentId,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    queue.push(newItem);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    console.log(`📥 Request queued offline (Type: ${type}). Total queue size: ${queue.length}`);
  } catch (err) {
    console.error('Failed to write to offline queue:', err);
  }
}

export async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const rawQueue = await AsyncStorage.getItem(QUEUE_KEY);
    if (!rawQueue) {
      isProcessing = false;
      return;
    }

    let queue: QueuedRequest[] = JSON.parse(rawQueue);
    if (queue.length === 0) {
      isProcessing = false;
      return;
    }

    console.log(`🔄 Processing ${queue.length} queued offline requests...`);

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const remainingQueue: QueuedRequest[] = [];
    let activeServerIncidentId: string | null = null;

    for (const item of queue) {
      if (item.retryCount >= 5) {
        console.warn(`⚠️ Request ${item.id} exceeded max retries. Dropped.`);
        continue;
      }

      try {
        // 1. If it's a queued SOS pemicu
        if (item.type === 'sos_trigger') {
          const response = await fetch(`${API_URL}${item.endpoint}`, {
            method: item.method,
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(item.body),
          });

          if (!response.ok) throw new Error(`SOS trigger failed: ${response.status}`);
          const resJson = await response.json();
          activeServerIncidentId = resJson.incident?.id;
          console.log(`✅ Queued SOS Triggered successfully. Real Incident ID: ${activeServerIncidentId}`);
        }
        
        // 2. If it's a queued audio upload
        else if (item.type === 'audio_upload') {
          const id = item.incidentId || activeServerIncidentId;
          if (!id) {
            console.warn(`Cannot upload audio without active incident ID. Keeping in queue.`);
            remainingQueue.push({ ...item, retryCount: item.retryCount + 1 });
            continue;
          }
          if (item.fileUri) {
            await uploadIncidentAudio(id, item.fileUri);
            console.log(`✅ Queued Audio uploaded successfully for incident ${id}`);
          }
        }
        
        // 3. If it's a tracking update
        else if (item.type === 'tracking_location' || item.type === 'tracking_batch') {
          const id = item.incidentId || activeServerIncidentId;
          if (!id) {
            console.warn(`Cannot sync tracking without incident ID. Keeping in queue.`);
            remainingQueue.push({ ...item, retryCount: item.retryCount + 1 });
            continue;
          }

          // Build request payload with real server incident ID
          let finalBody = item.body;
          if (item.type === 'tracking_location') {
            finalBody = { ...item.body, incidentId: id };
          } else if (item.type === 'tracking_batch') {
            finalBody = { ...item.body, incidentId: id };
          }

          const response = await fetch(`${API_URL}${item.endpoint}`, {
            method: item.method,
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(finalBody),
          });

          if (!response.ok) throw new Error(`Tracking sync failed: ${response.status}`);
          console.log(`✅ Queued tracking points synced successfully for incident ${id}`);
        }
      } catch (err) {
        console.warn(`❌ Failed to sync queue item ${item.id}. Keeping in queue. Error:`, err);
        remainingQueue.push({ ...item, retryCount: item.retryCount + 1 });
      }
    }

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
    console.log(`🔄 Offline queue processing done. Remaining items: ${remainingQueue.length}`);
  } catch (err) {
    console.error('Error during offline queue sync:', err);
  } finally {
    isProcessing = false;
  }
}
