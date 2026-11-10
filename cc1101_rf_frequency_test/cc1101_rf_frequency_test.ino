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
                  kind, currentFrequencyHz / 1000000.0f, (unsigned long)edges);
  } else {
    Serial.printf("%s sonucu: frekans=%.2f MHz, GDO0 kenari=%lu, RSSI ort/min/max=%.1f/%.1f/%.1f dBm (%lu ornek).\n",
                  kind, currentFrequencyHz / 1000000.0f, (unsigned long)edges,
                  rssiSum / rssiSamples, rssiMin, rssiMax, (unsigned long)rssiSamples);
  }
  if (captureLabel == '-') {
    Serial.println("A/B/C gonderin; ilgili kumanda tusuna kayit sirasinda basin.");
  } else {
    Serial.println("Baska tus icin A/B/C, frekans degistirmek icin 1 (315) veya 2 (433.92) gonderin.");
    captureLabel = '-';
  }
}

void handleSerial() {
  while (Serial.available()) {
    char ch = (char)Serial.read();
    if (ch >= 'a' && ch <= 'z') ch -= ('a' - 'A');
    if (ch == '\r' || ch == '\n' || ch == ' ') continue;

    if (ch == '1' || ch == '2') {
      selectFrequency(ch == '1' ? FREQ_315_HZ : FREQ_433_HZ);
    } else if ((ch == 'A' || ch == 'B' || ch == 'C') && windowMode == WAITING) {
      beginWindow(BUTTON_CAPTURE, ch);
    } else if (ch == 'A' || ch == 'B' || ch == 'C') {
      Serial.println("Olcum devam ediyor; tamamlanmasini bekleyin.");
    } else {
      Serial.println("Komut: 1=315 MHz, 2=433.92 MHz, A/B/C=ayri tus kaydi.");
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("ESP32 + CC1101 iki frekansli RF kumanda testi");
  Serial.printf("SPI: SCK=%d MISO=%d MOSI=%d CS=%d; GDO0=%d\n",
                PIN_SCK, PIN_MISO, PIN_MOSI, PIN_CS, PIN_GDO0);

  SPI.begin(PIN_SCK, PIN_MISO, PIN_MOSI, PIN_CS);
  ConfigFSK_t config;
  config.frequency = FREQ_315_HZ;
  const int state = radio.begin(config);
  if (state != RADIOLIB_ERR_NONE) {
    Serial.printf("CC1101 baslatilamadi (RadioLib hata %d).\n", state);
    while (true) delay(1000);
  }
  int rxState = radio.setOOK(true);
  if (rxState != RADIOLIB_ERR_NONE) {
    Serial.printf("OOK ayari basarisiz (RadioLib hata %d).\n", rxState);
    while (true) delay(1000);
  }
  rxState = radio.receiveDirectAsync();
  if (rxState != RADIOLIB_ERR_NONE) {
    Serial.printf("RX baslatilamadi (RadioLib hata %d).\n", rxState);
    while (true) delay(1000);
  }

  pinMode(PIN_GDO0, INPUT);
  attachInterrupt(digitalPinToInterrupt(PIN_GDO0), onGdo0Edge, CHANGE);
  Serial.println("Baslangic frekansi 315 MHz. Kumandaya basmadan bekleyin.");
  beginWindow(BASELINE, '-');
}

void loop() {
  handleSerial();

  const uint32_t now = millis();
  if (windowMode != WAITING && (uint32_t)(now - windowStartMs) >= WINDOW_MS) {
    finishWindow();
  }
  if (windowMode != WAITING && (uint32_t)(now - lastRssiMs) >= RSSI_INTERVAL_MS) {
    lastRssiMs = now;
    const float rssi = radio.getRSSI();
    if (rssi >= -199.0f && rssi <= 20.0f) {
      rssiSum += rssi;
      if (rssi < rssiMin) rssiMin = rssi;
      if (rssi > rssiMax) rssiMax = rssi;
      rssiSamples++;
    }
  }
}
