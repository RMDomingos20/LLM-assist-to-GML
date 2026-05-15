const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

// ─── SANITIZADOR DE ARTEFATOS DE IA ──────────────────────────────────────────
const INVISIBLE_CHARS_RE = /[\u200B\u200C\u200D\uFEFF\u2060\u00AD\u2028\u2029]/g
const WIDE_SPACES_RE = /[\u00A0\u202F\u2008\u2007\u2006\u2005\u2004\u2003\u2002\u2001\u3000]/g

function sanitizeContent(content) {
  return content
    .replace(/\r\n/g, '\n')           
    .replace(/\r/g, '\n')             
    .replace(INVISIBLE_CHARS_RE, '')  
    .replace(WIDE_SPACES_RE, ' ')     
}

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged

let mainWindow

// ─── CONFIGURAÇÕES (SETTINGS) ────────────────────────────────────────────────
const settingsPath = path.join(app.getPath('userData'), 'settings.json')

function getSettings() {
  const defaultSettings = {
    modelsPath: path.join(os.homedir(), '.gml-assistant', 'models'),
    temperature: 0.3, 
    maxTokens: 2048,  
    contextSize: 4096, 
    gpuLayers: 999,
    kvCacheType: 'f16', 
    audioVolume: 0.5,           
    playIntroOnStartup: true,   
    aiMode: null, 
    onlineBaseUrl: 'https://api.openai.com/v1',
    onlineModel: 'gpt-4o-mini',
    onlineKey: ''
  }
  try {
    if (fs.existsSync(settingsPath)) {
      return { ...defaultSettings, ...JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) }
    }
  } catch (e) {}
  return defaultSettings
}

function saveSettings(settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  return true
}

ipcMain.handle('get-settings', () => getSettings())
ipcMain.handle('save-settings', (_, settings) => saveSettings(settings))

const getModelsDir = () => {
  const dir = getSettings().modelsPath
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

// ─── WINDOW ──────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1100, minHeight: 700,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    frame: false, backgroundColor: '#07090E',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
    icon: path.join(__dirname, '../../assets/icon.png').replace(/\\/g, '/'),
  })

  if (isDev) mainWindow.loadURL('http://localhost:5173')
  else mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
}

// ─── SCANNER E SANITIZADOR DE ARTEFATOS DE IA ────────────────────────────────
ipcMain.handle('scan-sanitize-project', async (_, folderPath) => {
  const results = { fixed: [], checked: 0, errors: [] }
  const CODE_EXTENSIONS = /\.(gml|fsh|vsh|txt|md)$/i
  const IGNORED_DIRS = ['node_modules', '.git', 'sounds', 'sprites', 'rooms',
    'options', 'fonts', 'paths', 'tilesets', 'animcurves', 'sequences',
    'notes', 'extensions', 'datafiles']

  const walk = (dir) => {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.includes(entry.name)) walk(full)
        } else if (CODE_EXTENSIONS.test(entry.name)) {
          results.checked++
          try {
            const original = fs.readFileSync(full, 'utf-8')
            const sanitized = sanitizeContent(original)
            if (original !== sanitized) {
              fs.copyFileSync(full, full + '.bak')
              fs.writeFileSync(full, sanitized, 'utf-8')
              results.fixed.push(
                path.relative(folderPath, full).replace(/\\/g, '/')
              )
            }
          } catch (e) {
            results.errors.push(`${entry.name}: ${e.message}`)
          }
        }
      }
    } catch {}
  }
  walk(folderPath)
  return results
})

