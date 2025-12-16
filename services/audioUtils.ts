import { Blob } from "@google/genai";

let sharedCtx: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext {
  if (!sharedCtx) {
    // Force 48kHz sample rate for higher fidelity and less aliasing (grain)
    // Most modern hardware runs natively at 48k.
    sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
      latencyHint: 'interactive',
      sampleRate: 48000 
    });
  }
  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume();
  }
  return sharedCtx;
}

// Decodes base64 string to raw bytes
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Encodes raw bytes to base64 string
export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Decodes raw PCM data to AudioBuffer
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sourceSampleRate: number = 24000, 
  numChannels: number = 1,
): Promise<AudioBuffer> {
  // Safe Int16 view creation
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
  const frameCount = dataInt16.length / numChannels;
  
  // Create buffer at the SOURCE rate (24k).
  // The 48k Context will handle the upsampling interpolation much better than
  // trying to play 24k data on a 44.1k default context.
  const buffer = ctx.createBuffer(numChannels, frameCount, sourceSampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Normalize Int16 to Float32 [-1.0, 1.0]
      // No extra attenuation here, handled by hardware mixer usually, 
      // but ensuring full dynamic range usage.
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Create blob from Float32Array for Live API
export function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = Math.max(-1, Math.min(1, data[i])) * 32768; 
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}