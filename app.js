// Signal Processing Analyzer - Glassmorphism Edition

// Global variables
let audioContext;
let analyser;
let microphone;
let timeData;
let freqData;
let animationId;
let backgroundAnimationId;
let isRecording = false;
let sampleRate;

// DOM Elements
const backgroundCanvas = document.getElementById("backgroundCanvas");
const backgroundCtx = backgroundCanvas.getContext("2d");
const timeCanvas = document.getElementById("timeCanvas");
const transformCanvas = document.getElementById("transformCanvas");
const timeCtx = timeCanvas.getContext("2d");
const transformCtx = transformCanvas.getContext("2d");
const startBtn = document.getElementById("startBtn");
const transformType = document.getElementById("transformType");
const transformTitle = document.getElementById("transformTitle");
const status = document.getElementById("status");
const windowControl = document.getElementById("windowControl");
const windowSizeInput = document.getElementById("windowSize");

// Transform type labels
const TRANSFORM_LABELS = {
  fft: "Fast Fourier Transform (FFT)",
  power: "Power Spectral Density",
  autocorr: "Autocorrelation",
  cepstrum: "Cepstrum",
  stft: "Short-Time Fourier Transform",
  envelope: "Envelope Detection",
  zerocross: "Zero Crossing Rate",
};

// Background wave data for animation
let backgroundWaveData = new Uint8Array(128);
for (let i = 0; i < backgroundWaveData.length; i++) {
  backgroundWaveData[i] = 128 + Math.sin(i * 0.1) * 20;
}

// Canvas Setup Functions
function setupCanvas(canvas, wrapper) {
  const rect = wrapper.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  canvas.style.width = "100%";
  canvas.style.height = "100%";

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  return { width: rect.width, height: rect.height };
}

function setupBackgroundCanvas() {
  const dpr = window.devicePixelRatio || 1;
  backgroundCanvas.width = window.innerWidth * dpr;
  backgroundCanvas.height = window.innerHeight * dpr;
  backgroundCtx.scale(dpr, dpr);
}

function resizeCanvases() {
  setupBackgroundCanvas();

  const timeWrapper = timeCanvas.parentElement;
  const transformWrapper = transformCanvas.parentElement;

  setupCanvas(timeCanvas, timeWrapper);
  setupCanvas(transformCanvas, transformWrapper);

  if (isRecording && timeData && freqData) {
    Visualization.drawTimeDomain();
    Visualization.drawTransform();
  }
}

// Background Animation
function animateBackground() {
  backgroundAnimationId = requestAnimationFrame(animateBackground);

  const width = window.innerWidth;
  const height = window.innerHeight;

  backgroundCtx.fillStyle = "#0f172a";
  backgroundCtx.fillRect(0, 0, width, height);

  // Draw multiple wave layers for depth
  for (let layer = 0; layer < 3; layer++) {
    backgroundCtx.strokeStyle = `rgba(59, 130, 246, ${0.1 - layer * 0.03})`;
    backgroundCtx.lineWidth = 2 - layer * 0.5;
    backgroundCtx.beginPath();

    const data = isRecording && timeData ? timeData : backgroundWaveData;
    const offset = layer * 50;
    const amplitude = (3 - layer) * 0.2;

    for (let i = 0; i < width; i++) {
      const dataIndex = Math.floor((i / width) * data.length);
      const value = (data[dataIndex] - 128) / 128;
      const y = height / 2 + offset + value * height * amplitude;

      if (i === 0) {
        backgroundCtx.moveTo(i, y);
      } else {
        backgroundCtx.lineTo(i, y);
      }
    }

    backgroundCtx.stroke();
  }

  // Animate background wave when not recording
  if (!isRecording) {
    for (let i = 0; i < backgroundWaveData.length - 1; i++) {
      backgroundWaveData[i] = backgroundWaveData[i + 1];
    }
    backgroundWaveData[backgroundWaveData.length - 1] =
      128 + Math.sin(Date.now() * 0.001) * 30 + (Math.random() - 0.5) * 10;
  }
}

