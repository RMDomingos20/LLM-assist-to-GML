import React, { useState } from 'react'
import { C, ONLINE_PROVIDERS } from './constants'
import { soundManager } from './soundManager'

export default function SettingsModal({ currentSettings, onClose, onSave }) {
  const [settings, setSettings] = useState(currentSettings || {})
  const [tab, setTab] = useState(currentSettings?.aiMode || 'local')

  if (!settings) return null 

  const handleChangeFolder = async () => {
    const newPath = await window.electron.selectCustomModelsFolder()
    if (newPath) setSettings({ ...settings, modelsPath: newPath })
  }

  const handleSave = async () => {
    const finalSettings = { ...settings, aiMode: tab }
    await window.electron.saveSettings(finalSettings)
    onSave(finalSettings)
    onClose()
  }

  const gpuLayers = settings.gpuLayers ?? 999
  const temperature = settings.temperature ?? 0.3
  const maxTokens = settings.maxTokens ?? 2048
  const contextSize = settings.contextSize ?? 4096
  const kvCacheType = settings.kvCacheType ?? 'f16'

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000000DD',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000,
    }}>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: 0, width: 580,
        display: 'flex', flexDirection: 'column',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        
        {/* TABS HEADER */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.elevated }}>
          <div onClick={() => setTab('local')} style={{ flex: 1, padding: 15, textAlign: 'center', cursor: 'pointer', fontWeight: 'bold', color: tab === 'local' ? C.accent : C.textMuted, borderBottom: tab === 'local' ? `2px solid ${C.accent}` : '2px solid transparent' }}>💻 Modo Local (GGUF)</div>
          <div onClick={() => setTab('online')} style={{ flex: 1, padding: 15, textAlign: 'center', cursor: 'pointer', fontWeight: 'bold', color: tab === 'online' ? C.teal : C.textMuted, borderBottom: tab === 'online' ? `2px solid ${C.teal}` : '2px solid transparent' }}>☁️ Modo Nuvem (API)</div>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {tab === 'local' ? (
            <>
              <div>
                <label style={labelStyle}>Pasta de Modelos (GGUF)</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input readOnly value={settings.modelsPath || ''} style={inputStyle} />
                  <button onClick={handleChangeFolder} style={btnStyle}>Mudar</button>
                </div>
              </div>

              <div style={{ background: C.elevated, padding: 15, borderRadius: 8, border: `1px solid ${C.border}` }}>
                <label style={{...labelStyle, color: C.accent}}>Camadas na GPU (VRAM)</label>
                <input type="range" min="0" max="999" step="1" value={gpuLayers} onChange={e => setSettings({ ...settings, gpuLayers: parseInt(e.target.value) })} style={{ width: '100%' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                  <span>0 (CPU puro)</span>
                  <span style={{ color: C.accent, fontWeight: 'bold' }}>Atual: {gpuLayers >= 999 ? 'Tudo na GPU' : gpuLayers}</span>
                  <span>999 (MAX)</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ background: C.tealDim, padding: 15, borderRadius: 8, border: `1px solid ${C.teal}44` }}>
                <label style={{...labelStyle, color: C.teal}}>Autocompletar com Provedor</label>
                <select 
                  onChange={(e) => {
                    const p = ONLINE_PROVIDERS[e.target.value]
                    if (p) setSettings({ ...settings, onlineBaseUrl: p.url, onlineModel: p.defModel })
                  }} 
                  style={{...inputStyle, background: C.surface, cursor: 'pointer'}}
                  defaultValue=""
                >
                  <option value="" disabled>Selecione uma API...</option>
                  {Object.entries(ONLINE_PROVIDERS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Base URL da API</label>
                <input type="text" value={settings.onlineBaseUrl || ''} onChange={e => setSettings({ ...settings, onlineBaseUrl: e.target.value })} style={inputStyle} placeholder="https://api.openai.com/v1" />
              </div>
              
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Nome do Modelo</label>
                  <input type="text" value={settings.onlineModel || ''} onChange={e => setSettings({ ...settings, onlineModel: e.target.value })} style={inputStyle} placeholder="gpt-4o-mini" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>API Key (Bearer Token)</label>
                  <input type="password" value={settings.onlineKey || ''} onChange={e => setSettings({ ...settings, onlineKey: e.target.value })} style={inputStyle} placeholder="sk-..." />
                </div>
              </div>
            </>
          )}

          <hr style={{ borderColor: C.border, margin: '5px 0' }} />

          {/* SHARED SETTINGS */}
          <div style={{ display: 'flex', gap: 15 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Máx Tokens (Saída)</label>
              <select value={maxTokens} onChange={e => setSettings({ ...settings, maxTokens: parseInt(e.target.value) })} style={inputStyle}>
                <option value={1024}>1024</option>
                <option value={2048}>2048 (Padrão)</option>
                <option value={4096}>4096</option>
                <option value={8192}>8192</option>
                <option value={-1}>Ilimitado</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Temperatura ({temperature})</label>
              <input type="range" min="0" max="2" step="0.1" value={temperature} onChange={e => setSettings({ ...settings, temperature: parseFloat(e.target.value) })} style={{ width: '100%', marginTop: 8 }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 15 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Tamanho do Contexto (Memória)</label>
              <select value={contextSize} onChange={e => setSettings({ ...settings, contextSize: parseInt(e.target.value) })} style={inputStyle}>
                <option value={2048}>2K</option>
                <option value={4096}>4K (Padrão Seguro)</option>
                <option value={8192}>8K</option>
                <option value={16384}>16K (Requer boa GPU)</option>
                <option value={32768}>32K (Ideal para APIs Online)</option>
              </select>
            </div>
            
            {tab === 'local' && (
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Otimização de KV Cache (VRAM)</label>
                <select value={kvCacheType} onChange={e => setSettings({ ...settings, kvCacheType: e.target.value })} style={{...inputStyle, borderColor: C.accent}}>
                  <option value="f16">F16 (Padrão - Alta VRAM, Mais Rápido)</option>
                  <option value="q8_0">Q8_0 (Metade da VRAM, Boa Velocidade)</option>
                  <option value="q4_0">Q4_0 (Mínima VRAM, Pode ser Lento)</option>
                </select>
              </div>
            )}
          </div>

          <hr style={{ borderColor: C.border, margin: '5px 0' }} />
          
          <h3 style={{ fontSize: 14, color: C.text, margin: '0' }}>🎵 Áudio & Interface</h3>
          <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Volume dos Sons ({Math.round((settings.audioVolume ?? 0.5) * 100)}%)</label>
              <input 
                type="range" min="0" max="1" step="0.05" 
                value={settings.audioVolume ?? 0.5} 
                onChange={e => {
                  setSettings({ ...settings, audioVolume: parseFloat(e.target.value) });
                  soundManager.setVolume(parseFloat(e.target.value));
                }} 
                onMouseUp={() => soundManager.play('sent.mp3')} 
                style={{ width: '100%', marginTop: 8 }} 
              />
            </div>
            
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, marginTop: 15 }}>
              <input 
                type="checkbox" id="introToggle" 
                checked={settings.playIntroOnStartup ?? true} 
                onChange={e => setSettings({ ...settings, playIntroOnStartup: e.target.checked })} 
                style={{ cursor: 'pointer', width: 16, height: 16 }}
              />
              <label htmlFor="introToggle" style={{ fontSize: 13, color: C.textDim, cursor: 'pointer' }}>
                Tocar música e dar Boas-Vindas
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button onClick={onClose} style={{ ...btnStyle, background: 'transparent', color: C.text }}>Cancelar</button>
            <button onClick={handleSave} style={{ ...btnStyle, background: C.successDim, color: C.success, borderColor: C.success }}>Salvar e Aplicar</button>
          </div>

        </div>
      </div>
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 'bold', color: C.textDim, marginBottom: 5 }
const inputStyle  = { flex: 1, padding: '8px', borderRadius: 6, background: C.code, border: `1px solid ${C.border}`, color: C.text, width: '100%' }
const btnStyle    = { padding: '8px 14px', borderRadius: 6, background: C.elevated, border: `1px solid ${C.border}`, color: C.text, cursor: 'pointer', fontWeight: 'bold' }