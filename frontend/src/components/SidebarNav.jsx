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
          style: {
            justifyContent: collapsed ? 'center' : 'flex-start',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: active ? 'var(--canteen-nav-active-bg, #e5e7eb)' : 'transparent',
            color: active ? 'var(--canteen-nav-active-text, #111827)' : 'var(--canteen-nav-text, #6b7280)',
            borderColor: active ? 'var(--canteen-nav-active-border, transparent)' : 'transparent',
            boxShadow: active ? 'var(--canteen-nav-active-shadow, none)' : 'none'
          }
        }

        const content = (
          <>
            {!!Icon && (
              <span
                className="nav-icon"
                style={{
                  background: active ? 'var(--canteen-nav-icon-active-bg, #111827)' : 'var(--canteen-nav-icon-bg, rgba(255,255,255,0.08))',
                  color: active ? 'var(--canteen-nav-icon-active-text, #ffffff)' : 'var(--canteen-nav-icon-text, currentColor)',
                  boxShadow: active ? 'var(--canteen-nav-icon-active-shadow, none)' : 'none'
                }}
              >
                <Icon size={18} />
              </span>
            )}
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
