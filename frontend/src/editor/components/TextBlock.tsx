import React, { useRef } from 'react'
import { useNode, useEditor } from '@craftjs/core'
import { CommonStyleSettings, getCommonWrapperStyle } from './helpers.jsx'

export const TextBlock = (props: any) => {
  const { content, align, size } = props
  const { connectors: { connect, drag } } = useNode()
  const { actions } = useEditor()
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={r => { connect(drag(r as any)); (ref as any).current = r }}
      style={getCommonWrapperStyle(props)}
    >
      <div
        contentEditable
        suppressContentEditableWarning
        onInput={e => actions.setProp((p: any) => { p.content = e.currentTarget.innerHTML })}
        style={{
          textAlign: align,
          fontSize: size,
          color: 'var(--secondary-color)',
          minHeight: '30px',
          lineHeight: '1.6',
          fontFamily: 'var(--font-family)',
        }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  )
}

TextBlock.craft = {
  displayName: 'Metin Kutusu',
  props: {
    content: '<p>Buraya metin girin. <b>Kalin</b>, <i>italik</i> yazabilirsiniz.</p>',
    align: 'left',
    size: '16px',
    padding: '20px 30px',
  },
  related: {
    settings: () => {
      const { actions, align, size, props } = useNode((node: any) => ({
        align: node.data.props.align,
        size: node.data.props.size,
        props: node.data.props,
      }))
      return (
        <div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>Hizalama</label>
            <select
              value={align}
              onChange={e => actions.setProp((p: any) => { p.align = e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            >
              <option value="left">Sol</option>
              <option value="center">Orta</option>
              <option value="right">Sag</option>
              <option value="justify">Yasla</option>
            </select>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>Yazi Boyutu (px)</label>
            <input
              type="number"
              value={parseInt(size)}
              onChange={e => actions.setProp((p: any) => { p.size = `${e.target.value}px` })}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
          </div>
          <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '10px', padding: '8px', background: '#f3f4f6', borderRadius: '4px' }}>
            Metni duzenlemek icin dogrudan ustune tiklayin.
          </p>
          <CommonStyleSettings props={props} setProp={actions.setProp} />
        </div>
      )
    },
  },
}
