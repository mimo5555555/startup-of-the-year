# Synthesizes a batch of German, Dutch or Spanish lines with Piper (tools/voice/generate-piper.mjs writes the batch and turns the WAVs into
# MP3s).
#   python piper_batch.py <models dir> <jobs.json>      jobs: [{"model", "text", "speed", "wav", "speaker"?}]
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
        # a model is named in full (nl_NL-pim-medium) or, for Berlin's two, without its de_DE- prefix (thorsten-high)
        path = os.path.join(models_dir, f"{job['model']}.onnx")
        if not os.path.exists(path):
            path = os.path.join(models_dir, f"de_DE-{job['model']}.onnx")
        voice = voices[job["model"]] = PiperVoice.load(path)
    tmp = job["wav"] + ".tmp"
    with wave.open(tmp, "wb") as w:
        # a model with several speakers (Sharvard: 0 the man, 1 the woman) is told which one
        extra = {"speaker_id": job["speaker"]} if "speaker" in job else {}
        voice.synthesize_wav(job["text"], w, syn_config=SynthesisConfig(length_scale=1.0 / job["speed"], **extra))
    os.replace(tmp, job["wav"])
    done += 1
    if done % 50 == 0:
        print(f"{done} synthesized", flush=True)
print(f"done {done}", flush=True)
