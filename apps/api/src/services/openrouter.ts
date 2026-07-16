import OpenAI from 'openai';
import { env } from '../lib/env';
import { AISummary, TriggerType } from '@aegis/shared';

export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': env.OPENROUTER_SITE_URL,
    'X-Title': env.OPENROUTER_APP_NAME,
  },
});

/**
 * Exponential backoff helper for promise functions
 */
async function callWithRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    console.warn(`⚠️ OpenRouter API failed. Retrying in ${delay}ms... (Retries remaining: ${retries})`, error);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return callWithRetry(fn, retries - 1, delay * 2);
  }
}

interface AnalyzeIncidentAudioInput {
  audioBuffer: Buffer;
  mimeType: string;
  incidentId: string;
  triggerType: TriggerType;
  location: {
    latitude: number;
    longitude: number;
  };
}

interface AnalyzeIncidentAudioOutput {
  transcript: string;
  aiSummary: AISummary;
}

/**
 * Analyzes audio recording using google/gemini-3-flash-preview on OpenRouter.
 * Returns transcript and AI-generated summary object.
 */
export async function analyzeIncidentAudio(input: AnalyzeIncidentAudioInput): Promise<AnalyzeIncidentAudioOutput> {
  const base64Audio = input.audioBuffer.toString('base64');
  const audioDataUrl = `data:${input.mimeType};base64,${base64Audio}`;

  const prompt = `Anda adalah AI asisten keamanan khusus untuk SafeHer. Tugas Anda adalah menganalisis rekaman suara dari situasi darurat/SOS yang dialami oleh korban.
Dengarkan rekaman suara tersebut secara mendalam, buat transkripnya, lalu hasilkan analisis situasi.

Konteks Awal:
- ID Insiden: ${input.incidentId}
- Jenis Trigger Awal: ${input.triggerType}
- Lokasi: Latitude ${input.location.latitude}, Longitude ${input.location.longitude}

Tugas Anda adalah menghasilkan respons dalam format JSON murni dengan struktur sebagai berikut:
{
  "transcript": "Transkrip lengkap pembicaraan atau suara yang terdengar dalam bahasa aslinya (misal Bahasa Indonesia/Inggris)",
  "aiSummary": {
    "risk": 0 sampai 100 (integer nilai risiko bahaya, semakin tinggi semakin berbahaya),
    "classification": "harassment" | "robbery" | "assault" | "stalking" | "unknown",
    "recommendation": "send_sos" | "monitor" | "false_alarm",
    "summary": "Ringkasan kronologis singkat mengenai situasi korban dalam Bahasa Indonesia",
    "keywords_detected": ["kata_kunci1", "kata_kunci2"],
    "confidence": 0.0 sampai 1.0 (float nilai keyakinan terhadap klasifikasi)
  }
}

Aturan Penting:
1. Jika suara tidak terdengar jelas, tidak dapat diidentifikasi, atau hanya berisi noise, set klasifikasi menjadi "unknown", confidence rendah, dan risk sesuai perkiraan noise (misal 10 atau 20). Jangan mengarang kejadian.
2. Summary harus ditulis dalam Bahasa Indonesia yang formal dan jelas.
3. Kembalikan HANYA format JSON di atas, jangan berikan teks pendahuluan, penutup, atau tanda markdown \`\`\`json.`;

  const apiCall = async () => {
    const response = await openrouter.chat.completions.create({
      model: env.OPENROUTER_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: audioDataUrl,
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '';
    if (!content) {
      throw new Error('OpenRouter returned an empty response content');
    }

    // Strip markdown formatting if any
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json/, '').replace(/```$/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```/, '').replace(/```$/, '');
    }

    const parsed = JSON.parse(cleanedContent.trim());

    if (!parsed.transcript || !parsed.aiSummary) {
      throw new Error('OpenRouter response JSON is missing transcript or aiSummary field');
    }

    return {
      transcript: parsed.transcript,
      aiSummary: {
        risk: Number(parsed.aiSummary.risk) || 0,
        classification: parsed.aiSummary.classification || 'unknown',
        recommendation: parsed.aiSummary.recommendation || 'monitor',
        summary: parsed.aiSummary.summary || '',
        keywords_detected: parsed.aiSummary.keywords_detected || [],
        confidence: Number(parsed.aiSummary.confidence) || 0,
      } as AISummary,
    };
  };

  // Run with retry logic
  return callWithRetry(apiCall, 2, 1000);
}
