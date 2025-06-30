# Signal Processing Analyzer

A real-time audio signal analyzer with various signal processing transforms, built with Web Audio API.

Live site: [**audio-transforms.netlify.app**](https://audio-transforms.netlify.app)

## Features

- Real-time audio visualization from microphone input
- Multiple signal processing transforms:
  - Fast Fourier Transform (FFT)
  - Power Spectral Density
  - Autocorrelation
  - Cepstrum
  - Short-Time Fourier Transform (STFT)
  - Envelope Detection
  - Zero Crossing Rate
- Glassmorphism UI with dynamic audio waveform background
- Responsive design for desktop and mobile devices

## Installation

1. Clone or download the repository
2. Ensure all three files are in the same directory:
   - `index.html`
   - `styles.css`
   - `app.js`
3. Open `index.html` in a web browser

## Usage

1. Click "Start Recording" to begin audio capture
2. Select a transform type from the dropdown menu
3. View real-time audio signal (top graph) and selected transform (bottom graph)
4. For STFT, adjust the window size parameter as needed
5. Click "Stop" to end recording

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (iOS 14.5+)

## License

MIT License
