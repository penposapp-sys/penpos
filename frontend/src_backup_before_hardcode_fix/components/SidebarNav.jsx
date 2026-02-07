import React from 'react'
import { Link } from 'react-router-dom'

export default function SidebarNav({ items, collapsed, onNavigate }) {
  const list = Array.isArray(items) ? items : []
  return (
    <nav style={{ display: 'grid', gap: 8 }}>
      {list.map((i) => {
        const Icon = i.icon
        const active = !!i.active
        const className = active ? 'nav-link active' : 'nav-link'
        const commonProps = {
          className,
          onClick: () => {
            try { onNavigate?.(i) } catch {}
          },
          style: { justifyContent: collapsed ? 'center' : 'flex-start', display: 'flex', alignItems: 'center', gap: 10 }
        }

        const content = (
          <>
            {!!Icon && <span className="nav-icon"><Icon size={18} /></span>}
            {!collapsed && <span className="nav-label">{i.label}</span>}
          </>
        )

        if (i.type === 'button') {
          return (
            <button key={i.key || i.label} type="button" {...commonProps}>
              {content}
            </button>
          )
        }

        return (
          <Link key={i.key || i.to || i.label} to={i.to || '/'} {...commonProps}>
            {content}
          </Link>
        )
      })}
    </nav>
  )
}

