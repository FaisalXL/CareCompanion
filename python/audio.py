"""
Audio subsystem — LMNT text-to-speech and OpenAI Whisper speech-to-text.

Audio playback uses the Arduino ``Speaker`` peripheral (same as the
WaveGenerator / Theremin bricks).  It writes PCM data to a USB speaker
via ``alsaaudio`` — the only audio output path that works inside the
App Lab container.
"""

import os
import subprocess
import wave

import numpy as np
import lmnt
import requests

from arduino.app_peripherals.speaker import Speaker

from config import (
    AUDIO_TMP,
    LMNT_API_KEY,
    LMNT_VOICE,
    OPENAI_API_KEY,
    OPENAI_TRANSCRIPTION_URL,
    RECORD_DURATION,
)


os.makedirs(AUDIO_TMP, exist_ok=True)


class AudioManager:

    def __init__(self):
        self._tts_client = lmnt.Lmnt(api_key=LMNT_API_KEY)
        self._tts_path = os.path.join(AUDIO_TMP, "tts_out.wav")
        self._rec_path = os.path.join(AUDIO_TMP, "recording.wav")

        # Initialise the Arduino Speaker peripheral (auto-detects USB speaker)
        try:
            self._speaker = Speaker(
                device=Speaker.USB_SPEAKER_1,
                sample_rate=24000,
                channels=1,
                format="S16_LE",
            )
            print("[audio] Speaker peripheral initialised")
        except Exception as exc:
            print(f"[audio] Speaker init failed: {exc}")
            self._speaker = None

    # ── text-to-speech ────────────────────────────────────────────────────

    def speak(self, text: str) -> bool:
        """Generate speech via LMNT and play through the USB speaker."""
        if not text or not text.strip():
            return True
        try:
            print(f"[audio] TTS generating: '{text[:60]}' …")
            resp = self._tts_client.speech.generate(
                text=text, voice=LMNT_VOICE, format="wav",
            )
            print("[audio] TTS response received, reading bytes…")
            audio_bytes = resp.read()
            print(f"[audio] TTS got {len(audio_bytes)} bytes, writing file…")
            with open(self._tts_path, "wb") as fh:
                fh.write(audio_bytes)
            print("[audio] playing…")
            self._play_wav(self._tts_path)
            return True
        except Exception as exc:
            print(f"[audio] TTS error: {exc}")
            import traceback
            traceback.print_exc()
            return False

    def _play_wav(self, path: str):
        """Read a WAV file and stream PCM frames through the Speaker peripheral."""
        if self._speaker is None:
            print("[audio] no speaker available")
            return

        try:
            with wave.open(path, "rb") as wf:
                n_channels = wf.getnchannels()
                sampwidth = wf.getsampwidth()
                framerate = wf.getframerate()
                n_frames = wf.getnframes()
                raw = wf.readframes(n_frames)

            print(f"[audio] WAV: {framerate}Hz, {n_channels}ch, {sampwidth}B, {n_frames} frames")

            # Convert to numpy int16 array
            if sampwidth == 2:
                samples = np.frombuffer(raw, dtype=np.int16)
            elif sampwidth == 1:
                samples = (np.frombuffer(raw, dtype=np.uint8).astype(np.int16) - 128) * 256
            elif sampwidth == 4:
                samples = (np.frombuffer(raw, dtype=np.int32) >> 16).astype(np.int16)
            else:
                print(f"[audio] unsupported sample width: {sampwidth}")
                return

            # Mix to mono if stereo
            if n_channels == 2:
                samples = samples.reshape(-1, 2).mean(axis=1).astype(np.int16)

            # Resample to 24000 Hz if needed
            if framerate != 24000:
                original_len = len(samples)
                target_len = int(original_len * 24000 / framerate)
                indices = np.linspace(0, original_len - 1, target_len)
                samples = np.interp(indices, np.arange(original_len), samples).astype(np.int16)

            pcm_bytes = samples.tobytes()
            chunk_bytes = 2400 * 2  # 100ms chunks at 24kHz, 2 bytes per sample

            # Start speaker (safe to call if already started)
            self._speaker.start(notify_if_started=False)

            for i in range(0, len(pcm_bytes), chunk_bytes):
                chunk = pcm_bytes[i : i + chunk_bytes]
                self._speaker.play(chunk, block_on_queue=True)

            # Wait for all queued audio to finish playing
            self._speaker._playing_queue.join()
            # Stop speaker to release the ALSA device for recording
            self._speaker.stop()

            print(f"[audio] playback complete ({len(pcm_bytes)} bytes)")

        except Exception as exc:
            print(f"[audio] playback error: {exc}")
            import traceback
            traceback.print_exc()
            try:
                self._speaker.stop()
            except Exception:
                pass

    # ── speech-to-text ────────────────────────────────────────────────────

    def record(self, duration: int = None) -> str:
        """Record audio from the Headset mic (B100 is used by KeywordSpotting)."""
        dur = duration or RECORD_DURATION

        mic_devices = [
            "plughw:CARD=Headset,DEV=0",
            "default",
        ]

        for dev in mic_devices:
            try:
                print(f"[audio] recording {dur}s from {dev}…")
                result = subprocess.run(
                    [
                        "arecord",
                        "-D", dev,
                        "-d", str(dur),
                        "-f", "S16_LE",
                        "-c", "1",
                        "-r", "16000",
                        self._rec_path,
                    ],
                    timeout=dur + 5,
                    capture_output=True,
                    text=True,
                )
                if result.returncode != 0:
                    print(f"[audio] arecord failed on {dev}: {result.stderr.strip()}")
                    continue
                fsize = os.path.getsize(self._rec_path) if os.path.exists(self._rec_path) else 0
                print(f"[audio] recorded {fsize} bytes from {dev}")
                return self._rec_path
            except Exception as exc:
                print(f"[audio] recording from {dev} failed: {exc}")
                continue

        print("[audio] all mic devices failed")
        return ""

    def transcribe(self, audio_path: str = None) -> str:
        """Transcribe audio via OpenAI Whisper."""
        path = audio_path or self._rec_path
        if not os.path.exists(path):
            return ""
        try:
            with open(path, "rb") as fh:
                resp = requests.post(
                    OPENAI_TRANSCRIPTION_URL,
                    headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
                    files={"file": fh},
                    data={"model": "whisper-1"},
                    timeout=15,
                )
            return resp.json().get("text", "")
        except Exception as exc:
            print(f"[audio] transcription error: {exc}")
            return ""

    def record_and_transcribe(self, duration: int = None) -> str:
        """Convenience: record then transcribe in one call."""
        path = self.record(duration)
        if not path:
            return ""
        return self.transcribe(path)
