import React from 'react'
import { useNode } from '@craftjs/core'
import { CommonStyleSettings, getCommonWrapperStyle } from './helpers.jsx'

export const ListBlock = (props: any) => {
  const { items, ordered } = props
  const { connectors: { connect, drag } } = useNode()
  const Tag = ordered ? 'ol' : 'ul'

  return (
    <div ref={ref => connect(drag(ref as any))} style={getCommonWrapperStyle(props, { color: 'var(--secondary-color)' })}>
      <Tag style={{ paddingLeft: '20px', lineHeight: '1.8', margin: 0 }}>
        {items.map((item: string, i: number) => <li key={i}>{item}</li>)}
      </Tag>
    </div>
  )
}

ListBlock.craft = {
  displayName: 'Liste',
  props: { items: ['Ozellik 1', 'Ozellik 2', 'Ozellik 3'], ordered: false, padding: '20px 50px' },
  related: {
    settings: () => {
      const { actions, items, ordered, props } = useNode((node: any) => ({
        items: node.data.props.items,
        ordered: node.data.props.ordered,
        props: node.data.props,
      }))
      return (
        <div>
          <label style={{ display: 'flex', gap: '8px', fontSize: '13px', marginBottom: '15px', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={ordered}
              onChange={e => actions.setProp((p: any) => { p.ordered = e.target.checked })}
            />
            Numarali Liste
          </label>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>
              Ogeler
            </label>
            <textarea
              value={items.join('\n')}
              onChange={e => actions.setProp((p: any) => { p.items = e.target.value.split('\n') })}
              rows={6}
              style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontFamily: 'inherit' }}
            />
          </div>
          <CommonStyleSettings props={props} setProp={actions.setProp} />
        </div>
      )
    },
  },
}
