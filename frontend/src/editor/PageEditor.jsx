import React, { useEffect, useState } from 'react'
import { Editor, Element, Frame, useEditor, useNode } from '@craftjs/core'
import LZString from 'lz-string'
import { ArrowLeft, Eye, Monitor, Palette, Redo2, Save, Smartphone, Tablet, Trash2, Undo2 } from 'lucide-react'
import { PagesPanel } from './components/PagesPanel.tsx'
import { Container } from './components/Container.jsx'
import { Hero } from './components/Hero.jsx'
import { Column, Row, Section } from './components/layout/index.ts'
import { ThemeSettingsPanel } from './components/ThemeSettingsPanel.jsx'
import { PagesProvider, usePages } from './context/PagesContext.tsx'
import { ThemeProvider, useTheme } from './context/ThemeContext.jsx'
import { RenderDataProvider } from './context/RenderDataContext.jsx'
import { editorBlockGroups, editorResolver } from './resolver.js'
import { TemplateLibrary, loadTemplate, registerAllComponents } from './templates'
import { usePageSave } from './usePageSave.js'
import { toast } from '../lib/toast.js'

const btnStyle = {
  padding: '8px 14px',
  background: '#4b5563',
  color: 'white',
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
  fontSize: 13,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
}

function decodeCraftState(value) {
  if (!value) return ''
  const raw = String(value)
  const decompressed = LZString.decompressFromEncodedURIComponent(raw)
  if (decompressed) return decompressed
  try {
    JSON.parse(raw)
    return raw
  } catch {
    return ''
  }
}

function toolbarStyle(embedded) {
  return {
    position: embedded ? 'sticky' : 'fixed',
    top: 0,
    left: embedded ? 'auto' : 0,
    right: embedded ? 'auto' : 0,
    height: 60,
    background: '#111827',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    gap: 10,
    zIndex: 1000,
    boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
    borderRadius: embedded ? 18 : 0,
    overflow: 'hidden',
  }
}

function sidePanelStyle() {
  return {
    position: 'sticky',
    top: 12,
    width: '100%',
    background: '#f9fafb',
    overflowY: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: 18,
    maxHeight: 'calc(100vh - 180px)',
    alignSelf: 'start',
  }
}

function quickInputStyle(extra = {}) {
  return {
    height: 34,
    padding: '0 10px',
    border: '1px solid #d1d5db',
    borderRadius: 10,
    fontSize: 13,
    background: 'white',
    color: '#111827',
    ...extra,
  }
}

function quickButtonStyle(active = false) {
  return {
    height: 34,
    padding: '0 10px',
    border: '1px solid #d1d5db',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 700,
    background: active ? '#2563eb' : 'white',
    color: active ? 'white' : '#111827',
    cursor: 'pointer',
  }
}

