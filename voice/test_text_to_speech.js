import dotenv from "dotenv"
dotenv.config()

import axios from "axios"
const VOICE_ID="XPqjYvTqfyUQr09yCpCY"
import fs from "fs"


async function generateSpeech(text) {
  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8
        }
      },
      {
        headers: {
          'xi-api-key': (process.env.ELEVENLABS_API_KEY),
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer' // we want binary audio data
      }
    );

    // Save the audio file locally
    fs.writeFileSync('output.mp3', response.data);
    console.log('✅ Audio saved as output.mp3');
  } catch (error) {
    console.error('❌ Error generating speech:', error.response?.data || error.message);
  }
}


generateSpeech('Hey there i am soham pirale')