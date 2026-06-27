import { useEditor } from '@craftjs/core'
import LZString from 'lz-string'
import { useTheme } from './context/ThemeContext.jsx'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'

export function usePageSave(pageId, onSaveCallback = null, buildExtraPayload = null) {
  const { query } = useEditor()
  const { theme } = useTheme()

  const savePage = async () => {
    const serialized = query.serialize()
    const compressed = LZString.compressToEncodedURIComponent(serialized)
    const extraPayload =
      typeof buildExtraPayload === 'function'
        ? buildExtraPayload({ serialized, compressed, theme }) || {}
        : {}
    const payload = {
      pageId: pageId || '',
      pageData: compressed,
      page_data: compressed,
      themeConfig: theme,
      theme_config: theme,
      updatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...extraPayload,
    }

    try {
      if (typeof onSaveCallback === 'function') {
        await onSaveCallback(payload)
        toast.success('Sayfa basariyla kaydedildi')
        return payload
      }

      if (!pageId) {
        toast.success('Sayfa verisi hazirlandi')
        return payload
      }

      const response = await api(`/pages/${encodeURIComponent(String(pageId))}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })

      if (!response?.ok) throw new Error(response?.message || 'Kaydetme basarisiz')

      toast.success('Sayfa basariyla kaydedildi')
      return payload
    } catch (error) {
      console.error(error)
      toast.error(error?.message || 'Kaydetme sirasinda hata olustu')
      return null
    }
  }

  return { savePage }
}
