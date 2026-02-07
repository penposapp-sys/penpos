import React from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function SettingsSubnav({ title, items }) {
  const { pathname } = useLocation()
  const list = Array.isArray(items) ? items : []

  return (
    <aside className="card" style={{ padding: 10 }}>
      {!!title && <div style={{ fontWeight: 800, marginBottom: 8 }}>{title}</div>}
      <div className="subnav">
        {list.map((i) => {
          const active = pathname === i.path || pathname.startsWith(i.path + '/')
          const className = active ? 'subnav-pill is-active' : 'subnav-pill'
          return (
            <Link key={i.path} to={i.path} className={className}>
              {i.label}
            </Link>
          )
        })}
      </div>
    </aside>
  )
}

