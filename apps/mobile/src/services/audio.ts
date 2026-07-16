import { Audio } from 'expo-av';
import { uploadIncidentAudio } from './upload';

let recording: Audio.Recording | null = null;
let recordingTimer: ReturnType<typeof setTimeout> | null = null;

export async function startRecordingSession(incidentId: string) {
  try {
    const status = await Audio.requestPermissionsAsync();
    if (!status.granted) {
      console.warn('Microphone permission not granted for recording');
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: true,
    });

    if (recording) {
      await recording.stopAndUnloadAsync().catch(() => {});
      recording = null;
    }

    const { recording: newRecording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.LOW_QUALITY
    );
    recording = newRecording;

    console.log('🎙️ Recording started for incident:', incidentId);

    // Stop and upload after 15 seconds
    recordingTimer = setTimeout(async () => {
      await stopAndUploadRecording(incidentId);
    }, 15000);
  } catch (err) {
    console.error('Failed to start recording session:', err);
  }
}

export async function stopAndUploadRecording(incidentId: string) {
  if (recordingTimer) {
    clearTimeout(recordingTimer);
    recordingTimer = null;
  }

  if (!recording) return;

  try {
    console.log('Stopping recording for incident:', incidentId);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    recording = null;

    if (uri) {
      console.log('Audio file saved locally at:', uri);
      await uploadIncidentAudio(incidentId, uri);
    }
  } catch (err) {
    console.error('Failed to stop and upload recording:', err);
  }
}
