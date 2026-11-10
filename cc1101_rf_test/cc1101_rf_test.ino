#include <SPI.h>
#include <RadioLib.h>

// Separate frequency-check sketch for ESP32 + CC1101.
// Serial commands: 1 = 315 MHz, 2 = 433.92 MHz, A/B/C = capture a button.
// The remote's actual frequency is unknown; test both frequencies.

static constexpr int PIN_CS = 5;
static constexpr int PIN_GDO0 = 4;
static constexpr int PIN_SCK = 18;
static constexpr int PIN_MISO = 19;
static constexpr int PIN_MOSI = 23;
static constexpr uint32_t FREQ_315_HZ = 315000000UL;
static constexpr uint32_t FREQ_433_HZ = 433920000UL;
static constexpr uint32_t WINDOW_MS = 5000;
static constexpr uint32_t RSSI_INTERVAL_MS = 100;

CC1101 radio = new Module(PIN_CS, PIN_GDO0, RADIOLIB_NC, RADIOLIB_NC);

volatile uint32_t edgeCount = 0;
volatile bool captureEdges = false;
uint32_t currentFrequencyHz = FREQ_315_HZ;
uint32_t windowStartMs = 0;
uint32_t lastRssiMs = 0;
uint32_t rssiSamples = 0;
float rssiSum = 0.0f;
float rssiMin = 100.0f;
float rssiMax = -200.0f;
char captureLabel = '-';
enum WindowMode : uint8_t { WAITING, BASELINE, BUTTON_CAPTURE };
WindowMode windowMode = BASELINE;

void IRAM_ATTR onGdo0Edge() {
  if (captureEdges) edgeCount++;
}

void resetRssiStats() {
  rssiSamples = 0;
  rssiSum = 0.0f;
  rssiMin = 100.0f;
  rssiMax = -200.0f;
}

void beginWindow(WindowMode mode, char label) {
  noInterrupts();
  edgeCount = 0;
  captureEdges = true;
  interrupts();
  resetRssiStats();
  captureLabel = label;
  windowMode = mode;
  windowStartMs = millis();
  lastRssiMs = 0;
  if (mode == BASELINE) {
    Serial.printf("\n[%.2f MHz] Kumandaya basmadan 5 sn ortam olcumu.\n",
                  currentFrequencyHz / 1000000.0f);
  } else {
    Serial.printf("\n[%c, %.2f MHz] Kayit basladi; bu 5 sn icinde kumanda tusuna birkac kez basin.\n",
                  label, currentFrequencyHz / 1000000.0f);
  }
}

void selectFrequency(uint32_t frequencyHz) {
  noInterrupts();
  captureEdges = false;
  interrupts();
  detachInterrupt(digitalPinToInterrupt(PIN_GDO0));

  int state = radio.setFrequency(frequencyHz);
  if (state != RADIOLIB_ERR_NONE) {
    Serial.printf("Frekans ayarlanamadi (RadioLib hata %d).\n", state);
    attachInterrupt(digitalPinToInterrupt(PIN_GDO0), onGdo0Edge, CHANGE);
    return;
  }
  state = radio.receiveDirectAsync();
  if (state != RADIOLIB_ERR_NONE) {
    Serial.printf("RX yeniden baslatilamadi (RadioLib hata %d).\n", state);
    attachInterrupt(digitalPinToInterrupt(PIN_GDO0), onGdo0Edge, CHANGE);
    return;
  }

  currentFrequencyHz = frequencyHz;
  attachInterrupt(digitalPinToInterrupt(PIN_GDO0), onGdo0Edge, CHANGE);
  beginWindow(BASELINE, '-');
}

void finishWindow() {
  noInterrupts();
  captureEdges = false;
  const uint32_t edges = edgeCount;
  interrupts();
  windowMode = WAITING;

  const char *kind = captureLabel == '-' ? "Ortam" : "TUS";
  if (rssiSamples == 0) {
    Serial.printf("%s sonucu: frekans=%.2f MHz, GDO0 kenari=%lu, RSSI ornegi yok.\n",