import React from 'react'
import type { Template, TemplateBlock } from './TemplateTypes'

const COMPONENT_MAP: Record<string, any> = {}

export const registerComponent = (name: string, component: any) => {
  COMPONENT_MAP[name] = component
}

const createBlockElement = (block: TemplateBlock) => {
  const Component = COMPONENT_MAP[block.type]
  if (!Component) return null

  const children = Array.isArray(block.children)
    ? block.children
        .map((child) => createBlockElement(child))
        .filter(Boolean)
    : undefined

  return React.createElement(Component, block.props || {}, ...(children || []))
}

export const loadTemplate = (template: Template, actions: any, query: any, setTheme?: (theme: any) => void) => {
  const rootNodeId = query.node('ROOT').get()?.data?.nodes?.[0] || 'ROOT'
  const rootNode = query.node(rootNodeId).get()

  if (rootNode?.data?.nodes) {
    ;[...rootNode.data.nodes].forEach((childId: string) => {
      actions.delete(childId)
    })
  }

  template.blocks.forEach((block: TemplateBlock) => {
    if (!COMPONENT_MAP[block.type]) {
      console.warn(`Component bulunamadi: ${block.type}`)
      return
    }

    const element = createBlockElement(block)
    if (!element) return

    const nodeTree = query.parseReactElement(element).toNodeTree()
    actions.addNodeTree(nodeTree, rootNodeId)
  })

  if (template.theme && setTheme) {
    setTheme({
      primaryColor: template.theme.primaryColor || '#3b82f6',
      secondaryColor: template.theme.secondaryColor || '#1e293b',
      fontFamily: template.theme.fontFamily || 'system-ui, sans-serif',
      borderRadius: template.theme.borderRadius || '8px',
    })
  }
}

export const registerAllComponents = (resolver: Record<string, any>) => {
  Object.entries(resolver).forEach(([name, component]) => {
    registerComponent(name, component)
  })
}
