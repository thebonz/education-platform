# =============================================================================
# HappyClass TTS – đọc tiếng Việt giọng Bắc bằng Piper (chạy offline trên CPU, không gọi dịch vụ ngoài).
#   - Piper 2023.11.14-2 (MIT): https://github.com/rhasspy/piper
#   - Giọng vi_VN-vais1000-medium: huấn luyện trên VAIS-1000 (giọng Bắc, CC BY 4.0)
#     https://huggingface.co/rhasspy/piper-voices · https://ieee-dataport.org/documents/vais-1000-vietnamese-speech-synthesis-corpus
# Piper và mô hình giọng đều được kiểm tra SHA-256 khi build.
# =============================================================================
FROM debian:bookworm-slim AS fetch
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
ARG PIPER_URL=https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz
ARG PIPER_SHA256=a50cb45f355b7af1f6d758c1b360717877ba0a398cc8cbe6d2a7a3a26e225992
ARG VOICE_BASE=https://huggingface.co/rhasspy/piper-voices/resolve/main/vi/vi_VN/vais1000/medium
ARG VOICE_SHA256=ec7c89e2c85f4d1edc24b6120c18aaf1bda614f06b511567eb9c7c0de15e2dab
RUN curl -fsSL --retry 3 "$PIPER_URL" -o /tmp/piper.tgz \
 && echo "$PIPER_SHA256  /tmp/piper.tgz" | sha256sum -c - \
 && tar xzf /tmp/piper.tgz -C /opt \
 && mkdir -p /opt/voices \
 && curl -fsSL --retry 3 "$VOICE_BASE/vi_VN-vais1000-medium.onnx" -o /opt/voices/vi.onnx \
 && echo "$VOICE_SHA256  /opt/voices/vi.onnx" | sha256sum -c - \
 && curl -fsSL --retry 3 "$VOICE_BASE/vi_VN-vais1000-medium.onnx.json" -o /opt/voices/vi.onnx.json \
 && curl -fsSL --retry 3 "$VOICE_BASE/MODEL_CARD" -o /opt/voices/MODEL_CARD

FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libstdc++6 && rm -rf /var/lib/apt/lists/*
COPY --from=fetch /opt /opt
COPY services/tts/server.py /app/server.py
# Tự kiểm tra khi build: đọc thử một câu, phải ra file WAV
RUN printf 'xin chào các em' | /opt/piper/piper -q -m /opt/voices/vi.onnx -f /tmp/check.wav \
 && test "$(head -c 4 /tmp/check.wav)" = "RIFF" && rm /tmp/check.wav
USER 65534:65534
EXPOSE 5002
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python3 -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:5002/health',timeout=3)"
CMD ["python3", "/app/server.py"]
