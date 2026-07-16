import { API_URL } from '../lib/env';
import { supabase } from '../lib/supabase';

export async function uploadIncidentAudio(incidentId: string, fileUri: string) {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const formData = new FormData();
  const filename = fileUri.split('/').pop() || `audio_${incidentId}.m4a`;
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `audio/${match[1]}` : `audio/m4a`;

  formData.append('audio', {
    uri: fileUri,
    name: filename,
    type,
  } as any);

  console.log(`📤 Uploading audio to backend for incident ${incidentId}...`);

  const response = await fetch(`${API_URL}/api/sos/${incidentId}/audio`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Audio upload failed with status ${response.status}`);
  }

  const result = await response.json();
  console.log('✅ Audio upload successful:', result);
  return result;
}
