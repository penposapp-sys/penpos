import React from 'react'
import { useNode } from '@craftjs/core'
import { CommonStyleSettings, getCommonWrapperStyle } from './helpers.jsx'

export const SpacerBlock = (props: any) => {
  const { height } = props
  const { connectors: { connect, drag } } = useNode()
  return (
    <div ref={ref => connect(drag(ref as any))} style={getCommonWrapperStyle(props, { height })}>
      <div style={{ height: '100%', border: '1px dashed transparent' }} />
    </div>
  )
}

SpacerBlock.craft = {
  displayName: 'Bosluk (Spacer)',
  props: { height: '40px', padding: '0 30px' },
  related: {
    settings: () => {
      const { actions, height, props } = useNode((node: any) => ({ height: node.data.props.height, props: node.data.props }))
      return (
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px' }}>
            Yukseklik: {height}
          </label>
          <input
            type="range"
            min="10"
            max="200"
            value={parseInt(height, 10)}
            onChange={e => actions.setProp((p: any) => { p.height = `${e.target.value}px` })}
            style={{ width: '100%' }}
          />
          <CommonStyleSettings props={props} setProp={actions.setProp} />
        </div>
      )
    },
  },
}