function Toolbar({
  viewMode,
  setViewMode,
  showThemePanel,
  setShowThemePanel,
  onOpenTemplates,
  showPreview,
  setShowPreview,
  pageId,
  onSaveCallback,
  embedded,
  onBack,
}) {
  const { actions, canUndo, canRedo } = useEditor((state, query) => ({
    canUndo: query.history.canUndo(),
    canRedo: query.history.canRedo(),
  }))
  const { pages, activePageId, saveCurrentPageData } = usePages()
  const { savePage } = usePageSave(pageId, onSaveCallback, ({ serialized }) => {
    saveCurrentPageData(serialized)
    return {
      activePageId,
      pages: pages.map((page) => (page.id === activePageId ? { ...page, data: serialized } : page)),
    }
  })

  return (
    <div style={toolbarStyle(embedded)}>
      {typeof onBack === 'function' ? (
        <button onClick={onBack} style={{ ...btnStyle, background: '#374151' }}>
          <ArrowLeft size={16} />
          Geri Don
        </button>
      ) : null}

      <button onClick={onOpenTemplates} style={{ ...btnStyle, background: '#f59e0b' }}>
        Sablonlar
      </button>

      <button onClick={() => actions.history.undo()} disabled={!canUndo} style={{ ...btnStyle, opacity: canUndo ? 1 : 0.5 }}>
        <Undo2 size={16} />
        Geri Al
      </button>
      <button onClick={() => actions.history.redo()} disabled={!canRedo} style={{ ...btnStyle, opacity: canRedo ? 1 : 0.5 }}>
        <Redo2 size={16} />
        Ileri Al
      </button>

      <div style={{ marginLeft: 10, display: 'flex', gap: 6 }}>
        <button onClick={() => setViewMode('desktop')} style={{ ...btnStyle, background: viewMode === 'desktop' ? '#2563eb' : '#4b5563' }}>
          <Monitor size={16} />
          Desktop
        </button>
        <button onClick={() => setViewMode('tablet')} style={{ ...btnStyle, background: viewMode === 'tablet' ? '#2563eb' : '#4b5563' }}>
          <Tablet size={16} />
          Tablet
        </button>
        <button onClick={() => setViewMode('mobile')} style={{ ...btnStyle, background: viewMode === 'mobile' ? '#2563eb' : '#4b5563' }}>
          <Smartphone size={16} />
          Mobil
        </button>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
        <button onClick={() => setShowThemePanel((current) => !current)} style={{ ...btnStyle, background: showThemePanel ? '#7c3aed' : '#4b5563' }}>
          <Palette size={16} />
          Tema
        </button>
        <button onClick={() => setShowPreview((current) => !current)} style={{ ...btnStyle, background: showPreview ? '#b45309' : '#f59e0b' }}>
          <Eye size={16} />
          {showPreview ? 'Duzenle' : 'Onizleme'}
        </button>
        <button onClick={savePage} style={{ ...btnStyle, background: '#10b981' }}>
          <Save size={16} />
          Kaydet
        </button>
      </div>
    </div>
  )
}

function TemplateLibraryModal({ isOpen, onClose }) {
  const { actions, query } = useEditor()
  const { setTheme } = useTheme()

  const handleTemplateSelect = (template) => {
    loadTemplate(template, actions, query, setTheme)
    toast.success(`${template.name} sablonu yuklendi`)
  }

  return <TemplateLibrary isOpen={isOpen} onClose={onClose} onSelect={handleTemplateSelect} />
}

