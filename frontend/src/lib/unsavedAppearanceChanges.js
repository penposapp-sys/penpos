let activeGuard = null

export function registerUnsavedAppearanceChanges(owner, isDirty, onDiscard) {
  if (isDirty) {
    activeGuard = { owner, onDiscard }
  } else if (activeGuard?.owner === owner) {
    activeGuard = null
  }
}

export function confirmUnsavedAppearanceChanges() {
  if (!activeGuard) return true
  const confirmed = window.confirm('Kaydetmediğiniz değişiklikler iptal edilecektir. Devam etmek istiyor musunuz?')
  if (!confirmed) return false
  const guard = activeGuard
  activeGuard = null
  guard.onDiscard?.()
  return true
}

export function hasUnsavedAppearanceChanges() {
  return Boolean(activeGuard)
}
