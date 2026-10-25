import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  runAutoFramingAndPackagingAgent,
  runCloudVideoExportAgent,
  runCreatorStudioChatAgent,
  runEnhancedSurgicalCutAgent,
  runQACriticAndSelfHealAgent,
  runTrendAndScoutAgent,
  runTrendRadarAgent,
} from './src/services/shortsAgents.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'YouTubeShortsAgent', model: 'gemini-4-argon' });
  });

  app.post('/api/trends/radar', async (req, res) => {
    try {
      const { nicheHint } = req.body || {};
      const radar = await runTrendRadarAgent({
        nicheHint: String(nicheHint || 'Tech Podcasts & Creator Storytelling'),
      });
      res.json({ radar });
    } catch (err: any) {
      res.status(500).json({
        error:
          err?.message ||
          'Could not check weekly YouTube trends right now. Please try again.',
      });
    }
  });

  app.post('/api/agents/scout', async (req, res) => {
    try {
      const {
        youtubeUrl,
        uploadedFileBase64,
        uploadedFileName,
        mimeType,
        nicheHint,
      } = req.body || {};

      if (!youtubeUrl && !uploadedFileBase64) {
        res.status(400).json({
          error: 'Please paste a YouTube link or drop an MP4/MPEG video file.',
        });
        return;
      }

      const candidates = await runTrendAndScoutAgent({
        youtubeUrl,
        uploadedFileBase64,
        uploadedFileName,
        mimeType,
        nicheHint,
      });

      res.json({ candidates });
    } catch (err: any) {
      res.status(500).json({
        error: err?.message || 'Moment Finder encountered an issue analyzing the video.',
      });
    }
  });

  app.post('/api/agents/surgical-cut', async (req, res) => {
    try {
      const { candidate, youtubeUrl, mimeType } = req.body || {};

      if (!candidate || !candidate.id) {
        res.status(400).json({
          error: 'Please pick a story moment first.',
        });
        return;
      }

      const updatedCandidate = await runEnhancedSurgicalCutAgent({
        candidate,
        youtubeUrl,
        mimeType,
      });

      res.json({ candidate: updatedCandidate });
    } catch (err: any) {
      res.status(500).json({
        error:
          err?.message ||
          'Fluff Snipper encountered an issue preparing your word bubbles.',
      });
    }
  });

  app.post('/api/agents/auto-frame', async (req, res) => {
    try {
      const { candidate } = req.body || {};

      if (!candidate || !candidate.id) {
        res.status(400).json({
          error: 'Please pick a story moment first.',
        });
        return;
      }

      const updatedCandidate = await runAutoFramingAndPackagingAgent({
        candidate,
      });

      res.json({ candidate: updatedCandidate });
    } catch (err: any) {
      res.status(500).json({
        error:
          err?.message ||
          'Camera & Hook Styler encountered an issue framing your 9:16 Short.',
      });
    }
  });

  app.post('/api/agents/qa-critic', async (req, res) => {
    try {
      const { candidate } = req.body || {};

      if (!candidate || !candidate.id) {
        res.status(400).json({
          error: 'Please pick a story moment first.',
        });
        return;
      }

      const updatedCandidate = await runQACriticAndSelfHealAgent({
        candidate,
      });

      res.json({ candidate: updatedCandidate });
    } catch (err: any) {
      res.status(500).json({
        error:
          err?.message ||
          'Quality Polish encountered an issue checking your Short.',
      });
    }
  });

  app.post('/api/agents/export-short', async (req, res) => {
    try {
      const { candidate } = req.body || {};

      if (!candidate || !candidate.id) {
        res.status(400).json({
          error: 'Please select a Short before exporting.',
        });
        return;
      }

      const exportResult = await runCloudVideoExportAgent({
        candidate,
      });

      res.json({ exportResult });
    } catch (err: any) {
      res.status(500).json({
        error:
          err?.message ||
          'Cloud Video Exporter encountered an issue rendering your Short.',
      });
    }
  });

  app.post('/api/agents/chat', async (req, res) => {
    try {
      const {
        userMessage,
        currentRoute,
        youtubeUrl,
        nicheHint,
        candidatesSummary,
        selectedMomentIndex,
      } = req.body || {};

      if (!userMessage || typeof userMessage !== 'string') {
        res.status(400).json({ error: 'Please type a message for your agent.' });
        return;
      }

      const chatResult = await runCreatorStudioChatAgent({
        userMessage,
        currentRoute,
        youtubeUrl,
        nicheHint,
        candidatesSummary,
        selectedMomentIndex,
      });

      res.json(chatResult);
    } catch (err: any) {
      res.status(500).json({
        error:
          err?.message ||
          'Your studio agent encountered an issue responding. Please try again.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`YouTubeShortsAgent server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