// Signal Processing Functions
const SignalProcessing = {
  computeFFT(data) {
    analyser.getByteFrequencyData(freqData);
    return freqData;
  },

  computePowerSpectralDensity(data) {
    const fft = this.computeFFT(data);
    const psd = new Float32Array(fft.length);
    for (let i = 0; i < fft.length; i++) {
      psd[i] = (fft[i] / 255) ** 2;
    }
    return psd;
  },

  computeAutocorrelation(data) {
    const n = Math.min(data.length, 512);
    const result = new Float32Array(n);
    const mean = data.reduce((a, b) => a + b) / data.length;

    for (let lag = 0; lag < n; lag++) {
      let sum = 0;
      for (let i = 0; i < data.length - lag; i++) {
        sum += (data[i] - mean) * (data[i + lag] - mean);
      }
      result[lag] = sum / (data.length - lag);
    }

    const max = Math.max(...result);
    if (max > 0) {
      for (let i = 0; i < n; i++) {
        result[i] = result[i] / max;
      }
    }

    return result;
  },

  computeCepstrum(data) {
    analyser.getByteFrequencyData(freqData);
    const logSpectrum = new Float32Array(freqData.length);

    for (let i = 0; i < freqData.length; i++) {
      logSpectrum[i] = Math.log(Math.max(freqData[i] / 255, 0.0001));
    }

    const cepstrum = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      let sum = 0;
      for (let k = 0; k < logSpectrum.length; k++) {
        sum +=
          logSpectrum[k] * Math.cos((2 * Math.PI * i * k) / logSpectrum.length);
      }
      cepstrum[i] = sum / logSpectrum.length;
    }

    return cepstrum;
  },

  computeSTFT(data) {
    const windowSize = Math.min(
      (parseInt(windowSizeInput.value) * sampleRate) / 1000,
      data.length
    );
    const hopSize = Math.floor(windowSize / 2);
    const windows = Math.floor((data.length - windowSize) / hopSize);
    const result = new Float32Array(Math.min(windows, 128));

    for (let w = 0; w < Math.min(windows, 128); w++) {
      const start = w * hopSize;
      let energy = 0;

      for (let i = 0; i < windowSize && start + i < data.length; i++) {
        const sample = (data[start + i] - 128) / 128;
        const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / windowSize);
        energy += (sample * window) ** 2;
      }

      result[w] = Math.sqrt(energy / windowSize);
    }

    return result;
  },

  computeEnvelope(data) {
    const envelope = new Float32Array(data.length);
    const alpha = 0.05;

    envelope[0] = Math.abs(data[0] - 128) / 128;
    for (let i = 1; i < data.length; i++) {
      const rectified = Math.abs(data[i] - 128) / 128;
      envelope[i] = alpha * rectified + (1 - alpha) * envelope[i - 1];
    }

    return envelope;
  },

  computeZeroCrossingRate(data) {
    const windowSize = 128;
    const hopSize = 64;
    const windows = Math.floor((data.length - windowSize) / hopSize);
    const zcr = new Float32Array(Math.min(windows, 256));

    for (let w = 0; w < Math.min(windows, 256); w++) {
      let crossings = 0;
      const start = w * hopSize;

      for (let i = 1; i < windowSize && start + i < data.length; i++) {
        const prev = data[start + i - 1] - 128;
        const curr = data[start + i] - 128;
        if (prev * curr < 0) {
          crossings++;
        }
      }

      zcr[w] = crossings / windowSize;
    }

    return zcr;
  },
};