// ─── LEITURA DE HARDWARE ─────────────────────────────────────────────────────
ipcMain.handle('get-system-specs', () => {
  return {
    totalRamGB: os.totalmem() / (1024 ** 3),
    freeRamGB: os.freemem() / (1024 ** 3),
    cpuCores: os.cpus().length
  }
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

ipcMain.on('window-minimize', () => mainWindow.minimize())
ipcMain.on('window-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize())
ipcMain.on('window-close', () => mainWindow.close())

// ─── FILE SYSTEM / PROJECTS ──────────────────────────────────────────────────
ipcMain.handle('select-project', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Selecione o arquivo do projeto GameMaker (.yyp)',
    filters: [{ name: 'GameMaker Project', extensions: ['yyp'] }]
  })
  if (result.canceled) return null
  return path.dirname(result.filePaths[0])
})

ipcMain.handle('read-project-folder', async (_, folderPath) => {
  const files = {}
  const ignoredDirs = [
    'node_modules', '.git', 'sounds', 'sprites', 'rooms',
    'options', 'fonts', 'paths', 'tilesets', 'animcurves',
    'sequences', 'notes', 'extensions', 'datafiles'
  ]

  const walk = (dir) => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = path.join(dir, entry.name)
        const rel = path.relative(folderPath, full).replace(/\\/g, '/')

        if (entry.isDirectory()) {
          if (!ignoredDirs.includes(entry.name)) walk(full)
        } else {
          if (/\.(gml|fsh|vsh|md|txt)$/.test(entry.name)) {
            if (!rel.includes('CreationCode') && !rel.includes('RoomCreationCode')) {
              try {
                const raw = fs.readFileSync(full, 'utf-8')
                const content = sanitizeContent(raw)
                if (content.trim().length > 0) {
                  files[rel] = content
                }
              } catch {}
            }
          }
        }
      }
    } catch {}
  }
  walk(folderPath)
  return files
})

