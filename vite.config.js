import { defineConfig } from 'vite';
import { canvasBridge } from './src/server/canvas-bridge.js';

export default defineConfig({ plugins: [canvasBridge()] });
