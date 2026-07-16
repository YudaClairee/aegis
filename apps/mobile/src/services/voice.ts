import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-voice/voice';

let isListening = false;
let onResultCallback: ((text: string) => void) | null = null;

export function initVoiceMonitoring() {
  Voice.onSpeechResults = (e: SpeechResultsEvent) => {
    if (e.value && e.value.length > 0 && onResultCallback) {
      // The first value is usually the most confident match
      onResultCallback(e.value[0]);
    }
  };

  Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
    if (e.value && e.value.length > 0 && onResultCallback) {
      onResultCallback(e.value[0]);
    }
  };

  Voice.onSpeechError = (e: SpeechErrorEvent) => {
    console.warn('Speech recognition error:', e.error);
    // Restart if error happens (e.g. no speech detected for a while) to keep it listening
    if (isListening) {
      setTimeout(() => {
        if (isListening) {
          Voice.start('id-ID').catch(console.error);
        }
      }, 1000);
    }
  };

  Voice.onSpeechEnd = () => {
    // Restart recognition immediately after it finishes a chunk to keep it continuous
    if (isListening) {
      setTimeout(() => {
        if (isListening) {
          Voice.start('id-ID').catch(console.error);
        }
      }, 500);
    }
  };
}

export async function startVoiceMonitoring(onKeywordDetected: (text: string) => void) {
  try {
    if (isListening) return;
    
    onResultCallback = onKeywordDetected;
    isListening = true;
    
    await Voice.start('id-ID');
    console.log('🎙️ Keyword voice monitoring started');
  } catch (error) {
    console.error('Failed to start voice monitoring:', error);
    isListening = false;
  }
}

export async function stopVoiceMonitoring() {
  try {
    isListening = false;
    onResultCallback = null;
    await Voice.stop();
    await Voice.destroy(); // clear listeners temporarily, but we re-init on start
    initVoiceMonitoring(); // re-attach listeners for next time
    console.log('🔇 Keyword voice monitoring stopped');
  } catch (error) {
    console.error('Failed to stop voice monitoring:', error);
  }
}

// Initial setup
initVoiceMonitoring();
