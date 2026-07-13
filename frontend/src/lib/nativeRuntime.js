import { Capacitor, registerPlugin } from '@capacitor/core'

const PenposRuntime = registerPlugin('PenposRuntime')

export const getNativeRuntimeCapabilities = async () => {
  if (!Capacitor.isNativePlatform()) {
    return {
      nativePlatform: false,
      firebaseConfigured: false,
      pushAvailable: false,
    }
  }

  try {
    const result = await PenposRuntime.getCapabilities()
    return {
      nativePlatform: result?.nativePlatform === true,
      firebaseConfigured: result?.firebaseConfigured === true,
      pushAvailable: result?.pushAvailable === true,
    }
  } catch (err) {
    console.error('Native runtime capability check failed', err)
    return {
      nativePlatform: true,
      firebaseConfigured: false,
      pushAvailable: false,
    }
  }
}
