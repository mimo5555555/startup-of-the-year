# Synthesizes a batch of German lines with Piper (tools/voice/generate-de.mjs writes the batch and turns the WAVs into MP3s).
#   python piper_batch.py <models dir> <jobs.json>      jobs: [{"model", "text", "speed", "wav"}]
# Each model loads once; a job whose WAV exists is skipped (the run is resumable).
import json
import os
import sys
import wave

from piper import PiperVoice, SynthesisConfig

models_dir, jobs_path = sys.argv[1], sys.argv[2]
jobs = json.load(open(jobs_path, encoding="utf-8"))
voices = {}
done = 0
for job in jobs:
    if os.path.exists(job["wav"]):
        continue
    voice = voices.get(job["model"])
    if voice is None:
        voice = voices[job["model"]] = PiperVoice.load(os.path.join(models_dir, f"de_DE-{job['model']}.onnx"))
    tmp = job["wav"] + ".tmp"
    with wave.open(tmp, "wb") as w:
        voice.synthesize_wav(job["text"], w, syn_config=SynthesisConfig(length_scale=1.0 / job["speed"]))
    os.replace(tmp, job["wav"])
    done += 1
    if done % 50 == 0:
        print(f"{done} synthesized", flush=True)
print(f"done {done}", flush=True)
