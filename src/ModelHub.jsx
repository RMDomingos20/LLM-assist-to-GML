import { useState, useEffect, useCallback, useRef } from 'react'
import { C, KNOWN_MODELS, formatBytes } from './constants.js'

const SOURCE_LABELS = {
  huggingface: { label: 'Hugging Face', color: '#FF9A3C', icon: '🤗' },
  ollama:      { label: 'Ollama',        color: '#4CAF50', icon: '🦙' },
  lmstudio:    { label: 'LM Studio',     color: '#4A9EFF', icon: '🖥'  },
  local:       { label: 'Local',         color: '#9B8AFF', icon: '💾'  },
}

const RAM_COLOR  = (gb) => gb == null ? C.textMuted : gb <= 4 ? C.success : gb <= 8 ? C.warning : C.danger
const FMT_SIZE   = (gb) => gb != null ? `${gb} GB`  : 'N/A'
const FMT_RAM    = (gb) => gb != null ? `${gb}+ GB` : 'N/A'
const FMT_CTX    = (k)  => k  != null && k !== '?'  ? `${k}k`  : '8k' 

function guessFromFilename(filename = '', repoId = '') {
  const lowerFile = (filename || '').toLowerCase()
  const lowerRepo = (repoId || '').toLowerCase()
  const fullStr = `${lowerFile} ${lowerRepo}`

  const qMatch = fullStr.match(/[qi](\d)[\._]/i)
  const bits   = qMatch ? parseInt(qMatch[1]) : 4

  const pMatch = fullStr.match(/(\d+(?:\.\d+)?)b\b/i)
  const params = pMatch ? parseFloat(pMatch[1]) : null

  let sizeGB = null
  let ramGB  = null
  
  if (params) {
    sizeGB = parseFloat((params * bits / 8 * 1.1).toFixed(1))
    ramGB  = Math.ceil(sizeGB * 1.2)
  }
  
  const quant = lowerFile.match(/[qi]\d[_k]?[ms]?/i)?.[0]?.toUpperCase() || 'GGUF'
  return { sizeGB, ramGB, quant }
}

function makeLocalEntry(localFile) {
  const { sizeGB, ramGB, quant } = guessFromFilename(localFile.name, '')
  const fileSizeGB = parseFloat((localFile.size / 1073741824).toFixed(1))
  return {
    id:           `local:${localFile.name}`,
    name:         localFile.name.replace(/\.gguf$/i, '').replace(/[-_]/g, ' '),
    fullId:       localFile.name,
    family:       localFile.name.split('-')[0],
    source:       'local',
    hfRepo:       null,
    filename:     localFile.name,
    sizeGB:       fileSizeGB || sizeGB,
    ramGB:        ramGB,
    contextK:     null,
    quantization: quant,
    description:  `Modelo instalado localmente. Arquivo: ${localFile.name}`,
    tags:         ['local', 'instalado'],
    recommended:  false,
    isOrphan:     true,   
    localPath:    localFile.path,
  }
}