ipcMain.handle('save-file', async (_, { folderPath, relativePath, content }) => {
  try {
    const fullPath = path.join(folderPath, relativePath);
    const isNewFile = !fs.existsSync(fullPath);
    
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    if (!isNewFile) fs.copyFileSync(fullPath, fullPath + '.bak');
    fs.writeFileSync(fullPath, content, 'utf-8');

    if (isNewFile) {
      let resourceType = null;
      let folderName = null;
      let baseName = null;
      let yyPath = null;
      let yyRelativePath = null;

      if (relativePath.startsWith('scripts') && relativePath.endsWith('.gml')) {
        resourceType = "GMScript";
        folderName = "Scripts";
        baseName = path.basename(relativePath, '.gml');
        yyPath = fullPath.replace(/\.gml$/, '.yy');
        yyRelativePath = relativePath.replace(/\.gml$/, '.yy').replace(/\\/g, '/');
      } 
      else if (relativePath.startsWith('notes') && relativePath.endsWith('.txt')) {
        resourceType = "GMNotes";
        folderName = "Notes";
        baseName = path.basename(relativePath, '.txt');
        yyPath = fullPath.replace(/\.txt$/, '.yy');
        yyRelativePath = relativePath.replace(/\.txt$/, '.yy').replace(/\\/g, '/');
      }

      if (resourceType) {
        const yyData = {
          [`$${resourceType}`]: "",
          "%Name": baseName,
          "name": baseName,
          "parent": {
            "name": folderName,
            "path": `folders/${folderName}.yy`
          },
          "resourceType": resourceType,
          "resourceVersion": "2.0"
        };

        if (resourceType === "GMScript") {
          yyData.isCompatibility = false;
          yyData.isDnD = false;
        }

        fs.writeFileSync(yyPath, JSON.stringify(yyData, null, 2), 'utf-8');

        const filesInRoot = fs.readdirSync(folderPath);
        const yypFilename = filesInRoot.find(f => f.endsWith('.yyp'));

        if (yypFilename) {
          const yypFullPath = path.join(folderPath, yypFilename);
          fs.copyFileSync(yypFullPath, yypFullPath + '.bak');
          
          let yypContent = fs.readFileSync(yypFullPath, 'utf-8');

          if (!yypContent.includes(`"name":"${baseName}"`)) {
            const injectionString = `"resources":[\r\n    {"id":{"name":"${baseName}","path":"${yyRelativePath}",},},`;
            yypContent = yypContent.replace(/"resources":\s*\[/, injectionString);
            fs.writeFileSync(yypFullPath, yypContent, 'utf-8');
          }
        }
      }
    }
    return { ok: true };
  } catch (e) { 
    return { ok: false, error: e.message }; 
  }
});

ipcMain.handle('delete-file', async (_, { folderPath, relativePath }) => {
  try {
    const fullPath = path.join(folderPath, relativePath);
    const ext = path.extname(relativePath);
    const baseName = path.basename(relativePath, ext);
    const yyPath = fullPath.replace(new RegExp(`${ext}$`), '.yy');

    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    if (fs.existsSync(yyPath)) fs.unlinkSync(yyPath);
    if (fs.existsSync(fullPath + '.bak')) fs.unlinkSync(fullPath + '.bak');

    const parentDir = path.dirname(fullPath);
    try {
      if (fs.readdirSync(parentDir).length === 0) {
        fs.rmdirSync(parentDir);
      }
    } catch(e) {} 

    const filesInRoot = fs.readdirSync(folderPath);
    const yypFilename = filesInRoot.find(f => f.endsWith('.yyp'));

    if (yypFilename) {
      const yypFullPath = path.join(folderPath, yypFilename);
      let yypContent = fs.readFileSync(yypFullPath, 'utf-8');

      const regex = new RegExp(`[ \\t]*\\{"id":\\{"name":"${baseName}","path":"[^"]+"\\,?\\},\\},?\\r?\\n?`, 'g');
      yypContent = yypContent.replace(regex, '');

      fs.writeFileSync(yypFullPath, yypContent, 'utf-8');
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ─── UTILS EXTERNOS ──────────────────────────────────────────────────────────
ipcMain.handle('open-external', (_, url) => shell.openExternal(url))
ipcMain.handle('open-folder', (_, folderPath) => shell.openPath(folderPath))
ipcMain.handle('select-custom-models-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})
ipcMain.handle('get-models-dir', () => getModelsDir())

// ─── CHAT API (ONLINE STREAMING) ─────────────────────────────────────────────
let onlineAbortController = null;

ipcMain.handle('ai-chat-request-stream', async (event, { baseUrl, headers, body }) => {
  try {
    onlineAbortController = new AbortController();
    const timeoutId = setTimeout(() => onlineAbortController.abort(), 120_000);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ ...body, stream: true }),
      signal: onlineAbortController.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.text();
      onlineAbortController = null;
      return { ok: false, error: `HTTP ${response.status}: ${err}` };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.trim().startsWith('data: ')) {
          const dataStr = line.replace(/^data:\s*/, '').trim();
          if (dataStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(dataStr);
            const content = parsed.choices[0]?.delta?.content || '';
            if (content) mainWindow?.webContents.send('online-llm-token', { chunk: content });
          } catch(e) {}
        }
      }
    }
    onlineAbortController = null;
    mainWindow?.webContents.send('online-llm-token', { chunk: '', done: true });
    return { ok: true };
  } catch (e) {
    onlineAbortController = null;
    if (e.name === 'AbortError') {
      mainWindow?.webContents.send('online-llm-token', { chunk: '', done: true, aborted: true });
      return { ok: false, aborted: true };
    }
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('abort-online-generation', () => {
  if (onlineAbortController) { onlineAbortController.abort(); return { ok: true }; }
  return { ok: false };
});

// ─── GERENCIADOR DE DOWNLOADS (GGUF) E OLLAMA ────────────────────────────────
// ─── GERENCIADOR DE DOWNLOADS (GGUF) E OLLAMA ────────────────────────────────
const activeDownloads = new Map();

ipcMain.handle('download-model', async (event, { modelId, downloadUrl, filename }) => {
  try {
    const modelsDir = getModelsDir();
    const destPath = path.join(modelsDir, filename);
    const tempPath = destPath + '.part'; 

    return await new Promise((resolve, reject) => {
      let downloaded = 0;
      let total = 0;
      let currentRequest = null;
      let isAborted = false;

      const https = require('https');
      const http = require('http');
      const { URL } = require('url');

      const doRequest = (currentUrl) => {
        const parsedUrl = new URL(currentUrl);
        const lib = parsedUrl.protocol === 'https:' ? https : http;

        currentRequest = lib.get(currentUrl, {
          headers: { 'User-Agent': 'GML-Assistant-Desktop/1.0' }
        }, (res) => {
          
          if (isAborted) {
            res.destroy();
            return reject(new Error('Cancelado pelo usuário'));
          }

          // Segue os redirecionamentos da Hugging Face
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            let nextUrl = res.headers.location;
            if (!nextUrl.startsWith('http')) {
              nextUrl = new URL(nextUrl, currentUrl).href;
            }
            return doRequest(nextUrl);
          }

          if (res.statusCode >= 400) {
            return reject(new Error(`Erro HTTP no servidor: ${res.statusCode}`));
          }

          total = parseInt(res.headers['content-length'] || '0', 10);
          const fileStream = fs.createWriteStream(tempPath);
          let lastUpdate = 0;

          res.on('data', (chunk) => {
            downloaded += chunk.length;
            const now = Date.now();
            if (now - lastUpdate > 100) { // Atualiza a tela sem travar o app
              const pct = total ? Math.round((downloaded / total) * 100) : -1;
              mainWindow?.webContents.send('download-progress', { modelId, pct, downloaded, total });
              lastUpdate = now;
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            if (isAborted) return;
            
            mainWindow?.webContents.send('download-progress', { modelId, pct: 100, downloaded: total, total });
            
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
            fs.renameSync(tempPath, destPath);
            
            activeDownloads.delete(modelId);
            resolve({ ok: true });
          });

          fileStream.on('error', (err) => {
            fileStream.close();
            reject(err);
          });
        }).on('error', (err) => {
          reject(err);
        });
      };

      // Função de Cancelamento Brutal
      activeDownloads.set(modelId, () => {
        isAborted = true;
        if (currentRequest) currentRequest.destroy();
        if (fs.existsSync(tempPath)) {
          try { fs.unlinkSync(tempPath); } catch (e) {}
        }
      });

      doRequest(downloadUrl);
    });
  } catch (e) {
    activeDownloads.delete(modelId);
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('cancel-download', (_, modelId) => {
  if (activeDownloads.has(modelId)) {
    const cancelFunction = activeDownloads.get(modelId);
    cancelFunction(); 
    activeDownloads.delete(modelId);
    return { ok: true };
  }
  return { ok: false };
});

ipcMain.handle('check-ollama', async () => {
  try {
     const res = await fetch('http://localhost:11434/api/tags');
     if(res.ok) {
        const data = await res.json();
        return { running: true, models: data.models || [] };
     }
     return { running: false, models: [] };
  } catch(e) { return { running: false, models: [] }; }
});

ipcMain.handle('ollama-pull', async (event, modelName) => {
  try {
    const response = await fetch('http://localhost:11434/api/pull', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName })
    });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split('\n').filter(Boolean);
      for (const line of lines) {
        const data = JSON.parse(line);
        event.sender.send('ollama-pull-progress', {
           modelName, status: data.status, completed: data.completed, total: data.total 
        });
      }
    }
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

// VARIÁVEIS DA IA E KILL SWITCH
let nativeModel = null;
let nativeContext = null;
let nativeSession = null;
let _cachedLlamaInstance = null;
let generationAbortController = null;
let forceStopNative = false;
let lastContextParams = null;

async function createLlamaInstance() {
  if (_cachedLlamaInstance) return _cachedLlamaInstance;
  const { getLlama, LlamaLogLevel } = await import('node-llama-cpp');
  const backends = [
    { name: 'cuda',   gpu: 'cuda'   }, 
    { name: 'vulkan', gpu: 'vulkan' }, 
    { name: 'cpu',    gpu: false    }, 
  ];
  for (const backend of backends) {
    try {
      _cachedLlamaInstance = await getLlama({ gpu: backend.gpu, logLevel: LlamaLogLevel.error });
      return _cachedLlamaInstance;
    } catch (err) {}
  }
  throw new Error('Nenhum backend disponível (cuda/vulkan/cpu falharam).');
}

ipcMain.handle('start-native-model', async (_, { modelPath, contextSize, gpuLayers, kvCacheType }) => {
  try {
    nativeSession = null
    if (nativeContext) { try { await nativeContext.dispose() } catch {} nativeContext = null }
    if (nativeModel)   { try { await nativeModel.dispose()   } catch {} nativeModel   = null }

    const llama        = await createLlamaInstance()
    const effectiveCtx = (contextSize && contextSize > 0) ? contextSize : 4096

    const tryLoad = async (layers, useFA, typeKV) => {
      let tempModel = null;
      let tempCtx   = null;
      try {
        tempModel = await llama.loadModel({
          modelPath,
          gpuLayers: layers,
          useMmap:   true,
        })
        tempCtx = await tempModel.createContext({
          contextSize:    effectiveCtx,
          flashAttention: useFA,
          threads:        Math.max(1, os.cpus().length - 1),
          batchSize:      512,
          typeK:          typeKV,
          typeV:          typeKV
        })
        return { model: tempModel, ctx: tempCtx }
      } catch (e) {
        if (tempCtx)   await tempCtx.dispose().catch(()=>{});
        if (tempModel) await tempModel.dispose().catch(()=>{});
        throw e;
      }
    }

    let result;
    let warning = null;
    let fallbackKvType = kvCacheType || 'f16';

    try {
      result = await tryLoad(gpuLayers, true, fallbackKvType);
    } catch (e1) {
      console.warn(`[AI] Tentativa 1 (GPU + ${fallbackKvType}) falhou:`, e1.message);
      try {
        fallbackKvType = 'f16';
        result = await tryLoad(gpuLayers, false, 'f16');
        warning = "Otimizações de KV Cache falharam ou não são compatíveis com sua placa. Carregando no modo padrão (F16).";
      } catch (e2) {
        console.warn('[AI] Tentativa 2 (GPU Safe) falhou:', e2.message);
        result  = await tryLoad(0, false, 'f16');
        warning = "Sem memória de Vídeo (VRAM) suficiente ou GPU incompatível. O modelo foi carregado usando apenas o Processador (CPU). Ficará mais lento.";
      }
    }

    nativeModel   = result.model;
    nativeContext = result.ctx;

    lastContextParams = {
      effectiveCtx: effectiveCtx,
      typeKV: fallbackKvType,
    };

    return {
      ok:          true,
      contextSize: nativeContext.contextSize,
      warning:     warning
    }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('reset-native-session', () => { nativeSession = null; return { ok: true }; });

// KILL SWITCH: para geração + libera GPU fazendo dispose do contexto atual
ipcMain.handle('abort-native-generation', async () => {
  forceStopNative = true;
  if (generationAbortController) generationAbortController.abort();

  // Descarta sessão e contexto para realmente parar o kernel C++
  // e liberar RAM/VRAM do processamento em andamento.
  nativeSession = null;
  if (nativeContext) {
    const oldCtx = nativeContext;
    nativeContext = null; // marca como null ANTES do dispose assíncrono
    oldCtx.dispose().catch(() => {});

    // Recria um contexto limpo a partir do modelo já em memória,
    // assim a próxima mensagem não exige recarregar o modelo inteiro.
    if (nativeModel && lastContextParams) {
      try {
        nativeContext = await nativeModel.createContext({
          contextSize:    lastContextParams.effectiveCtx,
          flashAttention: false,
          threads:        Math.max(1, os.cpus().length - 1),
          batchSize:      512,
          typeK:          lastContextParams.typeKV,
          typeV:          lastContextParams.typeKV,
        });
      } catch (e) {
        // Se falhar, usuário precisará recarregar — não é crítico
        nativeContext = null;
      }
    }
  }

  return { ok: true };
});

// Descarrega modelo completamente da RAM/VRAM (botão "Desligar IA")
ipcMain.handle('unload-native-model', async () => {
  forceStopNative = true;
  if (generationAbortController) generationAbortController.abort();

  nativeSession = null;
  if (nativeContext) { try { await nativeContext.dispose() } catch {} nativeContext = null; }
  if (nativeModel)   { try { await nativeModel.dispose()   } catch {} nativeModel   = null; }
  lastContextParams = null;
  forceStopNative = false;

  return { ok: true };
});

ipcMain.handle('chat-native-model-stream', async (_, { systemPrompt, userPrompt, temperature, maxTokens }) => {
  try {
    if (!nativeContext) throw new Error("Modelo local não carregado.");
    const { LlamaChatSession } = await import('node-llama-cpp');

    if (!nativeSession) {
      nativeSession = new LlamaChatSession({
        contextSequence: nativeContext.getSequence(),
        systemPrompt,
      });
    }

    generationAbortController = new AbortController();
    const signal = generationAbortController.signal;
    let fullText = '';
    
    forceStopNative = false; // Reseta o Kill Switch antes de começar

    await nativeSession.prompt(userPrompt, {
      signal,
      temperature:   temperature ?? 0.3,
      maxTokens:     maxTokens === -1 ? undefined : (maxTokens || 2048),
      
      repeatPenalty: 1.08,
      topK:          40,
      topP:          0.90,
      minP:          0.05, 

      stopOn: ["User:", "Human:", "\n\n\n\n\n", "```\n```", "</file>\n<file"], 

      onTextChunk: (chunk) => {
        // KILL SWITCH: Força o motor C++ a engolir um erro de JavaScript e parar o Loop
        if (forceStopNative || signal.aborted) {
            throw new Error('FORCED_STOP');
        }

        fullText += chunk;
        mainWindow?.webContents.send('llm-token', { chunk });
      },
    });

    generationAbortController = null;
    mainWindow?.webContents.send('llm-token', { chunk: '', done: true });
    return { ok: true, data: fullText };
  } catch (err) {
    generationAbortController = null;
    
    // Tratando o Kill Switch de forma silenciosa para o usuário
    if (err.message === 'FORCED_STOP' || err.name === 'AbortError' || err.message?.includes('aborted')) {
      mainWindow?.webContents.send('llm-token', { chunk: '', done: true, aborted: true });
      return { ok: false, aborted: true, data: '' };
    }
    
    if (/context|sequence|full/i.test(err.message)) {
      nativeSession = null;
      mainWindow?.webContents.send('llm-token', { chunk: '', done: true, error: 'Contexto cheio — sessão reiniciada.' });
      return { ok: false, error: 'Contexto cheio.' };
    }
    
    mainWindow?.webContents.send('llm-token', { chunk: '', done: true, error: err.message });
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('list-local-models', () => {
  const dir = getModelsDir()
  try {
    return fs.readdirSync(dir).filter(f => f.endsWith('.gguf')).map(f => {
      const full = path.join(dir, f); const stat = fs.statSync(full);
      return { name: f, path: full, size: stat.size, mtime: stat.mtime }
    })
  } catch { return [] }
})

ipcMain.handle('delete-local-model', (_, p) => { 
  try { 
    fs.unlinkSync(p); 
    return { ok: true }; 
  } catch(e) { 
    return { ok: false }; 
  } 
})