// Drawing Functions
const Visualization = {
  drawGrid(ctx, width, height) {
    ctx.strokeStyle = "rgba(96, 165, 250, 0.1)";
    ctx.lineWidth = 0.5;

    const vLines = Math.min(10, Math.floor(width / 40));
    for (let i = 0; i <= vLines; i++) {
      const x = (i / vLines) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    const hLines = 5;
    for (let i = 0; i <= hLines; i++) {
      const y = (i / hLines) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  },

  drawTimeDomain() {
    const rect = timeCanvas.parentElement.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    analyser.getByteTimeDomainData(timeData);

    timeCtx.clearRect(0, 0, width, height);

    this.drawGrid(timeCtx, width, height);

    timeCtx.save();

    // Draw glow effect
    timeCtx.shadowColor = "#3b82f6";
    timeCtx.shadowBlur = 10;

    timeCtx.lineWidth = 2;
    timeCtx.strokeStyle = "#60a5fa";
    timeCtx.beginPath();

    const sliceWidth = width / timeData.length;
    let x = 0;

    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        timeCtx.moveTo(x, y);
      } else {
        timeCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    timeCtx.stroke();

    timeCtx.restore();

    // Draw zero line
    timeCtx.strokeStyle = "rgba(96, 165, 250, 0.3)";
    timeCtx.lineWidth = 1;
    timeCtx.setLineDash([5, 5]);
    timeCtx.beginPath();
    timeCtx.moveTo(0, height / 2);
    timeCtx.lineTo(width, height / 2);
    timeCtx.stroke();
    timeCtx.setLineDash([]);
  },

  drawTransform() {
    const rect = transformCanvas.parentElement.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    transformCtx.clearRect(0, 0, width, height);

    this.drawGrid(transformCtx, width, height);

    let data;
    const type = transformType.value;

    switch (type) {
      case "fft":
        data = SignalProcessing.computeFFT(timeData);
        break;
      case "power":
        data = SignalProcessing.computePowerSpectralDensity(timeData);
        break;
      case "autocorr":
        data = SignalProcessing.computeAutocorrelation(timeData);
        break;
      case "cepstrum":
        data = SignalProcessing.computeCepstrum(timeData);
        break;
      case "stft":
        data = SignalProcessing.computeSTFT(timeData);
        break;
      case "envelope":
        data = SignalProcessing.computeEnvelope(timeData);
        break;
      case "zerocross":
        data = SignalProcessing.computeZeroCrossingRate(timeData);
        break;
    }

    transformCtx.save();

    // Draw with glow effect
    transformCtx.shadowColor = "#3b82f6";
    transformCtx.shadowBlur = 15;

    transformCtx.lineWidth = 2;
    transformCtx.strokeStyle = "#60a5fa";
    transformCtx.beginPath();

    const barWidth = width / data.length;
    const padding = height * 0.05;

    for (let i = 0; i < data.length; i++) {
      const x = i * barWidth;
      let value;

      if (type === "fft") {
        value = data[i] / 255;
      } else if (type === "autocorr" || type === "envelope") {
        value = (data[i] + 1) / 2;
      } else if (type === "cepstrum") {
        value = (data[i] + 2) / 4;
      } else {
        value = Math.min(Math.max(data[i], 0), 1);
      }

      const y = height - padding - value * (height - 2 * padding);

      if (i === 0) {
        transformCtx.moveTo(x, y);
      } else {
        transformCtx.lineTo(x, y);
      }
    }

    transformCtx.stroke();

    // Fill area under curve
    transformCtx.lineTo(width, height - padding);
    transformCtx.lineTo(0, height - padding);
    transformCtx.closePath();

    const gradient = transformCtx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(59, 130, 246, 0.3)");
    gradient.addColorStop(1, "rgba(59, 130, 246, 0.05)");
    transformCtx.fillStyle = gradient;
    transformCtx.fill();

    transformCtx.restore();
  },
};

// Animation Loop
function animate() {
  animationId = requestAnimationFrame(animate);
  Visualization.drawTimeDomain();
  Visualization.drawTransform();
}

// Audio Functions
const AudioHandler = {
  async startAudio() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      microphone = audioContext.createMediaStreamSource(stream);

      sampleRate = audioContext.sampleRate;
      analyser.fftSize = 2048;
      const bufferLength = analyser.frequencyBinCount;
      timeData = new Uint8Array(analyser.fftSize);
      freqData = new Uint8Array(bufferLength);

      microphone.connect(analyser);

      isRecording = true;
      startBtn.innerHTML = '<span class="btn-icon">■</span> Stop';
      startBtn.classList.add("stop");
      status.style.display = "flex";

      animate();
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied");
    }
  },

  stopAudio() {
    isRecording = false;
    if (microphone) {
      microphone.disconnect();
      microphone.mediaStream.getTracks().forEach((track) => track.stop());
    }
    if (audioContext) {
      audioContext.close();
    }
    if (animationId) {
      cancelAnimationFrame(animationId);
    }

    startBtn.innerHTML = '<span class="btn-icon">▶</span> Start Recording';
    startBtn.classList.remove("stop");
    status.style.display = "none";

    const timeRect = timeCanvas.parentElement.getBoundingClientRect();
    const transformRect = transformCanvas.parentElement.getBoundingClientRect();

    timeCtx.clearRect(0, 0, timeRect.width, timeRect.height);
    transformCtx.clearRect(0, 0, transformRect.width, transformRect.height);
  },
};

// Event Listeners
function initializeEventListeners() {
  startBtn.addEventListener("click", () => {
    if (isRecording) {
      AudioHandler.stopAudio();
    } else {
      AudioHandler.startAudio();
    }
  });

  transformType.addEventListener("change", (e) => {
    const type = e.target.value;
    windowControl.style.display = type === "stft" ? "flex" : "none";
    transformTitle.textContent = TRANSFORM_LABELS[type];
  });

  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(resizeCanvases, 100);
  });
}

// Initialize Application
function initializeApp() {
  setupBackgroundCanvas();
  setTimeout(resizeCanvases, 100);
  initializeEventListeners();

  // Start background animation
  animateBackground();
}

document.addEventListener("DOMContentLoaded", initializeApp);