function ModelCard({ model, localModels, downloads, ollamaModels, onDownload, onUse, onDelete, sysSpecs }) {
  const src        = SOURCE_LABELS[model.source] || SOURCE_LABELS.huggingface
  const dlState    = downloads[model.id]
  const localMatch = localModels.find(m => m.name === model.filename)
  const ollamaMatch = ollamaModels.find(m =>
    m.name?.startsWith(model.ollamaName) || m.model?.startsWith(model.ollamaName)
  )
  const isLocal       = model.isOrphan || (model.source === 'ollama' ? !!ollamaMatch : !!localMatch)
  const isDownloading = !!dlState && dlState.pct < 100

  // Recomendação Dinâmica Baseada em Hardware: se precisa de <= 80% da RAM total
  const hardwareRecommended = sysSpecs && model.ramGB && (model.ramGB <= (sysSpecs.totalRamGB * 0.8))

  return (
    <div style={{
      /* CULLING: Impede o navegador de renderizar e calcular layout de cards fora da tela */
      contentVisibility: 'auto',
      containIntrinsicSize: '280px',
      
      background: C.elevated,
      border: `1px solid ${model.recommended ? C.accent + '55' : isLocal ? C.success + '44' : C.border}`,
      borderRadius: 12, padding: '16px',
      display: 'flex', flexDirection: 'column', gap: 10,
      position: 'relative', transition: 'border-color 0.2s',
      height: '100%',
    }}>
      {/* Selo Global */}
      {model.recommended && (
        <div style={{
          position: 'absolute', top: -1, right: 14,
          background: C.accent, borderRadius: '0 0 6px 6px',
          padding: '2px 8px', fontSize: 9, fontWeight: 700,
          color: '#000', letterSpacing: '0.05em',
        }}>★ SELEÇÃO GML</div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
          background: src.color + '20', border: `1px solid ${src.color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>{src.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={model.name}>
            {model.name}
          </div>
          <div style={{ fontSize: 10, color: src.color }}>
            {src.label} · {model.quantization || 'GGUF'}
          </div>
        </div>
        {isLocal && (
          <div style={{
            fontSize: 10, color: C.success, background: C.successDim,
            border: `1px solid ${C.success}44`, borderRadius: 5, padding: '2px 7px', flexShrink: 0,
          }}>✓ Instalado</div>
        )}
      </div>

      {/* Description */}
      <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5, height: 36, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }} title={model.description}>
        {model.description}
      </div>

      {/* Specs row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Pill label="💾"    value={FMT_SIZE(model.sizeGB)} color={C.blue} />
        <Pill label="🧠 Memória (RAM/VRAM)" value={FMT_RAM(model.ramGB)}   color={RAM_COLOR(model.ramGB)} />
        <Pill label="📐 ctx" value={FMT_CTX(model.contextK)} color={C.teal} />
      </div>

      {/* Recomendação de Hardware (Selo Verde Extra) */}
      {!isLocal && hardwareRecommended && (
         <div style={{ fontSize: 10, color: C.success, background: C.successDim, border: `1px dashed ${C.success}44`, borderRadius: 4, padding: '4px 8px', textAlign: 'center', fontWeight: 'bold' }}>
           ⚡ Seguro para sua RAM
         </div>
      )}
      {!isLocal && !hardwareRecommended && model.ramGB && sysSpecs && (
         <div style={{ fontSize: 10, color: C.danger, background: C.dangerDim, border: `1px dashed ${C.danger}44`, borderRadius: 4, padding: '4px 8px', textAlign: 'center' }}>
           ⚠️ Pode esgotar sua memória e travar
         </div>
      )}

      {/* Download progress */}
      {isDownloading && (
        <div style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMuted, marginBottom: 4 }}>
            <span>Baixando... {dlState.pct >= 0 ? `${dlState.pct}%` : ''}</span>
            <span>{formatBytes(dlState.downloaded)} / {formatBytes(dlState.total)}</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: C.border, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2, background: C.teal,
              width: dlState.pct >= 0 ? `${dlState.pct}%` : '40%',
              transition: 'width 0.3s',
              animation: dlState.pct < 0 ? 'indeterminate 1.5s infinite' : 'none',
            }} />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
        {isLocal ? (
          <>
            <button onClick={() => onUse(model)} style={{
              flex: 1, padding: '8px 0',
              background: C.accentDim, border: `1px solid ${C.accent}55`,
              borderRadius: 8, color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>▶ Usar este modelo</button>
            {!model.isOrphan && localMatch && (
              <button onClick={() => onDelete(model, localMatch)} style={{
                padding: '8px 12px', background: C.dangerDim, border: `1px solid ${C.danger}44`,
                borderRadius: 8, color: C.danger, fontSize: 12, cursor: 'pointer',
              }}>🗑</button>
            )}
            {model.isOrphan && (
              <button onClick={() => onDelete(model, { name: model.filename, path: model.localPath })} style={{
                padding: '8px 12px', background: C.dangerDim, border: `1px solid ${C.danger}44`,
                borderRadius: 8, color: C.danger, fontSize: 12, cursor: 'pointer',
              }}>🗑</button>
            )}
          </>
        ) : isDownloading ? (
          <button onClick={() => onDownload(model, 'cancel')} style={{
            flex: 1, padding: '8px 0', background: C.dangerDim, border: `1px solid ${C.danger}44`,
            borderRadius: 8, color: C.danger, fontSize: 12, cursor: 'pointer',
          }}>✕ Cancelar</button>
        ) : (
          <button onClick={() => onDownload(model)} style={{
            flex: 1, padding: '8px 0', background: C.tealDim, border: `1px solid ${C.teal}55`,
            borderRadius: 8, color: C.teal, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>⬇ {model.source === 'ollama' ? 'Instalar via Ollama' : 'Baixar Modelo'}</button>
        )}
      </div>
    </div>
  )
}

function Pill({ label, value, color }) {
  return (
    <div style={{
      fontSize: 11, background: color + '15',
      border: `1px solid ${color}33`, borderRadius: 5,
      padding: '2px 8px', color,
    }}>
      {label} {value}
    </div>
  )
}

async function searchHuggingFace(query) {
  try {
    const fetchLimit = 500;
    
    const url = query === 'trending' 
      ? `https://huggingface.co/api/models?filter=gguf&limit=${fetchLimit}&sort=downloads&direction=-1`
      : `https://huggingface.co/api/models?search=${encodeURIComponent(query + ' GGUF')}&filter=gguf&limit=${fetchLimit}&sort=downloads&direction=-1`
      
    const res  = await fetch(url)
    let data = await res.json()
    
    data = data.filter(m => {
      const task = (m.pipeline_tag || '').toLowerCase()
      const id = m.id.toLowerCase()
      if (task.includes('image') || task.includes('video') || task.includes('audio') || 
          task.includes('speech') || task.includes('3d') || task === 'feature-extraction' || 
          task === 'sentence-similarity') return false
      if (id.includes('flux') || id.includes('diffusion') || id.includes('sdxl') || 
          id.includes('midjourney') || id.includes('whisper') || id.includes('tts')) return false
      return true
    })

    return data.map(m => {
      const ggufFiles = m.siblings?.filter(s => s.rfilename.endsWith('.gguf')) || []
      const suggestedFile = ggufFiles.find(s => s.rfilename.toLowerCase().includes('q4_k_m')) || ggufFiles[0]
      const suggestedFilename = suggestedFile ? suggestedFile.rfilename : ''

      const { sizeGB, ramGB } = guessFromFilename(suggestedFilename, m.id)

      let ctxK = null;
      const allTextData = `${m.id} ${(m.tags || []).join(' ')}`.toLowerCase();
      
      const ctxMatch = allTextData.match(/(\d+)k/); 
      if (ctxMatch) {
        ctxK = parseInt(ctxMatch[1]);
      } else if (allTextData.includes('llama-3.1') || allTextData.includes('llama-3.2') || allTextData.includes('llama-3.3')) {
        ctxK = 128; 
      } else if (allTextData.includes('qwen2.5')) {
        ctxK = 32;  
      } else if (allTextData.includes('mistral') || allTextData.includes('mixtral')) {
        ctxK = 32;
      } else if (allTextData.includes('phi-3')) {
        ctxK = 128;
      } else {
        ctxK = 8; 
      }

      let desc = m.cardData?.summary || m.cardData?.description;
      if (!desc) {
        const isCoder = m.id.toLowerCase().includes('code');
        let task = m.pipeline_tag || 'Inteligência Artificial';
        if (task === 'text-generation') task = 'Geração de Texto';
        else if (task === 'conversational') task = 'IA Conversacional';
        desc = `Modelo de ${task} ${isCoder ? 'otimizado para programação. ' : ''}Criado por ${m.id.split('/')[0]}.`;
      }
      desc = desc.replace(/[\[\]*#_]/g, '').trim();

      return {
        id:           `hf:${m.id}:${Date.now()}`,
        name:         m.id.split('/').pop().replace(/-/g, ' '),
        fullId:       m.id,
        family:       m.id.split('/')[0],
        source:       'huggingface',
        hfRepo:       m.id,
        filename:     null, 
        siblings:     ggufFiles,
        sizeGB:       sizeGB,
        ramGB:        ramGB,
        contextK:     ctxK,
        quantization: suggestedFilename ? suggestedFilename.match(/[qi]\d[_k]?[ms]?/i)?.[0]?.toUpperCase() || 'GGUF' : 'GGUF',
        description:  desc,
        tags:         (m.tags?.filter(t => !t.startsWith('license') && !t.startsWith('arxiv') && !t.includes('gguf')).slice(0, 3) || []).map(String),
        downloads:    m.downloads || 0,
        recommended:  false,
        isSearchResult: true,
      }
    })
  } catch { return [] }
}

async function searchOllama(query) {
  return KNOWN_MODELS.filter(m =>
    m.source === 'ollama' && (
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.tags.some(t => String(t).includes(query.toLowerCase()))
    )
  )
}

function FilePicker({ model, onPick, onClose }) {
  const q4       = model.siblings.find(s => s.rfilename.toLowerCase().includes('q4_k_m'))
  const suggested = q4 || model.siblings[0]

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000000CC',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 14, padding: 24, width: 480, maxWidth: '95vw',
        maxHeight: '70vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>Escolher arquivo GGUF</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>{model.fullId} — {model.siblings.length} arquivo(s)</div>
        <div style={{ overflowY: 'auto', flex: 1, scrollbarWidth: 'thin' }}>
          {model.siblings.map((s, i) => {
            const isSuggested = s.rfilename === suggested?.rfilename
            const { sizeGB } = guessFromFilename(s.rfilename, '')
            return (
              <button key={i} onClick={() => onPick(model, s.rfilename)} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', marginBottom: 6,
                background: isSuggested ? C.accentDim : C.elevated, border: `1px solid ${isSuggested ? C.accent + '55' : C.border}`,
                borderRadius: 8, cursor: 'pointer', textAlign: 'left',
              }}>
                <span style={{ fontSize: 12, color: C.teal, fontFamily: 'monospace', flex: 1 }}>{s.rfilename}</span>
                <span style={{ fontSize: 11, color: C.textMuted, marginRight: 8 }}>{sizeGB ? `${sizeGB}GB` : ''}</span>
                {isSuggested && <span style={{ fontSize: 10, color: C.accent, fontWeight: 600 }}>★ Sugerido</span>}
              </button>
            )
          })}
        </div>
        <button onClick={onClose} style={{ marginTop: 14, padding: '8px 0', background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, color: C.textMuted, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
      </div>
    </div>
  )
}

function StatusBadge({ label, running, count, unit = 'modelo(s)' }) {
  return (
    <div style={{
      fontSize: 10, borderRadius: 5, padding: '3px 8px',
      background: running ? C.successDim : C.dangerDim,
      border: `1px solid ${running ? C.success + '44' : C.danger + '44'}`,
      color: running ? C.success : C.danger,
    }}>
      {running ? '●' : '○'} {label}{running && count > 0 ? ` (${count} ${unit})` : ''}
    </div>
  )
}

export default function ModelHub({ onUseModel, onClose, downloads, setDownloads }) {
  const [query,        setQuery]        = useState('')
  const [results,      setResults]      = useState(KNOWN_MODELS)
  const [isSearching,  setIsSearching]  = useState(false)
  const [tab,          setTab]          = useState('all') 
  const [localModels,  setLocalModels]  = useState([])
  const [ollamaModels, setOllamaModels] = useState([])
  const [ollamaRunning,setOllamaRunning]= useState(false)
  const [filePicker,   setFilePicker]   = useState(null)
  const [status,       setStatus]       = useState('')
  const [sysSpecs,     setSysSpecs]     = useState(null)

  // Infinite Scroll States
  const INITIAL_COUNT = 15;
  const BATCH_SIZE = 15;
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const observerTarget = useRef(null);

  useEffect(() => { 
    refreshLocal(); 
    checkBackends();
    // Busca os specs do PC
    if (window.electron.getSystemSpecs) {
      window.electron.getSystemSpecs().then(s => setSysSpecs(s));
    }
  }, [])

  const refreshLocal = async () => {
    const models = await window.electron?.listLocalModels() || []
    setLocalModels(models)
  }

  const checkBackends = async () => {
    const ollama = await window.electron?.checkOllama?.()
    setOllamaRunning(ollama?.running || false)
    setOllamaModels(ollama?.models || [])
  }

  const doSearch = useCallback(async (q) => {
    setIsSearching(true)
    setStatus('Pesquisando centenas de modelos...')
    setVisibleCount(INITIAL_COUNT) 
    
    const actualQuery = q.trim() ? q.trim() : 'trending'
    const [hf, ol] = await Promise.all([searchHuggingFace(actualQuery), searchOllama(q.trim())])
    
    const known = KNOWN_MODELS.filter(m =>
      q.trim() === '' || m.name.toLowerCase().includes(q.toLowerCase()) || m.tags.some(t => String(t).includes(q.toLowerCase()))
    )
    
    setResults([...known, ...ol, ...hf.filter(r => !known.find(k => k.hfRepo === r.hfRepo))])
    setStatus(q.trim() ? `${hf.length + ol.length} resultados encontrados` : `Exibindo top ${hf.length} modelos globais`)
    setIsSearching(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 500)
    return () => clearTimeout(t)
  }, [query, doSearch])

  const knownFilenames  = KNOWN_MODELS.map(m => m.filename).filter(Boolean)
  const resultFilenames = results.map(m => m.filename).filter(Boolean)
  const orphanLocals    = localModels.filter(l => !resultFilenames.includes(l.name)).map(makeLocalEntry)

  const baseList = [...results, ...orphanLocals]

  const filtered = baseList.filter(m => {
    if (tab === 'all') return true
    if (tab === 'local') return (m.recommended || m.isOrphan || localModels.some(l => l.name === m.filename) || ollamaModels.some(o => o.name?.startsWith(m.ollamaName) || o.model?.startsWith(m.ollamaName)))
    return m.source === tab
  })

  const visibleModels = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Lógica do Infinite Scroll Invisível
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount(prev => prev + BATCH_SIZE);
        }
      },
      { threshold: 0.1 }
    );
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    return () => observer.disconnect();
  }, [hasMore]);

  const totalInstalled = localModels.length + ollamaModels.length

  const handleDownload = async (model, action) => {
    if (action === 'cancel') {
      await window.electron?.cancelDownload(model.id)
      setDownloads(prev => { const n = { ...prev }; delete n[model.id]; return n })
      return
    }
    if (model.source === 'ollama') {
      if (!ollamaRunning) { setStatus('⚠ Ollama não está rodando.'); return }
      setDownloads(prev => ({ ...prev, [model.id]: { modelId: model.id, pct: -1, downloaded: 0, total: 0 } }))
      window.electron?.ollamaPull(model.ollamaName)
      return
    }
    if (model.isSearchResult && !model.filename) { setFilePicker(model); return }
    
    const filename    = model.filename
    const downloadUrl = `https://huggingface.co/${model.hfRepo}/resolve/main/${filename}?download=true`
    
    setDownloads(prev => ({ ...prev, [model.id]: { modelId: model.id, pct: 0, downloaded: 0, total: 0 } }))
    
    window.electron?.downloadModel({ modelId: model.id, downloadUrl, filename }).then(async (result) => {
      if (result?.ok) { 
        setStatus(`✅ ${filename} baixado com sucesso!`)
        await refreshLocal() 
      } else { 
        setStatus(`❌ Erro: ${result?.error}`) 
      }
      setTimeout(() => {
        setDownloads(prev => { const n = { ...prev }; delete n[model.id]; return n })
      }, 3000)
    })
  }

  const handleFilePick = async (model, filename) => {
    setFilePicker(null)
    
    // Atualiza a lista na tela imediatamente para saber qual arquivo este card baixou
    setResults(prev => prev.map(m => m.id === model.id ? { ...m, filename } : m))
    
    // Inicia o download mantendo o ID original para a barra de progresso não sumir
    await handleDownload({ ...model, filename })
  }

  const handleUse = (model) => {
    if (model.isOrphan) {
      onUseModel({ key: model.id, label: model.name, isNative: true, localPath: model.localPath, contextWindow: model.contextK ? model.contextK * 1000 : 4096, maxOutput: 8000, color: '#9B8AFF' })
      onClose()
      return
    }
    const localMatch  = localModels.find(m => m.name === model.filename)
    const ollamaMatch = ollamaModels.find(m => m.name?.startsWith(model.ollamaName) || m.model?.startsWith(model.ollamaName))

    if (model.source === 'ollama') {
      onUseModel({ key: model.id, label: model.name, provider: 'openai-compat', baseURL: 'http://localhost:11434/v1', modelName: ollamaMatch?.name || model.ollamaName, contextWindow: model.contextK ? model.contextK * 1000 : 4096, maxOutput: 8000, color: '#4CAF50' })
    } else {
      onUseModel({ key: model.id, label: model.name, isNative: true, localPath: localMatch?.path, contextWindow: model.contextK ? model.contextK * 1000 : 4096, maxOutput: 8000, color: '#4A9EFF' })
    }
    onClose()
  }

  const handleDelete = async (model, localMatch) => {
    if (!localMatch) return
    if (!confirm(`Deletar ${localMatch.name}? (${formatBytes(localMatch.size)})`)) return
    await window.electron?.deleteLocalModel(localMatch.path)
    await refreshLocal()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000DD', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, width: 900, maxWidth: '96vw', height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ padding: '18px 24px 14px', borderBottom: `1px solid ${C.border}`, background: C.elevated }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 22 }}>🤖</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Model Hub</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>Pesquise e instale centenas de modelos locais</div>
            </div>
            <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 12px', color: C.textMuted, fontSize: 12, cursor: 'pointer' }}>✕ Fechar</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.code, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 14px' }}>
            <span style={{ fontSize: 14, color: C.textMuted }}>🔍</span>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar modelos LLM (ex: codellama, mistral, qwen coder)" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 13, fontFamily: 'inherit' }} autoFocus />
            {isSearching && <span style={{ fontSize: 11, color: C.textMuted }}>⏳</span>}
            {status && !isSearching && <span style={{ fontSize: 11, color: C.textDim }}>{status}</span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <StatusBadge label="Ollama" running={ollamaRunning} count={ollamaModels.length} />
            {!ollamaRunning && (
              <button onClick={async () => { setStatus('🚀 Tentando iniciar Ollama...'); await window.electron.startOllama?.(); setTimeout(() => { checkBackends(); setStatus('Verifique o Ollama na barra de tarefas.') }, 3000) }} style={{ fontSize: 10, fontWeight: 600, color: C.success, background: C.successDim, border: `1px solid ${C.success}66`, borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>LIGAR OLLAMA</button>
            )}
            <StatusBadge label="Local (GGUF)" running={localModels.length > 0} count={localModels.length} unit="arquivo(s)" />
            {sysSpecs && <StatusBadge label={`Seu Sistema: ${Math.round(sysSpecs.totalRamGB)}GB RAM`} running={true} count={0} unit=""/>}
            
            <button 
              onClick={async () => {
                const dir = await window.electron?.getModelsDir?.();
                if (dir) window.electron?.openFolder(dir);
              }} 
              style={{ marginLeft: 'auto', fontSize: 10, color: C.textMuted, background: 'none', border: `1px solid ${C.border}`, borderRadius: 5, padding: '3px 8px', cursor: 'pointer' }}
            >
              📁 Pasta de Modelos
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, background: C.surface, paddingInline: 16, paddingTop: 8 }}>
          {[
            { key: 'all',         label: '🌐 Todos os Modelos' },
            { key: 'local',       label: `⭐ Recomendados & Instalados (${totalInstalled})` },
            { key: 'huggingface', label: '🤗 Hugging Face' },
            { key: 'ollama',      label: '🦙 Ollama' },
          ].map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setVisibleCount(INITIAL_COUNT); }} style={{ padding: '6px 14px', background: 'none', border: 'none', borderBottom: tab === t.key ? `2px solid ${C.accent}` : '2px solid transparent', cursor: 'pointer', fontSize: 12, color: tab === t.key ? C.text : C.textMuted, fontWeight: tab === t.key ? 600 : 400, marginBottom: -1 }}>{t.label}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', scrollbarWidth: 'thin' }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: C.textMuted, fontSize: 14 }}>
              {isSearching ? '⏳ Pesquisando...' : tab === 'local' ? '😕 Nenhum modelo instalado. Baixe na aba Todos.' : '😕 Nenhum modelo encontrado.'}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {visibleModels.map(model => (
              <ModelCard
                key={model.id}
                model={model}
                localModels={localModels}
                ollamaModels={ollamaModels}
                downloads={downloads}
                onDownload={handleDownload}
                onUse={handleUse}
                onDelete={handleDelete}
                sysSpecs={sysSpecs}
              />
            ))}
          </div>
          
          {/* Elemento fantasma para carregar mais itens via Intersection Observer */}
          {hasMore && !isSearching && (
             <div ref={observerTarget} style={{ height: 20, marginTop: 20 }}></div>
          )}

        </div>
      </div>

      {filePicker && <FilePicker model={filePicker} onPick={handleFilePick} onClose={() => setFilePicker(null)} />}
      <style>{`@keyframes indeterminate { 0%{transform:translateX(-100%)} 100%{transform:translateX(400%)} }`}</style>
    </div>
  )
}