function Toolbox() {
  const { actions, connectors, query, rootCanvasId } = useEditor((state) => ({
    rootCanvasId: state.nodes.ROOT?.data?.nodes?.[0] || 'ROOT',
  }))
  const [openCat, setOpenCat] = useState('YAPI')

  const addBlock = (block) => {
    const element = typeof block.create === 'function' ? block.create() : React.createElement(block.component)
    const tree = query.parseReactElement(element).toNodeTree()
    actions.addNodeTree(tree, rootCanvasId)
  }

  return (
    <aside style={{ ...sidePanelStyle(), padding: 16 }}>
      <h3 style={{ marginTop: 0, fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Bilesenler
      </h3>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#9ca3af' }}>Surukleyip sayfaya birakin veya tiklayarak ekleyin</p>
      {editorBlockGroups.map((group) => (
        <div key={group.category} style={{ marginBottom: 10 }}>
          <button
            onClick={() => setOpenCat((current) => (current === group.category ? '' : group.category))}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13,
              fontWeight: 700,
              color: '#374151',
            }}
          >
            <span>{group.category}</span>
            <span style={{ transform: openCat === group.category ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>{'>'}</span>
          </button>

          {openCat === group.category ? (
            <div style={{ padding: '8px 0 0 4px' }}>
              {group.items.map((block) => (
                <div
                  key={`${group.category}-${block.name}`}
                  ref={(ref) => {
                    if (ref) connectors.create(ref, typeof block.create === 'function' ? block.create() : React.createElement(block.component))
                  }}
                  onClick={() => addBlock(block)}
                  style={{
                    padding: 10,
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    marginBottom: 6,
                    cursor: 'grab',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    fontSize: 13,
                    color: '#111827',
                    userSelect: 'none',
                  }}
                >
                  <span
                    style={{
                      width: 30,
                      minWidth: 30,
                      textAlign: 'center',
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#2563eb',
                    }}
                  >
                    {block.icon}
                  </span>
                  <span>{block.name}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </aside>
  )
}

function SettingsPanel({ showThemePanel }) {
  const { actions, selectedId, selectedNode } = useEditor((state) => {
    const currentNodeId = state.events.selected.values().next().value || null
    return {
      selectedId: currentNodeId,
      selectedNode: currentNodeId ? state.nodes[currentNodeId] : null,
    }
  })

  if (showThemePanel && !selectedNode) {
    return (
      <aside style={sidePanelStyle()}>
        <ThemeSettingsPanel />
      </aside>
    )
  }

  const isContainer = selectedNode?.data?.name === 'Container' || selectedId === 'ROOT'
  const SettingsComponent = selectedNode?.related?.settings || selectedNode?.data?.related?.settings

  if (!selectedNode || isContainer || !SettingsComponent) {
    return (
      <aside style={sidePanelStyle()}>
        {showThemePanel ? (
          <ThemeSettingsPanel />
        ) : (
          <p style={{ color: '#6b7280', textAlign: 'center', marginTop: 40 }}>
            Duzenlemek icin bir bilesen secin
          </p>
        )}
      </aside>
    )
  }

  return (
    <aside style={sidePanelStyle()}>
      <div style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0, fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Ayarlar: {selectedNode?.data?.displayName || selectedNode?.data?.name}
        </h3>
      </div>
      <SettingsComponent
        nodeId={selectedId}
        props={selectedNode?.data?.props || {}}
        setProp={(updater) => actions.setProp(selectedId, updater)}
      />
      <div style={{ padding: 16 }}>
        <button
          onClick={() => actions.delete(selectedId)}
          style={{
            ...btnStyle,
            width: '100%',
            justifyContent: 'center',
            background: '#ef4444',
          }}
        >
          <Trash2 size={16} />
          Bileseni Sil
        </button>
      </div>
    </aside>
  )
}

function QuickSettingsBar() {
  const { actions, selectedId, selectedNode } = useEditor((state) => {
    const currentNodeId = state.events.selected.values().next().value || null
    return {
      selectedId: currentNodeId,
      selectedNode: currentNodeId ? state.nodes[currentNodeId] : null,
    }
  })

  if (!selectedId || !selectedNode) return null

  const nodeName = selectedNode?.data?.name || ''
  const props = selectedNode?.data?.props || {}
  const isContainer = nodeName === 'Container' || selectedId === 'ROOT'

  if (isContainer) return null

  const setProp = (updater) => actions.setProp(selectedId, updater)

  return (
    <div
      style={{
        position: 'absolute',
        top: 18,
        left: 18,
        right: 18,
        zIndex: 30,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          maxWidth: 'calc(100% - 40px)',
          padding: 10,
          borderRadius: 16,
          border: '1px solid #dbe3f0',
          background: 'rgba(255,255,255,0.96)',
          boxShadow: '0 16px 40px rgba(15, 23, 42, 0.12)',
          backdropFilter: 'blur(14px)',
          pointerEvents: 'auto',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {selectedNode?.data?.displayName || nodeName}
        </span>

        {nodeName === 'HeadingBlock' ? (
          <>
            <input
              value={props.text || ''}
              onChange={(event) => setProp((draft) => { draft.text = event.target.value })}
              style={{ ...quickInputStyle({ minWidth: 220 }), flex: '1 1 220px' }}
              placeholder="Baslik"
            />
            <select
              value={props.level || 'h2'}
              onChange={(event) => setProp((draft) => { draft.level = event.target.value })}
              style={quickInputStyle()}
            >
              <option value="h1">H1</option>
              <option value="h2">H2</option>
              <option value="h3">H3</option>
              <option value="h4">H4</option>
            </select>
            <button onClick={() => setProp((draft) => { draft.align = 'left' })} style={quickButtonStyle(props.align === 'left')}>Sol</button>
            <button onClick={() => setProp((draft) => { draft.align = 'center' })} style={quickButtonStyle(props.align === 'center')}>Orta</button>
            <button onClick={() => setProp((draft) => { draft.align = 'right' })} style={quickButtonStyle(props.align === 'right')}>Sag</button>
          </>
        ) : null}

        {nodeName === 'TextBlock' ? (
          <>
            <select
              value={props.align || 'left'}
              onChange={(event) => setProp((draft) => { draft.align = event.target.value })}
              style={quickInputStyle()}
            >
              <option value="left">Sol</option>
              <option value="center">Orta</option>
              <option value="right">Sag</option>
              <option value="justify">Yasla</option>
            </select>
            <input
              type="number"
              value={parseInt(props.size || '16px', 10) || 16}
              onChange={(event) => setProp((draft) => { draft.size = `${event.target.value || 16}px` })}
              style={{ ...quickInputStyle(), width: 82 }}
              min="10"
              max="72"
            />
          </>
        ) : null}

        {nodeName === 'ButtonBlock' ? (
          <>
            <input
              value={props.text || ''}
              onChange={(event) => setProp((draft) => { draft.text = event.target.value })}
              style={quickInputStyle({ minWidth: 160 })}
              placeholder="Buton"
            />
            <input
              value={props.link || ''}
              onChange={(event) => setProp((draft) => { draft.link = event.target.value })}
              style={{ ...quickInputStyle({ minWidth: 220 }), flex: '1 1 220px' }}
              placeholder="https://..."
            />
            <select
              value={props.style || 'primary'}
              onChange={(event) => setProp((draft) => { draft.style = event.target.value })}
              style={quickInputStyle()}
            >
              <option value="primary">Dolu</option>
              <option value="secondary">Cerceve</option>
              <option value="dark">Koyu</option>
            </select>
          </>
        ) : null}

        {nodeName === 'Section' ? (
          <>
            <input
              type="color"
              value={props.backgroundType === 'color' ? (props.background || '#ffffff') : '#ffffff'}
              onChange={(event) => setProp((draft) => {
                draft.backgroundType = 'color'
                draft.background = event.target.value
              })}
              style={quickInputStyle({ width: 54, padding: 4 })}
            />
            <input
              value={props.padding || '60px 20px'}
              onChange={(event) => setProp((draft) => { draft.padding = event.target.value })}
              style={quickInputStyle({ minWidth: 160 })}
              placeholder="60px 20px"
            />
          </>
        ) : null}

        {nodeName === 'Row' ? (
          <>
            <input
              value={props.gap || '20px'}
              onChange={(event) => setProp((draft) => { draft.gap = event.target.value })}
              style={quickInputStyle({ minWidth: 110 })}
              placeholder="Gap"
            />
            <select
              value={props.align || 'stretch'}
              onChange={(event) => setProp((draft) => { draft.align = event.target.value })}
              style={quickInputStyle()}
            >
              <option value="stretch">Esnet</option>
              <option value="flex-start">Ust</option>
              <option value="center">Orta</option>
              <option value="flex-end">Alt</option>
            </select>
          </>
        ) : null}

        {nodeName === 'Column' ? (
          <>
            <input
              value={props.width || '100%'}
              onChange={(event) => setProp((draft) => { draft.width = event.target.value })}
              style={quickInputStyle({ minWidth: 110 })}
              placeholder="100%"
            />
            <input
              value={props.padding || '0px'}
              onChange={(event) => setProp((draft) => { draft.padding = event.target.value })}
              style={quickInputStyle({ minWidth: 110 })}
              placeholder="0px"
            />
          </>
        ) : null}

        {nodeName === 'Hero' ? (
          <>
            <input
              value={props.title || ''}
              onChange={(event) => setProp((draft) => { draft.title = event.target.value })}
              style={{ ...quickInputStyle({ minWidth: 220 }), flex: '1 1 220px' }}
              placeholder="Hero basligi"
            />
            <input
              type="color"
              value={String(props.bgColor || '#3b82f6').startsWith('#') ? props.bgColor : '#3b82f6'}
              onChange={(event) => setProp((draft) => { draft.bgColor = event.target.value })}
              style={quickInputStyle({ width: 54, padding: 4 })}
            />
            <input
              value={props.btnText || ''}
              onChange={(event) => setProp((draft) => { draft.btnText = event.target.value })}
              style={quickInputStyle({ minWidth: 140 })}
              placeholder="Buton"
            />
          </>
        ) : null}

        {nodeName === 'ImageBlock' ? (
          <>
            <input
              value={props.src || ''}
              onChange={(event) => setProp((draft) => { draft.src = event.target.value })}
              style={{ ...quickInputStyle({ minWidth: 220 }), flex: '1 1 220px' }}
              placeholder="Resim URL"
            />
            <select
              value={props.width || '100%'}
              onChange={(event) => setProp((draft) => { draft.width = event.target.value })}
              style={quickInputStyle()}
            >
              <option value="25%">25%</option>
              <option value="50%">50%</option>
              <option value="75%">75%</option>
              <option value="100%">100%</option>
            </select>
            <button onClick={() => setProp((draft) => { draft.rounded = !draft.rounded })} style={quickButtonStyle(!!props.rounded)}>
              Yuvarlak
            </button>
          </>
        ) : null}

        {nodeName === 'ProductGrid' ? (
          <>
            <input
              value={props.title || ''}
              onChange={(event) => setProp((draft) => { draft.title = event.target.value })}
              style={{ ...quickInputStyle({ minWidth: 180 }), flex: '1 1 180px' }}
              placeholder="Baslik"
            />
            <input
              type="number"
              min="1"
              max="4"
              value={props.columns || 3}
              onChange={(event) => setProp((draft) => { draft.columns = Number(event.target.value || 3) })}
              style={{ ...quickInputStyle(), width: 78 }}
            />
            <button onClick={() => setProp((draft) => { draft.showPrices = !(draft.showPrices !== false) })} style={quickButtonStyle(props.showPrices !== false)}>
              Fiyat
            </button>
          </>
        ) : null}

        {nodeName === 'RestaurantMenu' ? (
          <>
            <input
              value={props.title || ''}
              onChange={(event) => setProp((draft) => { draft.title = event.target.value })}
              style={{ ...quickInputStyle({ minWidth: 180 }), flex: '1 1 180px' }}
              placeholder="Baslik"
            />
            <button onClick={() => setProp((draft) => { draft.showImages = !(draft.showImages !== false) })} style={quickButtonStyle(props.showImages !== false)}>
              Gorsel
            </button>
          </>
        ) : null}

        {nodeName === 'ContactForm' ? (
          <>
            <input
              value={props.title || ''}
              onChange={(event) => setProp((draft) => { draft.title = event.target.value })}
              style={{ ...quickInputStyle({ minWidth: 180 }), flex: '1 1 180px' }}
              placeholder="Baslik"
            />
            <input
              value={props.btnText || ''}
              onChange={(event) => setProp((draft) => { draft.btnText = event.target.value })}
              style={quickInputStyle({ minWidth: 140 })}
              placeholder="Buton"
            />
          </>
        ) : null}

        {nodeName === 'MapBlock' ? (
          <>
            <input
              value={props.address || ''}
              onChange={(event) => setProp((draft) => { draft.address = event.target.value })}
              style={{ ...quickInputStyle({ minWidth: 220 }), flex: '1 1 220px' }}
              placeholder="Adres"
            />
            <input
              type="number"
              min="180"
              max="800"
              value={props.height || 320}
              onChange={(event) => setProp((draft) => { draft.height = Number(event.target.value || 320) })}
              style={{ ...quickInputStyle(), width: 88 }}
            />
          </>
        ) : null}

        <button
          onClick={() => actions.delete(selectedId)}
          style={{ ...quickButtonStyle(false), color: '#b91c1c', borderColor: '#fecaca' }}
        >
          Sil
        </button>
      </div>
    </div>
  )
}

function EditorShell({ initialData, previewData, onSaveCallback, pageId, embedded, onBack }) {
  const { pages, activePageId } = usePages()
  const [viewMode, setViewMode] = useState('desktop')
  const [showPreview, setShowPreview] = useState(false)
  const [showThemePanel, setShowThemePanel] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  const canvasWidths = {
    desktop: '1200px',
    tablet: '768px',
    mobile: '375px',
  }

  const activePage = pages.find((page) => page.id === activePageId)
  const decodedData = decodeCraftState(activePage?.data || initialData)

  return (
    <Editor resolver={editorResolver} onRender={RenderNode}>
      <div style={{ background: '#f3f4f6', minHeight: embedded ? 'auto' : '100vh', display: 'grid', gap: 12 }}>
        <Toolbar
          viewMode={viewMode}
          setViewMode={setViewMode}
          showThemePanel={showThemePanel}
          setShowThemePanel={setShowThemePanel}
          onOpenTemplates={() => setShowTemplates(true)}
          showPreview={showPreview}
          setShowPreview={setShowPreview}
          pageId={pageId}
          onSaveCallback={onSaveCallback}
          embedded={embedded}
          onBack={onBack}
        />

        <TemplateLibraryModal isOpen={showTemplates} onClose={() => setShowTemplates(false)} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: showPreview ? '1fr' : showThemePanel ? '240px minmax(0, 1fr) 300px' : '240px minmax(0, 1fr)',
            gap: 12,
            alignItems: 'start',
          }}
        >
          {!showPreview ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'start' }}>
              <PagesPanel />
              <Toolbox />
            </div>
          ) : null}

          <div
            style={{
              width: '100%',
              background: 'white',
              minHeight: embedded ? 720 : 'calc(100vh - 72px)',
              boxShadow: '0 0 20px rgba(0,0,0,0.08)',
              overflow: 'hidden',
              borderRadius: 20,
              padding: embedded ? 16 : 20,
              display: 'flex',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {!showPreview ? <QuickSettingsBar /> : null}
            <div
              style={{
                width: canvasWidths[viewMode],
                maxWidth: '100%',
                minHeight: embedded ? 640 : 'calc(100vh - 120px)',
                background: 'white',
                boxShadow: embedded ? '0 0 0 1px #e5e7eb' : '0 0 20px rgba(0,0,0,0.08)',
                overflow: 'hidden',
                borderRadius: 20,
                transition: 'width 0.3s ease',
              }}
            >
              <Frame data={decodedData || undefined}>
                <Element is={Container} canvas>
                  <Section padding="60px 20px" background="#ffffff">
                    <Row gap="20px">
                      <Column width="100%" padding="0px">
                        <Hero
                          title={previewData?.tenantName ? `${previewData.tenantName} icin yeni sayfa` : 'PenPOS ile online satisa baslayin'}
                          subtitle="Surukle birak ile profesyonel site tasarlayin"
                          bgColor="var(--primary-color)"
                          btnText="Hemen Basla"
                        />
                      </Column>
                    </Row>
                  </Section>
                </Element>
              </Frame>
            </div>
          </div>

          {!showPreview && showThemePanel ? <SettingsPanel showThemePanel={showThemePanel} /> : null}
        </div>
      </div>
    </Editor>
  )
}

function RenderNode({ render }) {
  const { isSelected, displayName } = useNode((node) => ({
    isSelected: node.events.selected,
    displayName: node.data.displayName || node.data.name,
  }))

  return (
    <div
      style={{
        border: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
        position: 'relative',
      }}
    >
      {render}
      {isSelected ? (
        <div
          style={{
            position: 'absolute',
            top: -20,
            left: 0,
            background: '#3b82f6',
            color: 'white',
            padding: '2px 8px',
            fontSize: 11,
            borderRadius: '4px 4px 0 0',
            pointerEvents: 'none',
          }}
        >
          {displayName}
        </div>
      ) : null}
    </div>
  )
}

export function PageEditor({
  initialData = '',
  initialTheme = null,
  initialPages = null,
  previewData = null,
  onSaveCallback = null,
  pageId = '',
  embedded = false,
  onBack = null,
}) {
  useEffect(() => {
    registerAllComponents(editorResolver)
  }, [])

  return (
    <ThemeProvider initialTheme={initialTheme}>
      <PagesProvider initialPages={initialPages} initialHomeData={initialData}>
        <RenderDataProvider value={previewData}>
          <EditorShell
            initialData={initialData}
            previewData={previewData}
            onSaveCallback={onSaveCallback}
            pageId={pageId}
            embedded={embedded}
            onBack={onBack}
          />
        </RenderDataProvider>
      </PagesProvider>
    </ThemeProvider>
  )
}
