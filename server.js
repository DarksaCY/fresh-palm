const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const express = require('express');
const multer = require('multer');

const PORT = process.env.PORT || 7373;
const PALM_SYNC_CLI = path.join(__dirname, 'vendor', 'palm-sync', 'dist', 'bin', 'cli.js');
const UPLOAD_DIR = path.join(__dirname, 'data', 'uploads');
const PULL_DIR = path.join(__dirname, 'data', 'pulled');
const PALM_USB_ID = { vendor: '0830', product: '0002' }; // Palm m505

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(PULL_DIR, { recursive: true });

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/pulled', express.static(PULL_DIR));

const upload = multer({ dest: UPLOAD_DIR });

function runPalmSync(args, { timeoutMs = 20000 } = {}) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [PALM_SYNC_CLI, ...args],
      { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          resolve({
            ok: false,
            timedOut: error.killed === true,
            error: error.message,
            stdout,
            stderr,
          });
        } else {
          resolve({ ok: true, stdout, stderr });
        }
      }
    );
  });
}

function isVisorLoaded(cb) {
  execFile('lsmod', [], (error, stdout) => {
    cb(!error && /^visor\s/m.test(stdout));
  });
}

app.get('/api/mode', (req, res) => {
  isVisorLoaded((visorLoaded) => {
    res.json({
      mode: visorLoaded ? 'net' : 'sync',
      visorLoaded,
    });
  });
});

function trySudoModprobe(args, res) {
  execFile('sudo', ['-n', 'modprobe', ...args], (error, stdout, stderr) => {
    if (error) {
      const manualCmd = `sudo modprobe ${args.join(' ')}`;
      return res.json({
        ok: false,
        needsManualSudo: true,
        manualCommand: manualCmd,
        error: stderr || error.message,
      });
    }
    isVisorLoaded((visorLoaded) => {
      res.json({ ok: true, mode: visorLoaded ? 'net' : 'sync', visorLoaded });
    });
  });
}

app.post('/api/mode/sync', (req, res) => trySudoModprobe(['-r', 'visor'], res));
app.post('/api/mode/net', (req, res) => trySudoModprobe(['visor'], res));

app.get('/api/status', (req, res) => {
  execFile('lsusb', [], (error, stdout) => {
    const usbPresent = !error && stdout.includes(`${PALM_USB_ID.vendor}:${PALM_USB_ID.product}`);
    res.json({
      usbPresent,
      cliBuilt: fs.existsSync(PALM_SYNC_CLI),
      time: new Date().toISOString(),
    });
  });
});

app.post('/api/palm/info', async (req, res) => {
  const result = await runPalmSync(['--usb', 'info'], { timeoutMs: 25000 });
  res.json(result);
});

app.post('/api/palm/list', async (req, res) => {
  const result = await runPalmSync(['--usb', 'list'], { timeoutMs: 25000 });
  res.json(result);
});

app.post('/api/palm/pull', async (req, res) => {
  const names = Array.isArray(req.body?.names) ? req.body.names : [];
  const result = await runPalmSync(['--usb', 'pull', '--outputDir', PULL_DIR, ...names], {
    timeoutMs: 60000,
  });
  const files = fs.existsSync(PULL_DIR) ? fs.readdirSync(PULL_DIR) : [];
  res.json({ ...result, files });
});

app.post('/api/palm/push', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No file uploaded' });
  }
  const result = await runPalmSync(['--usb', 'push', req.file.path], { timeoutMs: 60000 });
  fs.unlink(req.file.path, () => {});
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`fresh-palm dashboard: http://localhost:${PORT}`);
});
