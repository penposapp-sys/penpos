import React from 'react'
import { Editor, Frame } from '@craftjs/core'
import LZString from 'lz-string'
import { ThemeProvider } from '../editor/context/ThemeContext.jsx'
import { RenderDataProvider } from '../editor/context/RenderDataContext.jsx'
import { editorResolver } from '../editor/resolver.js'

function decodeCraftState(value) {
  if (!value) return ''
  const raw = String(value)
  return LZString.decompressFromEncodedURIComponent(raw) || raw
}

export function PageRenderer({ compressedData, themeConfig = null, renderData = null }) {
  const serialized = decodeCraftState(compressedData)

  if (!serialized) return null

  return (
    <ThemeProvider initialTheme={themeConfig}>
      <RenderDataProvider value={renderData}>
        <Editor enabled={false} resolver={editorResolver}>
          <Frame data={serialized} />
        </Editor>
      </RenderDataProvider>
    </ThemeProvider>
  )
}
