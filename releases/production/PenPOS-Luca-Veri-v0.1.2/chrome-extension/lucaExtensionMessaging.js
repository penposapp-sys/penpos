globalThis.isLucaExtensionRuntimeAvailable = () => {
  try {
    return Boolean(
      globalThis.chrome?.runtime?.id &&
      typeof globalThis.chrome.runtime.sendMessage === "function"
    )
  } catch {
    return false
  }
}

globalThis.sendLucaExtensionMessage = message => {
  let runtime

  try {
    runtime = globalThis.chrome?.runtime
    if (!runtime?.id || typeof runtime.sendMessage !== "function") {
      throw new Error("Extension bağlantısı artık etkin değil.")
    }

    return Promise.resolve(runtime.sendMessage(message)).catch(error => {
      const errorMessage = String(error?.message || error)
      if (/extension context invalidated|context invalidated/i.test(errorMessage)) {
        throw new Error(
          "Chrome Extension yeniden yüklendi veya bağlantısı kesildi. Luca sekmesini yenileyip görevi yeniden başlatın."
        )
      }
      throw error
    })
  } catch (error) {
    if (/extension context invalidated|context invalidated/i.test(String(error?.message || error))) {
      return Promise.reject(
        new Error(
          "Chrome Extension yeniden yüklendi veya bağlantısı kesildi. Luca sekmesini yenileyip görevi yeniden başlatın."
        )
      )
    }
    return Promise.reject(error)
  }
}
