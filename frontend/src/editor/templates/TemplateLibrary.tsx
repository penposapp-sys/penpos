import React, { useMemo, useState } from 'react'
import { allTemplates, templatesByCategory } from './index'
import type { Template } from './TemplateTypes'

interface TemplateLibraryProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (template: Template) => void
}

export const TemplateLibrary: React.FC<TemplateLibraryProps> = ({ isOpen, onClose, onSelect }) => {
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTemplates = useMemo(() => {
    return allTemplates.filter((template) => {
      const matchesCategory =
        activeCategory === 'all' ||
        templatesByCategory.find((cat) => cat.id === activeCategory)?.templates.some((item) => item.id === template.id)

      const queryText = searchQuery.trim().toLowerCase()
      const matchesSearch =
        queryText === '' ||
        template.name.toLowerCase().includes(queryText) ||
        template.description.toLowerCase().includes(queryText) ||
        template.tags.some((tag) => tag.toLowerCase().includes(queryText))

      return Boolean(matchesCategory && matchesSearch)
    })
  }, [activeCategory, searchQuery])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(4px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 20,
          maxWidth: 1120,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(15, 23, 42, 0.28)',
        }}
      >
        <div
          style={{
            padding: '24px 30px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 24, color: '#111827' }}>Sablon Kutuphanesi</h2>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
              Hazir site iskeletlerinden birini secip sayfaya tek tikla yukleyin.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f3f4f6',
              border: 'none',
              width: 38,
              height: 38,
              borderRadius: '50%',
              fontSize: 20,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            x
          </button>
        </div>

        <div
          style={{
            padding: '16px 30px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <input
            type="text"
            placeholder="Sablon ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '10px 14px',
              border: '1px solid #d1d5db',
              borderRadius: 10,
              fontSize: 14,
              minWidth: 220,
              flex: 1,
              maxWidth: 320,
            }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <CategoryChip label={`Tumu (${allTemplates.length})`} active={activeCategory === 'all'} onClick={() => setActiveCategory('all')} />
            {templatesByCategory.map((cat) => (
              <CategoryChip
                key={cat.id}
                label={`${cat.icon} ${cat.name} (${cat.templates.length})`}
                active={activeCategory === cat.id}
                onClick={() => setActiveCategory(cat.id)}
              />
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 30 }}>
          {filteredTemplates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>0</div>
              <p>Sonuc bulunamadi.</p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 20,
              }}
            >
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onSelect={() => {
                    onSelect(template)
                    onClose()
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        background: active ? '#3b82f6' : '#f3f4f6',
        color: active ? 'white' : '#374151',
        border: 'none',
        borderRadius: 999,
        fontSize: 13,
        cursor: 'pointer',
        fontWeight: active ? 700 : 500,
      }}
    >
      {label}
    </button>
  )
}

function TemplateCard({ template, onSelect }: { template: Template; onSelect: () => void }) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onSelect}
      style={{
        background: 'white',
        borderRadius: 14,
        border: isHovered ? '2px solid #3b82f6' : '2px solid #e5e7eb',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: isHovered ? '0 12px 24px rgba(59, 130, 246, 0.15)' : '0 2px 8px rgba(0, 0, 0, 0.05)',
      }}
    >
      <div
        style={{
          height: 160,
          background: `linear-gradient(135deg, ${template.theme?.primaryColor || '#3b82f6'}, ${template.theme?.secondaryColor || '#1e293b'})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <div style={{ fontSize: 54, color: 'white', fontWeight: 800, letterSpacing: '0.06em' }}>{template.thumbnail}</div>
        {isHovered ? (
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'white',
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              color: '#3b82f6',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            Kullan
          </div>
        ) : null}
      </div>

      <div style={{ padding: 18 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#111827' }}>{template.name}</h3>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280', lineHeight: 1.5, minHeight: 40 }}>{template.description}</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {template.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              style={{
                padding: '4px 10px',
                background: '#f3f4f6',
                color: '#4b5563',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
