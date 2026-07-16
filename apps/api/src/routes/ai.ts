import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware, AuthVariables } from '../middleware/auth';
import { analyzeIncidentAudio } from '../services/openrouter';
import { env } from '../lib/env';

const aiRouter = new Hono<{ Variables: AuthVariables }>();

// Require authentication for security
aiRouter.use('*', authMiddleware);

// 1. POST /analyze - Test audio pipeline directly
aiRouter.post('/analyze', async (c) => {
  const body = await c.req.parseBody();
  const audioFile = body.audio;

  if (!audioFile || !(audioFile instanceof File)) {
    throw new HTTPException(400, { message: 'Audio file is required in "audio" multipart field' });
  }

  // Validate file size
  if (audioFile.size > env.AUDIO_MAX_BYTES) {
    throw new HTTPException(413, {
      message: `Audio file too large (${(audioFile.size / (1024 * 1024)).toFixed(2)} MB). Max limit is ${(
        env.AUDIO_MAX_BYTES / (1024 * 1024)
      ).toFixed(0)} MB.`,
    });
  }

  // Validate MIME type
  const allowedMimeTypes = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/m4a', 'audio/x-m4a'];
  if (!allowedMimeTypes.includes(audioFile.type)) {
    throw new HTTPException(415, {
      message: `Unsupported audio type "${audioFile.type}". Allowed formats: mpeg, mp4, wav, webm, m4a`,
    });
  }

  // Read arrayBuffer and convert to Buffer
  const arrayBuffer = await audioFile.arrayBuffer();
  const audioBuffer = Buffer.from(arrayBuffer);

  // Call AI Pipeline with default test settings
  const result = await analyzeIncidentAudio({
    audioBuffer,
    mimeType: audioFile.type,
    incidentId: 'standalone-test',
    triggerType: 'manual',
    location: {
      latitude: -6.2088,
      longitude: 106.8456,
    },
  });

  return c.json(result);
});

export { aiRouter };
