import React from 'react'

export default function ProductCatalogStyles() {
  return (
    <style>{`
      .product-catalog-page {
        min-height: 100%;
        padding: 10px 12px 16px;
        background:
          radial-gradient(circle at top left, color-mix(in srgb, #f59e0b 12%, transparent), transparent 28%),
          radial-gradient(circle at bottom right, color-mix(in srgb, #2563eb 10%, transparent), transparent 20%),
          linear-gradient(180deg, var(--app-bg) 0%, var(--app-shell, var(--app-bg)) 100%);
        color: var(--app-text);
        min-width: 0;
        max-width: 100%;
        overflow-x: hidden;
      }
      .product-shell {
        display: grid;
        gap: 8px;
        min-width: 0;
      }
      .product-panel,
      .product-card,
      .product-settings-card {
        border: 1px solid var(--app-border);
        border-radius: 20px;
        background: var(--app-surface);
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
        min-width: 0;
        max-width: 100%;
      }
      .product-panel {
        padding: 8px 10px;
      }
      .product-panel--header {
        padding: 12px 14px;
      }
      .product-header-stack {
        display: grid;
        gap: 8px;
        min-width: 0;
      }
      .product-header-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        flex-wrap: wrap;
        min-width: 0;
      }
      .product-page-heading {
        min-width: 0;
        flex: 1 1 280px;
      }
      .product-page-title {
        margin: 0;
        font-size: 22px;
        line-height: 1.1;
        font-weight: 950;
        color: var(--app-text);
      }
      .product-page-subtitle {
        margin-top: 4px;
        color: var(--app-text-soft, var(--app-text-secondary));
        font-size: 13px;
        font-weight: 700;
        line-height: 1.4;
      }
      .product-header-controls {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        flex-wrap: wrap;
        flex: 1 1 560px;
        min-width: 0;
      }
      .product-toolbar {
        display: flex;
        gap: 8px;
        align-items: center;
        min-width: 0;
      }
      .product-toolbar-scroll,
      .product-category-bar,
      .product-list-row-wrap {
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none;
        -ms-overflow-style: none;
        cursor: grab;
      }
      .product-toolbar-scroll:active,
      .product-category-bar:active,
      .product-list-row-wrap:active {
        cursor: grabbing;
      }
      .product-toolbar-scroll::-webkit-scrollbar,
      .product-category-bar::-webkit-scrollbar,
      .product-list-row-wrap::-webkit-scrollbar {
        display: none;
      }
      .product-toolbar-scroll {
        display: flex;
        flex-wrap: nowrap;
      }
      .product-toolbar-scroll > * {
        flex: 0 0 auto;
        white-space: nowrap;
      }
      .product-pill-btn,
      .product-action-btn,
      .product-secondary-btn,
      .product-dark-btn {
        min-height: 38px;
        border-radius: 999px;
        padding: 8px 12px;
        border: 1px solid var(--app-border);
        font-weight: 900;
        font-size: 12px;
        transition: 0.18s ease;
        white-space: nowrap;
      }
      .product-action-btn {
        background: var(--app-surface-2, var(--app-surface-soft));
        color: var(--app-text);
        border-color: var(--app-border);
      }
      .product-secondary-btn {
        background: var(--app-button-bg);
        color: var(--app-text-soft, var(--app-text-secondary));
      }
      .product-dark-btn {
        background: linear-gradient(135deg, #111827, #1f2937);
        color: #ffffff;
        border-color: rgba(17, 24, 39, 0.95);
        box-shadow: 0 10px 22px rgba(15, 23, 42, 0.14);
      }
      .product-pill-btn.active {
        background: linear-gradient(135deg, #d79416, #e9a62e);
        color: #ffffff;
        border-color: #d79416;
        box-shadow: 0 10px 22px rgba(215, 148, 22, 0.28);
      }
      .product-pill-btn {
        background: var(--app-button-bg);
        color: var(--app-text-soft, var(--app-text-secondary));
      }
      .product-category-bar {
        display: flex;
        gap: 8px;
        padding: 2px 0;
        flex-wrap: nowrap;
      }
      .product-category-pill {
        flex: 0 0 auto;
        max-width: 180px;
        height: 36px;
        padding: 0 10px 0 14px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid var(--app-border);
        background: var(--app-surface-2, var(--app-surface-soft));
        color: var(--app-text-soft, var(--app-text-secondary));
      }
      .product-category-pill.active {
        background: linear-gradient(135deg, #d79416, #e9a62e);
        color: #ffffff;
        border-color: #d79416;
        box-shadow: 0 10px 22px rgba(215, 148, 22, 0.28);
      }
      .product-category-pill-trigger {
        min-width: 0;
        flex: 1 1 auto;
        height: 100%;
        border: 0;
        background: transparent;
        color: inherit;
        padding: 0;
        display: inline-flex;
        align-items: center;
        cursor: pointer;
      }
      .product-category-pill-name {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        font-size: 11px;
        font-weight: 900;
        line-height: 1;
      }
      .product-category-edit-btn {
        width: 22px;
        height: 22px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--app-border);
        background: color-mix(in srgb, var(--app-surface) 86%, transparent);
        color: var(--app-text-soft, var(--app-text-secondary));
        padding: 0;
        cursor: pointer;
      }
      .product-category-pill.active .product-category-edit-btn {
        border-color: rgba(255, 255, 255, 0.32);
        background: rgba(255, 255, 255, 0.18);
        color: #ffffff;
      }
      .product-list {
        display: grid;
        gap: 10px;
        min-width: 0;
      }
      .product-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
        min-width: 0;
      }
      .product-card {
        padding: 10px;
      }
      .product-list-row-wrap {
        width: 100%;
      }
      .product-card-list {
        display: grid;
        grid-template-columns: 28px 56px minmax(180px, 1.45fr) minmax(92px, 0.72fr) minmax(88px, 0.68fr) minmax(80px, 0.6fr) minmax(98px, 0.8fr) minmax(102px, 0.8fr) 140px 40px;
        gap: 8px;
        align-items: center;
        min-width: 920px;
      }
      .product-card-grid {
        display: grid;
        gap: 8px;
        padding: 10px;
        grid-template-rows: auto auto minmax(48px, auto) auto auto;
        align-content: start;
      }
      .product-card-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        min-width: 0;
      }
      .product-name-cell {
        min-width: 0;
      }
      .product-name-text {
        font-weight: 950;
        font-size: 13px;
        line-height: 1.25;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .product-name-subtext {
        color: var(--app-text-soft, var(--app-text-secondary));
        font-weight: 800;
        margin-top: 4px;
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .product-toggle-cell {
        min-width: 0;
      }
      .product-toggle-label {
        font-weight: 800;
        color: var(--app-text-soft, var(--app-text-secondary));
        font-size: 12px;
        white-space: nowrap;
      }
      .product-thumb {
        width: 56px;
        height: 56px;
        border-radius: 16px;
        overflow: hidden;
        background: linear-gradient(135deg, #fde9be, #f7d98b);
        display: grid;
        place-items: center;
        color: #7c4b00;
        font-weight: 900;
      }
      .product-thumb--card {
        width: 56px;
        height: 56px;
        margin: 0 auto;
        border-radius: 14px;
      }
      .product-thumb-fallback {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        font-weight: 900;
        letter-spacing: 0.04em;
      }
      .product-card-meta-top {
        color: var(--app-text-soft, var(--app-text-secondary));
        font-weight: 800;
        font-size: 11px;
        line-height: 1.3;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .product-card-copy {
        min-width: 0;
        text-align: center;
        display: grid;
        gap: 4px;
        align-content: start;
      }
      .product-card-title {
        font-weight: 950;
        font-size: 13px;
        line-height: 1.25;
        color: var(--app-text);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        min-height: calc(1.25em * 2);
        word-break: break-word;
      }
      .product-card-meta {
        color: var(--app-text-soft, var(--app-text-secondary));
        font-size: 11px;
        font-weight: 800;
        line-height: 1.35;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        min-height: calc(1.35em * 2);
        word-break: break-word;
      }
      .product-card-stats {
        display: grid;
        gap: 8px;
        align-self: stretch;
      }
      .product-card-settings-btn {
        min-height: 34px;
        padding: 0 12px;
        font-size: 12px;
        align-self: end;
      }
      .product-thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .product-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        padding: 6px 10px;
        background: color-mix(in srgb, #f59e0b 16%, var(--app-surface));
        color: color-mix(in srgb, #8a4b00 86%, var(--app-text));
        font-weight: 900;
        font-size: 12px;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .product-money-chip {
        background: #111827;
        color: #ffffff;
      }
      .product-stock-chip {
        background: color-mix(in srgb, #19a974 16%, var(--app-surface));
        color: #111111;
      }
      .product-row-actions {
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: flex-end;
      }
      .product-row-actions .product-dark-btn {
        min-height: 34px;
        padding: 0 12px;
        font-size: 12px;
      }
      .product-toolbar-field {
        flex: 0 0 auto;
      }
      .product-header-controls .product-toolbar-field {
        flex: 0 1 auto;
      }
      .product-toolbar-field .product-input,
      .product-toolbar-field .product-select {
        min-height: 42px;
        height: 42px;
        border-radius: 999px;
        font-size: 13px;
      }
      .product-toolbar-search .product-input {
        width: min(100%, 320px);
      }
      .product-toolbar-status .product-select {
        width: 128px;
      }
      .product-toolbar-branch .product-select {
        width: 170px;
      }
      .product-header-back-btn {
        min-height: 42px;
        padding-inline: 16px;
      }
      .product-toolbar-badge {
        min-height: 36px;
        padding: 0 12px;
        background: color-mix(in srgb, #f59e0b 16%, var(--app-surface));
        color: #fbbf24;
      }
      .product-kebab {
        display: none;
      }
      .product-kebab-portal {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .product-kebab-trigger {
        width: 36px;
        height: 36px;
        border-radius: 12px;
        border: 1px solid var(--app-border);
        display: grid;
        place-items: center;
        cursor: pointer;
        background: var(--app-surface);
        font-weight: 900;
        font-size: 12px;
      }
      .product-kebab-trigger.is-open {
        background: var(--app-surface-2, var(--app-surface-soft));
      }
      .product-kebab-menu {
        position: fixed;
        min-width: 180px;
        border-radius: 18px;
        border: 1px solid var(--app-border);
        background: var(--app-surface);
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.22);
        padding: 8px;
        z-index: 120;
        overflow-y: auto;
      }
      .product-kebab-menu button {
        width: 100%;
        min-height: 42px;
        border: 0;
        background: transparent;
        border-radius: 12px;
        text-align: left;
        padding: 0 12px;
        font-weight: 800;
        color: var(--app-text);
      }
      .product-kebab-menu button:hover {
        background: var(--app-surface-2, var(--app-surface-soft));
      }
      .product-settings-sticky {
        position: sticky;
        top: 14px;
        z-index: 10;
      }
      .product-settings-section {
        overflow: hidden;
        border-radius: 26px;
        border: 1px solid var(--app-border);
        background: var(--app-surface);
        box-shadow: 0 14px 32px rgba(15, 23, 42, 0.16);
      }
      .product-settings-section > button {
        width: 100%;
        border: 0;
        background: transparent;
        padding: 18px 20px;
        display: flex;
        align-items: center;
        gap: 14px;
        text-align: left;
      }
      .product-settings-section > button.open {
        background: linear-gradient(135deg, #111827, #1f2937);
        color: #ffffff;
      }
      .product-settings-body {
        padding: 18px;
        background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-2, var(--app-surface-soft)) 100%);
      }
      .product-form-grid {
        display: grid;
        gap: 14px;
      }
      .product-form-grid.cols-2 {
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      }
      .product-form-grid.cols-3 {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      .product-field {
        display: grid;
        gap: 5px;
      }
      .product-field span {
        font-size: 11px;
        font-weight: 900;
        color: var(--app-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .product-input,
      .product-select,
      .product-textarea {
        min-height: 42px;
        border-radius: 14px;
        border: 1px solid var(--app-input-border, var(--app-border));
        background: var(--app-input);
        color: var(--app-text);
        padding: 0 12px;
        font-weight: 800;
        font-size: 13px;
      }
      .product-textarea {
        min-height: 120px;
        padding: 14px;
        resize: vertical;
      }
      .product-toggle-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 70px;
        border-radius: 20px;
        border: 1px solid var(--app-border);
        padding: 14px 16px;
        background: var(--app-surface-2, var(--app-surface-soft));
      }
      .product-toggle {
        width: 48px;
        height: 28px;
        border-radius: 999px;
        background: var(--app-surface-3, var(--app-button-bg));
        padding: 3px;
        border: 0;
        display: flex;
        align-items: center;
        transition: 0.16s ease;
      }
      .product-toggle.active {
        justify-content: flex-end;
        background: linear-gradient(135deg, #22c55e, #16a34a);
      }
      .product-toggle i {
        width: 22px;
        height: 22px;
        border-radius: 999px;
        background: #ffffff;
        display: block;
        box-shadow: 0 4px 10px rgba(15, 23, 42, 0.18);
      }
      .product-inline-table {
        display: grid;
        gap: 10px;
      }
      .product-inline-table-row {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        align-items: end;
        border: 1px solid var(--app-border);
        border-radius: 18px;
        background: var(--app-surface);
        padding: 12px;
      }
      .product-preview {
        min-height: 320px;
        border: 2px dashed var(--app-border);
        border-radius: 24px;
        display: grid;
        place-items: center;
        background: linear-gradient(180deg, var(--app-surface-2, var(--app-surface-soft)), var(--app-surface));
        padding: 18px;
        text-align: center;
      }
      .product-preview-thumb {
        width: 180px;
        height: 180px;
        border-radius: 999px;
        overflow: hidden;
        background: var(--app-surface);
        box-shadow: 0 18px 36px rgba(15, 23, 42, 0.18);
        margin: 0 auto 14px;
      }
      .product-preview-thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .product-image-upload {
        display: grid;
        gap: 12px;
        border: 1px solid var(--app-border);
        border-radius: 24px;
        background: var(--app-surface);
        padding: 14px;
      }
      .product-image-upload.is-drag-active {
        border-color: #d79416;
        box-shadow: 0 0 0 3px rgba(215, 148, 22, 0.12);
      }
      .product-image-upload__head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
      }
      .product-image-upload__label {
        font-weight: 950;
        color: var(--app-text);
      }
      .product-image-upload__hint,
      .product-image-upload__size {
        color: var(--app-text-soft, var(--app-text-secondary));
        font-size: 12px;
        font-weight: 700;
      }
      .product-image-upload__dropzone {
        display: grid;
        gap: 12px;
        justify-items: center;
        text-align: center;
        border: 2px dashed var(--app-border);
        border-radius: 22px;
        padding: 18px;
        background: linear-gradient(180deg, var(--app-surface-2, var(--app-surface-soft)), var(--app-surface));
        cursor: pointer;
      }
      .product-image-upload__preview {
        width: min(220px, 100%);
        aspect-ratio: 1;
        border-radius: 24px;
        overflow: hidden;
        background: var(--app-surface);
        box-shadow: 0 18px 36px rgba(15, 23, 42, 0.14);
      }
      .product-image-upload__preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .product-image-upload__copy {
        display: grid;
        gap: 6px;
      }
      .product-image-upload__copy strong {
        color: var(--app-text);
        font-size: 14px;
      }
      .product-image-upload__copy span {
        color: var(--app-text-soft, var(--app-text-secondary));
        font-size: 12px;
        font-weight: 700;
      }
      .product-image-upload__actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .product-image-upload__actions label.product-secondary-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .product-image-upload__error {
        color: #b42318;
        font-weight: 900;
        font-size: 12px;
      }
      .product-modal-footer-row {
        position: sticky;
        bottom: 0;
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        padding-top: 14px;
        background: linear-gradient(180deg, rgba(15,23,42,0), color-mix(in srgb, var(--app-bg) 96%, transparent) 30%);
      }
      html[data-theme="light"].theme-white .product-action-btn,
      html[data-theme="light"].theme-white .product-secondary-btn,
      html[data-theme="light"].theme-white .product-pill-btn,
      html[data-theme="light"].theme-white .product-kebab-trigger {
        background: #ffffff;
        color: #111111;
        border-color: #d1d5db;
        box-shadow: none;
      }
      html[data-theme="light"].theme-white .product-dark-btn,
      html[data-theme="light"].theme-white .product-money-chip,
      html[data-theme="light"].theme-white .product-category-pill.active,
      html[data-theme="light"].theme-white .product-pill-btn.active,
      html[data-theme="light"].theme-white .product-toolbar-badge,
      html[data-theme="light"].theme-white .product-settings-section > button.open {
        background: #111111;
        color: #ffffff;
        border-color: #111111;
        box-shadow: none;
      }
      html[data-theme="light"].theme-white .product-stock-chip {
        background: #f3f4f6;
        color: #111111;
        border-color: #d1d5db;
      }
      html[data-theme="light"].theme-white .product-toggle.active {
        background: linear-gradient(135deg, #22c55e, #16a34a);
      }
      html[data-theme="light"].theme-white .product-toggle.active i {
        background: #ffffff;
      }
      html[data-theme="light"].theme-white .product-image-upload.is-drag-active {
        border-color: #111111;
        box-shadow: 0 0 0 3px rgba(17,17,17,0.08);
      }
      html[data-theme="light"].theme-white .product-category-edit-btn {
        background: #ffffff;
        color: #111111;
      }
      html[data-theme="light"].theme-white .product-chip {
        background: #f3f4f6;
        color: #111111;
      }
      html[data-theme="light"].theme-white .product-settings-section > button.open > div:first-child {
        background: #111111 !important;
        color: #ffffff !important;
      }
      html[data-theme="light"].theme-white .product-settings-section > button.open .product-chip {
        background: rgba(255,255,255,0.16) !important;
        color: #ffffff !important;
      }
      html[data-theme="light"].theme-white .product-card-title,
      html[data-theme="light"].theme-white .product-name-text,
      html[data-theme="light"].theme-white .product-card-meta-top,
      html[data-theme="light"].theme-white .product-card-meta,
      html[data-theme="light"].theme-white .product-name-subtext,
      html[data-theme="light"].theme-white .product-field span,
      html[data-theme="light"].theme-white .product-toggle-label {
        color: #111111;
      }
      @media (max-width: 1280px) {
        .product-card-list {
          min-width: 900px;
        }
      }
      @media (max-width: 1180px) {
        .product-list-row-wrap {
          overflow-x: visible;
          cursor: default;
        }
        .product-list-row-wrap:active {
          cursor: default;
        }
        .product-list-check { grid-area: check; }
        .product-list-thumb { grid-area: thumb; }
        .product-list-name { grid-area: name; }
        .product-list-category-chip { grid-area: category; }
        .product-list-price-chip { grid-area: price; }
        .product-list-stock-chip { grid-area: stock; }
        .product-toggle-cell--active { grid-area: active; }
        .product-toggle-cell--qr { grid-area: qr; }
        .product-list-actions { grid-area: actions; }
        .product-list-kebab { grid-area: kebab; justify-self: end; }
        .product-card-list {
          min-width: 0;
          gap: 8px 10px;
          grid-template-columns: 28px 52px minmax(180px, 1.2fr) auto auto;
          grid-template-areas:
            "check thumb name price kebab"
            "check thumb category stock stock"
            "check thumb active qr actions";
        }
        .product-list-name .product-name-text,
        .product-list-name .product-name-subtext {
          white-space: normal;
          overflow: visible;
          text-overflow: clip;
        }
        .product-toggle-cell > div {
          flex-wrap: nowrap;
          gap: 6px;
        }
        .product-toggle-label {
          font-size: 11px;
        }
        .product-toggle-cell,
        .product-list-stock-chip,
        .product-list-category-chip {
          justify-self: start;
        }
        .product-list-price-chip,
        .product-toggle-cell--qr,
        .product-list-actions,
        .product-list-kebab {
          justify-self: end;
        }
        .product-list-actions .product-dark-btn {
          min-height: 32px;
          padding: 0 10px;
          font-size: 11px;
        }
        .product-card {
          padding: 8px 10px;
        }
      }
      @media (max-width: 980px) {
        .product-card-list {
          grid-template-columns: 28px 52px minmax(0, 1fr) auto;
        }
        .product-toggle-cell > div {
          flex-wrap: wrap;
        }
      }
      @media (max-width: 768px) {
        .product-grid {
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        }
        .product-catalog-page {
          padding: 8px;
        }
        .product-page-title {
          font-size: 20px;
        }
        .product-header-controls {
          justify-content: stretch;
          flex-basis: 100%;
        }
        .product-header-controls > * {
          flex: 1 1 180px;
          min-width: 0;
        }
        .product-toolbar-search .product-input {
          width: 100%;
        }
        .product-toolbar-branch .product-select {
          width: 100%;
        }
        .product-toolbar-status .product-select {
          width: 100%;
        }
        .product-settings-section > button {
          padding: 14px;
          align-items: flex-start;
        }
        .product-toggle-card {
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .product-inline-table-row {
          grid-template-columns: minmax(0, 1fr);
        }
        .product-preview {
          min-height: 240px;
          padding: 14px;
        }
        .product-preview-thumb {
          width: min(180px, 56vw);
          height: min(180px, 56vw);
        }
        .product-card-list {
          gap: 6px 8px;
          grid-template-columns: 28px 52px minmax(0, 1fr) auto;
          grid-template-areas:
            "check thumb name kebab"
            "check thumb category price"
            "check thumb stock active"
            "check thumb qr actions";
          align-items: start;
        }
        .product-toggle-cell > div {
          flex-wrap: nowrap;
        }
        .product-toggle-label {
          font-size: 11px;
        }
        .product-list-actions,
        .product-list-kebab {
          justify-self: end;
        }
        .product-list-actions .product-dark-btn {
          width: auto;
          min-height: 32px;
          padding: 0 10px;
          font-size: 11px;
        }
      }
      @media (max-width: 480px) {
        .product-card {
          padding: 8px;
        }
        .product-card-list {
          gap: 6px 7px;
          grid-template-columns: 24px 48px minmax(0, 1fr) auto;
        }
        .product-thumb,
        .product-thumb--card {
          width: 48px;
          height: 48px;
          border-radius: 14px;
        }
        .product-chip {
          font-size: 11px;
          padding: 5px 8px;
        }
        .product-name-text {
          font-size: 12px;
        }
        .product-name-subtext {
          font-size: 11px;
          margin-top: 2px;
        }
      }
    `}</style>
  )
}
