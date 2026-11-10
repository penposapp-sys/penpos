#include <Arduino.h>
#include <SPI.h>
#include <Preferences.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "driver/gpio.h"
#include "esp_attr.h"
#include "esp_system.h"

constexpr uint8_t PIN_CC1101_CS = 5;
constexpr uint8_t PIN_CC1101_GDO0 = 4;
constexpr uint8_t PIN_SPI_SCK = 18;
constexpr uint8_t PIN_SPI_MISO = 19;
constexpr uint8_t PIN_SPI_MOSI = 23;
constexpr uint32_t SERIAL_BAUD = 9600;
constexpr uint32_t SERIAL_LINE_IDLE_TIMEOUT_MS = 100;
constexpr uint32_t RF_FREQUENCY_MHZ_X100 = 43392;
constexpr uint32_t CC1101_RECEIVER_BANDWIDTH_KHZ_X10 = 2031;
constexpr uint32_t FRAME_GAP_US = 5000;
constexpr uint16_t MIN_PULSE_US = 50;
constexpr uint16_t MAX_PULSE_US = 30000;
constexpr uint16_t MIN_PULSES = 12;
constexpr uint16_t MAX_PULSES = 256;
constexpr uint8_t FRAME_QUEUE_SIZE = 12;
constexpr uint8_t CLUSTER_COUNT = 6;
constexpr uint8_t REQUIRED_REPEAT_COUNT = 3;
constexpr uint32_t CLUSTER_TTL_MS = 700;
constexpr uint32_t LEARNING_CLUSTER_TTL_MS = 2500;
constexpr uint8_t BUTTON_MATCH_MIN_QUALITY = 80;
constexpr uint32_t MIN_FRAME_ACTIVE_US = 1800;
constexpr uint16_t MATCH_TOLERANCE_US = 160;
constexpr uint8_t MATCH_QUALITY_MIN = 68;
constexpr uint8_t MATCH_QUALITY_MARGIN = 10;

constexpr uint8_t CC1101_SRES = 0x30;
constexpr uint8_t CC1101_SRX = 0x34;
constexpr uint32_t CC1101_SPI_CLOCK_HZ = 4000000;
constexpr uint32_t CC1101_READY_TIMEOUT_US = 2000;
constexpr uint32_t RECEIVER_DIAGNOSTICS_INTERVAL_MS = 1000;
constexpr uint32_t RSSI_SAMPLE_INTERVAL_MS = 20;
constexpr uint8_t CC1101_MARCSTATE_RX = 0x0D;

struct CapturedFrame {
  uint16_t count;
  uint16_t storedCount;
  uint32_t totalDurationUs;
  uint16_t minPulseUs;
  uint16_t maxPulseUs;
  uint8_t firstLevel;
  bool valid;
  uint8_t rejectionCode;
  uint16_t pulseUs[MAX_PULSES];
};

enum FrameRejectionCode : uint8_t {
  FRAME_REJECTION_NONE = 0,
  FRAME_REJECTION_TOO_SHORT = 1,
  FRAME_REJECTION_INVALID_PULSE = 2,
  FRAME_REJECTION_TOO_MANY_PULSES = 3,
  FRAME_REJECTION_LOW_ACTIVITY = 4
};

struct SignalCluster {
  bool active;
  uint16_t count;
  uint8_t firstLevel;
  uint16_t pulseUs[MAX_PULSES];
  uint8_t repeatCount;
  uint8_t qualityPct;
  uint32_t lastSeenMs;
  uint32_t lastReportedMs;
  uint32_t clusterId;
  bool matchReported;
};

struct LearnedSample {
  uint16_t count;
  uint8_t firstLevel;
  uint16_t pulseUs[MAX_PULSES];
};

volatile CapturedFrame frameQueue[FRAME_QUEUE_SIZE];
volatile uint8_t queueReadIndex = 0;
volatile uint8_t queueWriteIndex = 0;
volatile uint8_t queuedFrameCount = 0;
volatile uint16_t currentPulseUs[MAX_PULSES];
volatile uint16_t currentPulseCount = 0;
volatile uint16_t currentStoredPulseCount = 0;
volatile uint32_t currentFrameDurationUs = 0;
volatile uint16_t currentMinPulseUs = UINT16_MAX;
volatile uint16_t currentMaxPulseUs = 0;
volatile uint8_t currentFirstLevel = HIGH;
volatile bool capturingFrame = false;
volatile bool frameBoundarySeen = false;
volatile uint8_t currentFrameRejectionCode = FRAME_REJECTION_NONE;
volatile uint32_t previousEdgeUs = 0;
volatile uint32_t lastGdo0EdgeUs = 0;
portMUX_TYPE frameQueueMux = portMUX_INITIALIZER_UNLOCKED;
volatile uint32_t isrEdgeCount = 0;
volatile uint32_t rawFramesQueued = 0;
volatile uint32_t filteredShortFrames = 0;
volatile uint32_t filteredLowActivityFrames = 0;
volatile uint32_t filteredInvalidPulses = 0;
volatile uint32_t filteredOversizedFrames = 0;
volatile uint32_t filteredQueueFullFrames = 0;
volatile uint32_t learningShortRejectsPending = 0;
volatile uint32_t learningInvalidRejectsPending = 0;
uint32_t processedFrameCount = 0;
uint32_t invalidQueuedFrameCount = 0;
uint32_t captureId = 0;
uint32_t nextClusterId = 1;
SignalCluster signalClusters[CLUSTER_COUNT] = {};
SignalCluster learningCluster = {};
LearnedSample learnedSamples[3] = {};
bool learnedSampleValid[3] = {};
Preferences preferences;
char learningLabel = '\0';
bool captureSessionActive = false;
char serialCommand[32] = {};
uint8_t serialCommandLength = 0;
bool serialCommandOverflow = false;
uint32_t serialCommandLastByteMs = 0;
RTC_DATA_ATTR uint32_t retainedBootCount = 0;

const uint8_t receiverRegisters[][2] = {
  {0x00, 0x2E}, // IOCFG2
  {0x01, 0x2E}, // IOCFG1
  {0x02, 0x0D}, // IOCFG0: asynchronous serial data output
  {0x03, 0x47}, // FIFOTHR
  {0x08, 0x32}, // PKTCTRL0: asynchronous serial mode
  {0x0B, 0x06}, // FSCTRL1
  {0x0C, 0x00}, // FSCTRL0
  {0x0D, 0x10}, // FREQ2
  {0x0E, 0xB0}, // FREQ1
  {0x0F, 0x71}, // FREQ0: 433.92 MHz with a 26 MHz crystal
  {0x10, 0x87}, // MDMCFG4: approximately 203 kHz RX bandwidth, data-rate exponent 7
  {0x11, 0x83}, // MDMCFG3: data-rate mantissa
  {0x12, 0x30}, // MDMCFG2: ASK/OOK, no sync-word filtering
  {0x13, 0x22}, // MDMCFG1
  {0x14, 0xF8}, // MDMCFG0
  {0x15, 0x00}, // DEVIATN (unused in ASK/OOK)
  {0x18, 0x18}, // MCSM0
  {0x19, 0x16}, // FOCCFG
  {0x1A, 0x6C}, // BSCFG
  {0x1B, 0x43}, // AGCCTRL2
  {0x1C, 0x40}, // AGCCTRL1
  {0x1D, 0x91}, // AGCCTRL0
  {0x21, 0x56}, // FREND1
  {0x22, 0x11}, // FREND0: OOK front-end
  {0x23, 0xE9}, // FSCAL3
  {0x24, 0x2A}, // FSCAL2
  {0x25, 0x00}, // FSCAL1
  {0x26, 0x1F}, // FSCAL0
  {0x2C, 0x81}, // TEST2
  {0x2D, 0x35}, // TEST1
  {0x2E, 0x09}  // TEST0
};

constexpr size_t RECEIVER_REGISTER_COUNT =
    sizeof(receiverRegisters) / sizeof(receiverRegisters[0]);
uint8_t receiverRegisterReadback[RECEIVER_REGISTER_COUNT] = {};
bool receiverRegisterReadbackValid[RECEIVER_REGISTER_COUNT] = {};
bool cc1101SpiReady = false;
bool cc1101RegisterReadbackVerified = false;
bool cc1101RxConfirmed = false;
bool gdo0InterruptAttached = false;
const char *cc1101InitFailureReason = "";
uint32_t nextReceiverDiagnosticsMs = 0;
uint32_t nextRssiSampleMs = 0;
uint32_t lastDiagnosticsEdgeCount = 0;
uint8_t previousRssiRaw = 0;
bool previousRssiSampleAvailable = false;
int16_t rssiWindowMinSignedRaw = INT8_MAX;
int16_t rssiWindowMaxSignedRaw = INT8_MIN;
int32_t rssiWindowSumSignedRaw = 0;
uint32_t rssiWindowSampleCount = 0;
int16_t previousRssiWindowAverageSignedRaw = 0;
bool previousRssiWindowAverageAvailable = false;

bool cc1101Select() {
  SPI.beginTransaction(SPISettings(CC1101_SPI_CLOCK_HZ, MSBFIRST, SPI_MODE0));
  digitalWrite(PIN_CC1101_CS, LOW);
  const uint32_t startedAtUs = micros();
  while (digitalRead(PIN_SPI_MISO) == HIGH) {
    if (micros() - startedAtUs >= CC1101_READY_TIMEOUT_US) {
      digitalWrite(PIN_CC1101_CS, HIGH);
      SPI.endTransaction();
      return false;
    }
    delayMicroseconds(1);
  }
  return true;
}

void cc1101Deselect() {
  digitalWrite(PIN_CC1101_CS, HIGH);
  delayMicroseconds(2);
  SPI.endTransaction();
}

bool cc1101Strobe(const uint8_t command) {
  if (!cc1101Select()) return false;
  SPI.transfer(command);
  cc1101Deselect();
  return true;
}

bool cc1101WriteRegister(const uint8_t address, const uint8_t value) {
  if (!cc1101Select()) return false;
  SPI.transfer(address);
  SPI.transfer(value);
  cc1101Deselect();
  return true;
}

bool cc1101ReadRegister(const uint8_t address, uint8_t &value) {
  if (!cc1101Select()) return false;
  SPI.transfer(address | 0x80);
  value = SPI.transfer(0);
  cc1101Deselect();
  return true;
}

bool cc1101ReadStatusRegister(const uint8_t address, uint8_t &value) {
  if (!cc1101Select()) return false;
  SPI.transfer(address | 0xC0);
  value = SPI.transfer(0);
  cc1101Deselect();
  return true;
}

bool waitForCc1101Ready() {
  const uint32_t startedAt = micros();
  while (digitalRead(PIN_SPI_MISO) == HIGH) {
    if (micros() - startedAt >= CC1101_READY_TIMEOUT_US) return false;
    delayMicroseconds(10);
  }
  return true;
}

bool resetCc1101() {
  digitalWrite(PIN_CC1101_CS, HIGH);
  delay(1);
  SPI.beginTransaction(SPISettings(CC1101_SPI_CLOCK_HZ, MSBFIRST, SPI_MODE0));
  digitalWrite(PIN_CC1101_CS, LOW);
  if (!waitForCc1101Ready()) {
    digitalWrite(PIN_CC1101_CS, HIGH);
    SPI.endTransaction();
    return false;
  }
  SPI.transfer(CC1101_SRES);
  cc1101Deselect();
  delayMicroseconds(40);
  if (!cc1101Select()) return false;
  const bool ready = waitForCc1101Ready();
  cc1101Deselect();
  return ready;
}

bool configureCc1101() {
  pinMode(PIN_CC1101_CS, OUTPUT);
  digitalWrite(PIN_CC1101_CS, HIGH);
  SPI.begin(PIN_SPI_SCK, PIN_SPI_MISO, PIN_SPI_MOSI, PIN_CC1101_CS);

  if (!resetCc1101()) {
    cc1101InitFailureReason = "reset_or_spi_ready_timeout";
    return false;
  }
  cc1101SpiReady = true;
  delay(2);

  for (size_t index = 0; index < RECEIVER_REGISTER_COUNT; index++) {
    if (!cc1101WriteRegister(receiverRegisters[index][0], receiverRegisters[index][1])) {
      cc1101SpiReady = false;
      cc1101InitFailureReason = "register_write_timeout";
      return false;
    }
  }

  cc1101RegisterReadbackVerified = true;
  for (size_t index = 0; index < RECEIVER_REGISTER_COUNT; index++) {
    receiverRegisterReadbackValid[index] = cc1101ReadRegister(
        receiverRegisters[index][0],
        receiverRegisterReadback[index]);
    if (!receiverRegisterReadbackValid[index]) {
      cc1101SpiReady = false;
      cc1101RegisterReadbackVerified = false;
      cc1101InitFailureReason = "register_read_timeout";
      return false;
    }
    if (receiverRegisterReadback[index] != receiverRegisters[index][1]) {
      cc1101RegisterReadbackVerified = false;
    }
  }
  if (!cc1101RegisterReadbackVerified) {
    cc1101InitFailureReason = "register_readback_mismatch";
  }

  if (!cc1101Strobe(CC1101_SRX)) {
    cc1101SpiReady = false;
    cc1101InitFailureReason = "srx_strobe_timeout";
    return false;
  }
  delay(2);
  uint8_t marcstate = 0xFF;
  cc1101RxConfirmed = false;
  for (uint8_t attempt = 0; attempt < 20; attempt++) {
    if (!cc1101ReadStatusRegister(0x35, marcstate)) {
      cc1101SpiReady = false;
      cc1101InitFailureReason = "marcstate_read_timeout";
      return false;
    }
    if ((marcstate & 0x1F) == CC1101_MARCSTATE_RX) {
      cc1101RxConfirmed = true;
      break;
    }
    delay(5);
  }
  return true;
}

bool receiverRegisterMatches(const uint8_t address, const uint8_t expected) {
  for (size_t index = 0; index < RECEIVER_REGISTER_COUNT; index++) {
    if (receiverRegisters[index][0] != address) continue;
    return receiverRegisterReadbackValid[index] &&
        receiverRegisterReadback[index] == expected;
  }
  return false;
}

const char *cc1101StateName(const uint8_t marcstate) {
  switch (marcstate & 0x1F) {
    case 0x00: return "SLEEP";
    case 0x01: return "IDLE";
    case 0x02: return "XOFF";
    case 0x03: return "VCOON_MC";
    case 0x04: return "REGON_MC";
    case 0x05: return "MANCAL";
    case 0x06: return "VCOON";
    case 0x07: return "REGON";
    case 0x08: return "STARTCAL";
    case 0x09: return "BWBOOST";
    case 0x0A: return "FS_LOCK";
    case 0x0B: return "IFADCON";
    case 0x0C: return "ENDCAL";
    case 0x0D: return "RX";
    case 0x0E: return "RX_END";
    case 0x0F: return "RX_RST";
    case 0x10: return "TXRX_SWITCH";
    case 0x11: return "TX";
    case 0x12: return "TX_END";
    case 0x13: return "RXFIFO_OVERFLOW";
    case 0x14: return "FSTXON";
    case 0x15: return "TXFIFO_UNDERFLOW";
    default: return "OTHER";
  }
}

bool readReceiverRuntimeState(uint8_t &marcstate, uint8_t &rssiRaw) {
  const bool marcstateRead = cc1101ReadStatusRegister(0x35, marcstate);
  const bool rssiRead = cc1101ReadStatusRegister(0x34, rssiRaw);
  return marcstateRead && rssiRead;
}

void sampleReceiverRssi() {
  const uint32_t nowMs = millis();
  if (!captureSessionActive ||
      !cc1101SpiReady ||
      static_cast<int32_t>(nowMs - nextRssiSampleMs) < 0) return;
  nextRssiSampleMs = nowMs + RSSI_SAMPLE_INTERVAL_MS;

  uint8_t rssiRaw = 0;
  if (!cc1101ReadStatusRegister(0x34, rssiRaw)) return;
  const int16_t signedRssiRaw = static_cast<int8_t>(rssiRaw);
  if (rssiWindowSampleCount == 0) {
    rssiWindowMinSignedRaw = signedRssiRaw;
    rssiWindowMaxSignedRaw = signedRssiRaw;
  } else {
    if (signedRssiRaw < rssiWindowMinSignedRaw) rssiWindowMinSignedRaw = signedRssiRaw;
    if (signedRssiRaw > rssiWindowMaxSignedRaw) rssiWindowMaxSignedRaw = signedRssiRaw;
  }
  rssiWindowSumSignedRaw += signedRssiRaw;
  rssiWindowSampleCount++;
}

bool currentAsyncOokState(const uint8_t marcstate, const bool statusRead) {
  return cc1101SpiReady &&
      cc1101RegisterReadbackVerified &&
      receiverRegisterMatches(0x02, 0x0D) &&
      receiverRegisterMatches(0x08, 0x32) &&
      receiverRegisterMatches(0x10, 0x87) &&
      receiverRegisterMatches(0x11, 0x83) &&
      receiverRegisterMatches(0x12, 0x30) &&
      receiverRegisterMatches(0x0D, 0x10) &&
      receiverRegisterMatches(0x0E, 0xB0) &&
      receiverRegisterMatches(0x0F, 0x71) &&
      gdo0InterruptAttached &&
      statusRead &&
      (marcstate & 0x1F) == CC1101_MARCSTATE_RX;
}

void writeReceiverConfigStatus() {
  uint8_t marcstate = 0xFF;
  uint8_t rssiRaw = 0xFF;
  const bool statusRead = cc1101SpiReady && readReceiverRuntimeState(marcstate, rssiRaw);
  const bool asyncOokConfigured = currentAsyncOokState(marcstate, statusRead);
  Serial.print("{\"version\":1,\"type\":\"rf.receiver\",\"gdo0Pin\":");
  Serial.print(PIN_CC1101_GDO0);
  Serial.print(",\"gdo0Mode\":\"interrupt_change\",\"gdo0InterruptAttached\":");
  Serial.print(gdo0InterruptAttached ? "true" : "false");
  Serial.print(",\"spiReadbackVerified\":");
  Serial.print(cc1101RegisterReadbackVerified ? "true" : "false");
  Serial.print(",\"rxConfirmedOnStartup\":");
  Serial.print(cc1101RxConfirmed ? "true" : "false");
  Serial.print(",\"initFailureReason\":\"");
  Serial.print(cc1101InitFailureReason);
  Serial.print("\",\"frequencyMHz\":");
  Serial.print(static_cast<float>(RF_FREQUENCY_MHZ_X100) / 100.0f, 2);
  Serial.print(",\"receiverBandwidthKHz\":");
  Serial.print(static_cast<float>(CC1101_RECEIVER_BANDWIDTH_KHZ_X10) / 10.0f, 1);
  Serial.print(",\"dataRateKbpsApprox\":4.8");
  Serial.print(",\"modulation\":\"ASK/OOK\",\"gdo0SignalMode\":\"async_serial_data\"");
  Serial.print(",\"iocfg0\":");
  Serial.print(receiverRegisterReadbackValid[2] ? receiverRegisterReadback[2] : 255);
  Serial.print(",\"pktctrl0\":");
  Serial.print(receiverRegisterReadbackValid[4] ? receiverRegisterReadback[4] : 255);
  Serial.print(",\"mdmcfg4\":");
  Serial.print(receiverRegisterReadbackValid[10] ? receiverRegisterReadback[10] : 255);
  Serial.print(",\"mdmcfg2\":");
  Serial.print(receiverRegisterReadbackValid[12] ? receiverRegisterReadback[12] : 255);
  Serial.print(",\"freqWord\":\"");
  Serial.print(receiverRegisterReadbackValid[7] ? receiverRegisterReadback[7] : 255, HEX);
  Serial.print(receiverRegisterReadbackValid[8] ? receiverRegisterReadback[8] : 255, HEX);
  Serial.print(receiverRegisterReadbackValid[9] ? receiverRegisterReadback[9] : 255, HEX);
  Serial.print("\",\"registers\":[");
  for (size_t index = 0; index < RECEIVER_REGISTER_COUNT; index++) {
    if (index > 0) Serial.print(',');
    Serial.print("{\"address\":");
    Serial.print(receiverRegisters[index][0]);
    Serial.print(",\"expected\":");
    Serial.print(receiverRegisters[index][1]);
    Serial.print(",\"readbackValid\":");
    Serial.print(receiverRegisterReadbackValid[index] ? "true" : "false");
    Serial.print(",\"readback\":");
    Serial.print(receiverRegisterReadbackValid[index] ? receiverRegisterReadback[index] : 255);
    Serial.print(",\"match\":");
    Serial.print(receiverRegisterReadbackValid[index] &&
        receiverRegisterReadback[index] == receiverRegisters[index][1] ? "true" : "false");
    Serial.print('}');
  }
  Serial.print("]");
  Serial.print(",\"marcstate\":");
  Serial.print(statusRead ? marcstate : 255);
  Serial.print(",\"receiverState\":\"");
  Serial.print(statusRead ? cc1101StateName(marcstate) : "SPI_ERROR");
  Serial.print("\",\"rssiRaw\":");
  Serial.print(statusRead ? rssiRaw : 255);
  Serial.print(",\"asyncOokConfigured\":");
  Serial.print(asyncOokConfigured ? "true" : "false");
  Serial.print(",\"gdo0Level\":");
  Serial.print(digitalRead(PIN_CC1101_GDO0));
  Serial.println("}");
}

void writeReceiverDiagnostics(const char *reason) {
  uint8_t marcstate = 0xFF;
  uint8_t rssiRaw = 0xFF;
  bool statusRead = cc1101SpiReady && readReceiverRuntimeState(marcstate, rssiRaw);
  bool rxRecoveryAttempted = false;
  if (statusRead && (marcstate & 0x1F) != CC1101_MARCSTATE_RX) {
    rxRecoveryAttempted = true;
    if (cc1101Strobe(CC1101_SRX)) {
      delay(2);
      statusRead = readReceiverRuntimeState(marcstate, rssiRaw);
    }
  }

  const uint32_t edgeCount = isrEdgeCount;
  const uint32_t edgeCountDelta = edgeCount - lastDiagnosticsEdgeCount;
  lastDiagnosticsEdgeCount = edgeCount;
  const uint32_t lastEdgeUs = lastGdo0EdgeUs;
  const bool hasEdge = edgeCount > 0;
  const uint32_t windowSampleCount = rssiWindowSampleCount;
  const int16_t windowMinSignedRaw = rssiWindowMinSignedRaw;
  const int16_t windowMaxSignedRaw = rssiWindowMaxSignedRaw;
  const int16_t windowAverageSignedRaw = windowSampleCount > 0
      ? static_cast<int16_t>(rssiWindowSumSignedRaw / static_cast<int32_t>(windowSampleCount))
      : 0;
  const bool hadPreviousRssiSample = previousRssiSampleAvailable;
  const uint8_t priorRssiRaw = previousRssiRaw;
  const bool hadPreviousRssiWindow = previousRssiWindowAverageAvailable;
  const int16_t priorRssiWindowAverageSignedRaw = previousRssiWindowAverageSignedRaw;
  if (statusRead) {
    previousRssiRaw = rssiRaw;
    previousRssiSampleAvailable = true;
  }
  if (windowSampleCount > 0) {
    previousRssiWindowAverageSignedRaw = windowAverageSignedRaw;
    previousRssiWindowAverageAvailable = true;
  }
  const bool asyncOokConfigured = currentAsyncOokState(marcstate, statusRead);
  Serial.print("{\"version\":1,\"type\":\"rf.diagnostics\",\"eventType\":\"diagnostics\",\"reason\":\"");
  Serial.print(reason);
  Serial.print("\",\"target\":\"");
  if (learningLabel != '\0') Serial.print(learningLabel);
  Serial.print("\",\"asyncOokConfigured\":");
  Serial.print(asyncOokConfigured ? "true" : "false");
  Serial.print(",\"rxRecoveryAttempted\":");
  Serial.print(rxRecoveryAttempted ? "true" : "false");
  Serial.print(",\"marcstate\":");
  Serial.print(statusRead ? marcstate : 255);
  Serial.print(",\"receiverState\":\"");
  Serial.print(statusRead ? cc1101StateName(marcstate) : "SPI_ERROR");
  Serial.print("\",\"rssiRaw\":");
  Serial.print(statusRead ? rssiRaw : 255);
  Serial.print(",\"rssiSignedRaw\":");
  if (statusRead) Serial.print(static_cast<int16_t>(static_cast<int8_t>(rssiRaw)));
  else Serial.print("null");
  Serial.print(",\"rssiPreviousRaw\":");
  if (statusRead && hadPreviousRssiSample) {
    Serial.print(priorRssiRaw);
  } else {
    Serial.print("null");
  }
  Serial.print(",\"rssiDeltaSignedRaw\":");
  if (statusRead && hadPreviousRssiSample) {
    Serial.print(static_cast<int16_t>(static_cast<int8_t>(rssiRaw)) -
        static_cast<int16_t>(static_cast<int8_t>(priorRssiRaw)));
  } else {
    Serial.print("null");
  }
  Serial.print(",\"rssiWindowSamples\":");
  Serial.print(windowSampleCount);
  Serial.print(",\"rssiWindowMinSignedRaw\":");
  if (windowSampleCount > 0) Serial.print(windowMinSignedRaw);
  else Serial.print("null");
  Serial.print(",\"rssiWindowMaxSignedRaw\":");
  if (windowSampleCount > 0) Serial.print(windowMaxSignedRaw);
  else Serial.print("null");
  Serial.print(",\"rssiWindowAvgSignedRaw\":");
  if (windowSampleCount > 0) Serial.print(windowAverageSignedRaw);
  else Serial.print("null");
  Serial.print(",\"rssiWindowDeltaSignedRaw\":");
  if (windowSampleCount > 0 && hadPreviousRssiWindow) {
    Serial.print(windowAverageSignedRaw - priorRssiWindowAverageSignedRaw);
  } else {
    Serial.print("null");
  }
  Serial.print(",\"gdo0Level\":");
  Serial.print(digitalRead(PIN_CC1101_GDO0));
  Serial.print(",\"gdo0EdgeCount\":");
  Serial.print(edgeCount);
  Serial.print(",\"gdo0EdgeDelta\":");
  Serial.print(edgeCountDelta);
  Serial.print(",\"lastEdgeAgeMs\":");
  if (hasEdge) {
    Serial.print((micros() - lastEdgeUs) / 1000);
  } else {
    Serial.print("null");
  }
  Serial.print(",\"rawFramesQueued\":");
  Serial.print(rawFramesQueued);
  Serial.print(",\"processedFrames\":");
  Serial.print(processedFrameCount);
  Serial.println("}");
  rssiWindowMinSignedRaw = INT8_MAX;
  rssiWindowMaxSignedRaw = INT8_MIN;
  rssiWindowSumSignedRaw = 0;
  rssiWindowSampleCount = 0;
}

void IRAM_ATTR onGdo0Edge() {
  const uint32_t nowUs = micros();
  const uint32_t durationUs = nowUs - previousEdgeUs;
  previousEdgeUs = nowUs;
  lastGdo0EdgeUs = nowUs;
  isrEdgeCount++;
  const uint8_t currentLevel = gpio_get_level(static_cast<gpio_num_t>(PIN_CC1101_GDO0));

  if (durationUs >= FRAME_GAP_US) {
    if (capturingFrame) {
      if (currentPulseCount > 0) {
        if (currentPulseCount < MIN_PULSES) {
          filteredShortFrames++;
          learningShortRejectsPending++;
          if (currentFrameRejectionCode == FRAME_REJECTION_NONE) {
            currentFrameRejectionCode = FRAME_REJECTION_TOO_SHORT;
          }
        } else if (currentFrameDurationUs < MIN_FRAME_ACTIVE_US) {
          filteredLowActivityFrames++;
          if (currentFrameRejectionCode == FRAME_REJECTION_NONE) {
            currentFrameRejectionCode = FRAME_REJECTION_LOW_ACTIVITY;
          }
        }
        portENTER_CRITICAL_ISR(&frameQueueMux);
        const bool queueAvailable = queuedFrameCount < FRAME_QUEUE_SIZE;
        const uint8_t writeIndex = queueWriteIndex;
        portEXIT_CRITICAL_ISR(&frameQueueMux);
        if (queueAvailable) {
          const uint16_t framePulseCount = currentStoredPulseCount;
          frameQueue[writeIndex].count = currentPulseCount;
          frameQueue[writeIndex].storedCount = framePulseCount;
          frameQueue[writeIndex].totalDurationUs = currentFrameDurationUs;
          frameQueue[writeIndex].minPulseUs = currentMinPulseUs;
          frameQueue[writeIndex].maxPulseUs = currentMaxPulseUs;
          frameQueue[writeIndex].firstLevel = currentFirstLevel;
          frameQueue[writeIndex].valid = currentFrameRejectionCode == FRAME_REJECTION_NONE &&
              currentPulseCount >= MIN_PULSES &&
              currentPulseCount <= MAX_PULSES &&
              currentFrameDurationUs >= MIN_FRAME_ACTIVE_US;
          frameQueue[writeIndex].rejectionCode = currentFrameRejectionCode;
          for (uint16_t index = 0; index < framePulseCount; index++) {
            frameQueue[writeIndex].pulseUs[index] = currentPulseUs[index];
          }
          portENTER_CRITICAL_ISR(&frameQueueMux);
          queueWriteIndex = (writeIndex + 1) % FRAME_QUEUE_SIZE;
          queuedFrameCount++;
          rawFramesQueued++;
          portEXIT_CRITICAL_ISR(&frameQueueMux);
        } else {
          filteredQueueFullFrames++;
        }
      }
    }

    currentPulseCount = 0;
    currentStoredPulseCount = 0;
    currentFrameDurationUs = 0;
    currentMinPulseUs = UINT16_MAX;
    currentMaxPulseUs = 0;
    currentFrameRejectionCode = FRAME_REJECTION_NONE;
    currentFirstLevel = currentLevel;
    frameBoundarySeen = true;
    capturingFrame = false;
    return;
  }

  if (!frameBoundarySeen) return;
  if (!capturingFrame) capturingFrame = true;

  if (currentPulseCount < UINT16_MAX) currentPulseCount++;
  if (durationUs < currentMinPulseUs) currentMinPulseUs = static_cast<uint16_t>(durationUs);
  if (durationUs > currentMaxPulseUs) currentMaxPulseUs = static_cast<uint16_t>(durationUs);
  if (currentStoredPulseCount < MAX_PULSES) {
    currentPulseUs[currentStoredPulseCount++] = static_cast<uint16_t>(durationUs);
  } else if (currentFrameRejectionCode == FRAME_REJECTION_NONE) {
    currentFrameRejectionCode = FRAME_REJECTION_TOO_MANY_PULSES;
    filteredOversizedFrames++;
    learningInvalidRejectsPending++;
  }
  currentFrameDurationUs += durationUs;

  if (durationUs < MIN_PULSE_US || durationUs > MAX_PULSE_US) {
    filteredInvalidPulses++;
    learningInvalidRejectsPending++;
    if (currentFrameRejectionCode == FRAME_REJECTION_NONE) {
      currentFrameRejectionCode = FRAME_REJECTION_INVALID_PULSE;
    }
  }
}

bool takeNextFrame(CapturedFrame &destination) {
  portENTER_CRITICAL(&frameQueueMux);
  if (queuedFrameCount == 0) {
    portEXIT_CRITICAL(&frameQueueMux);
    return false;
  }

  const uint8_t readIndex = queueReadIndex;
  destination.count = frameQueue[readIndex].count;
  destination.storedCount = frameQueue[readIndex].storedCount;
  if (destination.storedCount > MAX_PULSES ||
      destination.count == 0 ||
      destination.storedCount > destination.count) {
    invalidQueuedFrameCount++;
    queueReadIndex = (readIndex + 1) % FRAME_QUEUE_SIZE;
    queuedFrameCount--;
    portEXIT_CRITICAL(&frameQueueMux);
    return false;
  }
  destination.firstLevel = frameQueue[readIndex].firstLevel;
  destination.totalDurationUs = frameQueue[readIndex].totalDurationUs;
  destination.minPulseUs = frameQueue[readIndex].minPulseUs;
  destination.maxPulseUs = frameQueue[readIndex].maxPulseUs;
  destination.valid = frameQueue[readIndex].valid;
  destination.rejectionCode = frameQueue[readIndex].rejectionCode;
  for (uint16_t index = 0; index < destination.storedCount; index++) {
    destination.pulseUs[index] = frameQueue[readIndex].pulseUs[index];
  }
  queueReadIndex = (readIndex + 1) % FRAME_QUEUE_SIZE;
  queuedFrameCount--;
  portEXIT_CRITICAL(&frameQueueMux);
  processedFrameCount++;
  return true;
}

uint8_t comparePulses(
    const uint16_t *reference,
    const uint16_t *candidate,
    uint16_t count,
    uint8_t referenceLevel,
    uint8_t candidateLevel) {
  if (referenceLevel != candidateLevel) return 0;
  uint32_t qualityTotal = 0;
  for (uint16_t index = 0; index < count; index++) {
    const uint16_t left = reference[index];
    const uint16_t right = candidate[index];
    const uint16_t difference = left > right ? left - right : right - left;
    const uint16_t relativeTolerance = left / 3;
    const uint16_t tolerance = relativeTolerance > MATCH_TOLERANCE_US
        ? relativeTolerance
        : MATCH_TOLERANCE_US;
    if (difference > tolerance) return 0;
    const uint32_t pulseDeviationPct = (static_cast<uint32_t>(difference) * 100) / (left == 0 ? 1 : left);
    const uint8_t pulseQuality = static_cast<uint8_t>(pulseDeviationPct >= 100 ? 0 : 100 - pulseDeviationPct);
    qualityTotal += pulseQuality;
  }
  return static_cast<uint8_t>(qualityTotal / count);
}

int8_t labelIndex(const char label) {
  if (label == 'A') return 0;
  if (label == 'B') return 1;
  if (label == 'C') return 2;
  return -1;
}

bool validSample(const LearnedSample &sample) {
  if (sample.count < MIN_PULSES ||
      sample.count > MAX_PULSES ||
      (sample.firstLevel != LOW && sample.firstLevel != HIGH)) return false;
  for (uint16_t index = 0; index < sample.count; index++) {
    if (sample.pulseUs[index] < MIN_PULSE_US || sample.pulseUs[index] > MAX_PULSE_US) return false;
  }
  return true;
}

void loadLearnedSamples() {
  const char labels[] = {'A', 'B', 'C'};
  for (uint8_t index = 0; index < 3; index++) {
    char key[2] = {labels[index], '\0'};
    if (preferences.getBytesLength(key) != sizeof(LearnedSample)) continue;
    LearnedSample sample = {};
    if (preferences.getBytes(key, &sample, sizeof(sample)) != sizeof(sample) || !validSample(sample)) continue;
    learnedSamples[index] = sample;
    learnedSampleValid[index] = true;
  }
}

bool saveLearnedSample(const char label, const SignalCluster &cluster) {
  const int8_t index = labelIndex(label);
  if (index < 0 || cluster.count < MIN_PULSES || cluster.count > MAX_PULSES) return false;
  LearnedSample sample = {};
  sample.count = cluster.count;
  sample.firstLevel = cluster.firstLevel;
  for (uint16_t pulse = 0; pulse < cluster.count; pulse++) sample.pulseUs[pulse] = cluster.pulseUs[pulse];
  if (!validSample(sample)) return false;
  char key[2] = {label, '\0'};
  if (preferences.putBytes(key, &sample, sizeof(sample)) != sizeof(sample)) return false;
  learnedSamples[index] = sample;
  learnedSampleValid[index] = true;
  return true;
}

char findLearnedLabel(const SignalCluster &cluster, uint8_t &quality) {
  const char labels[] = {'A', 'B', 'C'};
  char matched = '\0';
  uint8_t secondBestQuality = 0;
  quality = 0;
  for (uint8_t index = 0; index < 3; index++) {
    if (!learnedSampleValid[index] || learnedSamples[index].count != cluster.count) continue;
    const uint8_t candidateQuality = comparePulses(
        learnedSamples[index].pulseUs,
        cluster.pulseUs,
        cluster.count,
        learnedSamples[index].firstLevel,
        cluster.firstLevel);
    if (candidateQuality > quality) {
      secondBestQuality = quality;
      quality = candidateQuality;
      matched = labels[index];
    } else if (candidateQuality > secondBestQuality) {
      secondBestQuality = candidateQuality;
    }
  }
  return quality >= MATCH_QUALITY_MIN && quality - secondBestQuality >= MATCH_QUALITY_MARGIN
      ? matched
      : '\0';
}

SignalCluster *findCluster(const CapturedFrame &frame, const uint32_t nowMs, uint8_t &quality) {
  SignalCluster *best = nullptr;
  quality = 0;
  for (uint8_t index = 0; index < CLUSTER_COUNT; index++) {
    SignalCluster &cluster = signalClusters[index];
    if (!cluster.active ||
        nowMs - cluster.lastSeenMs > CLUSTER_TTL_MS ||
        cluster.count != frame.count) continue;
    const uint8_t candidateQuality = comparePulses(
        cluster.pulseUs,
        frame.pulseUs,
        frame.count,
        cluster.firstLevel,
        frame.firstLevel);
    if (candidateQuality > quality) {
      quality = candidateQuality;
      best = &cluster;
    }
  }
  return quality >= MATCH_QUALITY_MIN ? best : nullptr;
}

SignalCluster &newCluster(const CapturedFrame &frame, const uint32_t nowMs) {
  SignalCluster *target = nullptr;
  for (uint8_t index = 0; index < CLUSTER_COUNT; index++) {
    if (!signalClusters[index].active ||
        nowMs - signalClusters[index].lastSeenMs > CLUSTER_TTL_MS) {
      target = &signalClusters[index];
      break;
    }
  }
  if (target == nullptr) {
    target = &signalClusters[0];
    for (uint8_t index = 1; index < CLUSTER_COUNT; index++) {
      if (signalClusters[index].lastSeenMs < target->lastSeenMs) target = &signalClusters[index];
    }
  }
  *target = {};
  target->active = true;
  target->count = frame.count;
  target->firstLevel = frame.firstLevel;
  target->repeatCount = 1;
  target->qualityPct = 100;
  target->lastSeenMs = nowMs;
  target->clusterId = nextClusterId++;
  for (uint16_t index = 0; index < frame.count; index++) target->pulseUs[index] = frame.pulseUs[index];
  return *target;
}

void writeClusterJson(const SignalCluster &cluster, const char matchedLabel, const uint8_t matchQuality, const char learned) {
  Serial.print("{\"version\":1,\"type\":\"rf.capture\",\"eventType\":\"raw_capture\",");
  Serial.print("\"deviceId\":\"\",\"buttonCode\":\"\",\"protocol\":\"unknown\",");
  Serial.print("\"captureId\":");
  Serial.print(++captureId);
  Serial.print(",\"clusterId\":");
  Serial.print(cluster.clusterId);
  Serial.print(",\"stable\":true,\"repeatCount\":");
  Serial.print(cluster.repeatCount);
  Serial.print(",\"signalQualityPct\":");
  Serial.print(cluster.qualityPct);
  Serial.print(",\"frequencyMHz\":");
  Serial.print(static_cast<float>(RF_FREQUENCY_MHZ_X100) / 100.0f, 2);
  Serial.print(",\"receiverBandwidthKHz\":");
  Serial.print(static_cast<float>(CC1101_RECEIVER_BANDWIDTH_KHZ_X10) / 10.0f, 1);
  Serial.print(",\"firstLevel\":\"");
  Serial.print(cluster.firstLevel == HIGH ? "high" : "low");
  Serial.print("\",\"learnMode\":");
  Serial.print(learningLabel != '\0' || learned != '\0' ? "true" : "false");
  Serial.print(",\"learnedLabel\":\"");
  if (learned != '\0') Serial.print(learned);
  Serial.print("\",\"matchedLabel\":\"");
  if (matchedLabel != '\0') Serial.print(matchedLabel);
  Serial.print("\",\"matchQualityPct\":");
  Serial.print(matchQuality);
  Serial.print(",\"pulseUs\":[");
  for (uint16_t index = 0; index < cluster.count; index++) {
    if (index > 0) Serial.print(',');
    Serial.print(cluster.pulseUs[index]);
  }
  Serial.println("]}");
}

void writeButtonMatchJson(const SignalCluster &cluster, const char label, const uint8_t matchQuality) {
  const char *action = label == 'A' ? "waiter_call" : (label == 'B' ? "service_request" : "cancel");
  const char *actionName = label == 'A' ? "Garson çağır" : (label == 'B' ? "Servis" : "İptal");
  Serial.print("{\"version\":1,\"type\":\"rf.match\",\"eventType\":\"button_match\",\"matchedLabel\":\"");
  Serial.print(label);
  Serial.print("\",\"action\":\"");
  Serial.print(action);
  Serial.print("\",\"actionName\":\"");
  Serial.print(actionName);
  Serial.print("\",\"protocol\":\"unknown\",\"deviceId\":\"\",\"buttonCode\":\"\",\"frequencyMHz\":");
  Serial.print(static_cast<float>(RF_FREQUENCY_MHZ_X100) / 100.0f, 2);
  Serial.print(",\"repeatCount\":");
  Serial.print(cluster.repeatCount);
  Serial.print(",\"matchQualityPct\":");
  Serial.print(matchQuality);
  Serial.println("}");
}

void writeLearningStatus(const char *message, const char *command = "", const bool ok = true) {
  Serial.print("{\"version\":1,\"type\":\"rf.learning\",\"message\":\"");
  Serial.print(message);
  Serial.print("\",\"command\":\"");
  Serial.print(command);
  Serial.print("\",\"ok\":");
  Serial.print(ok ? "true" : "false");
  Serial.print(",\"uptimeMs\":");
  Serial.print(millis());
  Serial.print(",\"target\":\"");
  if (learningLabel != '\0') Serial.print(learningLabel);
  Serial.print("\",\"stored\":{\"A\":");
  Serial.print(learnedSampleValid[0] ? "true" : "false");
  Serial.print(",\"B\":");
  Serial.print(learnedSampleValid[1] ? "true" : "false");
  Serial.print(",\"C\":");
  Serial.print(learnedSampleValid[2] ? "true" : "false");
  Serial.println("}}");
}

void writeCompletedLearningCapture(const char label, const SignalCluster &cluster) {
  uint32_t totalDurationUs = 0;
  uint16_t minimumPulseUs = UINT16_MAX;
  uint16_t maximumPulseUs = 0;
  for (uint16_t index = 0; index < cluster.count; index++) {
    const uint16_t pulseUs = cluster.pulseUs[index];
    totalDurationUs += pulseUs;
    if (pulseUs < minimumPulseUs) minimumPulseUs = pulseUs;
    if (pulseUs > maximumPulseUs) maximumPulseUs = pulseUs;
  }

  Serial.print("{\"version\":1,\"type\":\"rf.capture\",\"eventType\":\"raw_capture\",");
  Serial.print("\"deviceId\":\"\",\"buttonCode\":\"\",\"protocol\":\"unknown\",");
  Serial.print("\"captureId\":");
  Serial.print(++captureId);
  Serial.print(",\"clusterId\":");
  Serial.print(cluster.clusterId);
  Serial.print(",\"phase\":\"completed\",");
  Serial.print("\"target\":\"");
  Serial.print(label);
  Serial.print("\",\"accepted\":true,\"reason\":\"none\",\"learnMode\":true,\"learnedLabel\":\"");
  Serial.print(label);
  Serial.print("\",\"stored\":{\"A\":");
  Serial.print(learnedSampleValid[0] ? "true" : "false");
  Serial.print(",\"B\":");
  Serial.print(learnedSampleValid[1] ? "true" : "false");
  Serial.print(",\"C\":");
  Serial.print(learnedSampleValid[2] ? "true" : "false");
  Serial.print("},\"frequencyMHz\":");
  Serial.print(static_cast<float>(RF_FREQUENCY_MHZ_X100) / 100.0f, 2);
  Serial.print(",\"receiverBandwidthKHz\":");
  Serial.print(static_cast<float>(CC1101_RECEIVER_BANDWIDTH_KHZ_X10) / 10.0f, 1);
  Serial.print(",\"repeatCount\":");
  Serial.print(cluster.repeatCount);
  Serial.print(",\"signalQualityPct\":");
  Serial.print(cluster.qualityPct);
  Serial.print(",\"firstLevel\":\"");
  Serial.print(cluster.firstLevel == HIGH ? "high" : "low");
  Serial.print("\",\"stable\":true,\"pulseCount\":");
  Serial.print(cluster.count);
  Serial.print(",\"totalDurationUs\":");
  Serial.print(totalDurationUs);
  Serial.print(",\"minPulseUs\":");
  Serial.print(cluster.count > 0 ? minimumPulseUs : 0);
  Serial.print(",\"maxPulseUs\":");
  Serial.print(maximumPulseUs);
  Serial.print(",\"pulseUs\":[");
  for (uint16_t index = 0; index < cluster.count; index++) {
    if (index > 0) Serial.print(',');
    Serial.print(cluster.pulseUs[index]);
  }
  Serial.println("]}");
}

void clearLearningRejectCounts() {
  portENTER_CRITICAL(&frameQueueMux);
  learningShortRejectsPending = 0;
  learningInvalidRejectsPending = 0;
  portEXIT_CRITICAL(&frameQueueMux);
}

const char *resetReasonName(const esp_reset_reason_t reason) {
  switch (reason) {
    case ESP_RST_POWERON: return "power_on";
    case ESP_RST_EXT: return "external";
    case ESP_RST_SW: return "software";
    case ESP_RST_PANIC: return "panic";
    case ESP_RST_INT_WDT: return "interrupt_watchdog";
    case ESP_RST_TASK_WDT: return "task_watchdog";
    case ESP_RST_WDT: return "watchdog";
    case ESP_RST_DEEPSLEEP: return "deep_sleep";
    case ESP_RST_BROWNOUT: return "brownout";
    case ESP_RST_SDIO: return "sdio";
    default: return "unknown";
  }
}

void writeResetReason() {
  const esp_reset_reason_t reason = esp_reset_reason();
  retainedBootCount++;
  Serial.print("{\"version\":1,\"type\":\"rf.reset\",\"resetReason\":\"");
  Serial.print(resetReasonName(reason));
  Serial.print("\",\"resetReasonCode\":");
  Serial.print(static_cast<int>(reason));
  Serial.print(",\"retainedBootCount\":");
  Serial.print(retainedBootCount);
  Serial.println("}");
}

void resetClusters() {
  for (uint8_t index = 0; index < CLUSTER_COUNT; index++) signalClusters[index] = {};
}

void discardQueuedFrames() {
  portENTER_CRITICAL(&frameQueueMux);
  queueReadIndex = queueWriteIndex;
  queuedFrameCount = 0;
  portEXIT_CRITICAL(&frameQueueMux);
}

void handleSerialCommand(char *command) {
  for (char *character = command; *character; character++) {
    if (*character >= 'a' && *character <= 'z') *character -= ('a' - 'A');
  }
  if (strcmp(command, "LEARN A") == 0 || strcmp(command, "LEARN B") == 0 || strcmp(command, "LEARN C") == 0) {
    if (preferences.putUChar("learn", static_cast<uint8_t>(command[6])) != 1) {
      writeLearningStatus("Could not persist the learning target; previous state was kept.", command, false);
      return;
    }
    learningLabel = command[6];
    captureSessionActive = true;
    learningCluster = {};
    clearLearningRejectCounts();
    discardQueuedFrames();
    resetClusters();
    writeLearningStatus("Learning command accepted; press only the selected button repeatedly.", command);
    lastDiagnosticsEdgeCount = isrEdgeCount;
    nextReceiverDiagnosticsMs = millis() + RECEIVER_DIAGNOSTICS_INTERVAL_MS;
    nextRssiSampleMs = millis();
    previousRssiSampleAvailable = false;
    previousRssiWindowAverageAvailable = false;
    rssiWindowMinSignedRaw = INT8_MAX;
    rssiWindowMaxSignedRaw = INT8_MIN;
    rssiWindowSumSignedRaw = 0;
    rssiWindowSampleCount = 0;
    writeReceiverDiagnostics("learn_started");
    return;
  }
  if (strcmp(command, "STOP") == 0 || strcmp(command, "LEARN OFF") == 0) {
    if (learningLabel != '\0' && !preferences.remove("learn")) {
      writeLearningStatus("Could not clear the persisted learning target.", command, false);
      return;
    }
    learningLabel = '\0';
    captureSessionActive = false;
    learningCluster = {};
    clearLearningRejectCounts();
    discardQueuedFrames();
    resetClusters();
    writeLearningStatus("RF capture stopped; existing learned samples were preserved.", command);
    return;
  }
  if (strcmp(command, "LEARN STATUS") == 0) {
    writeLearningStatus("Stored samples are raw waveform templates; decoded protocol and device ID remain unknown.", command);
    return;
  }
  if (strncmp(command, "LEARN CLEAR ", 12) == 0 && strlen(command) == 13) {
    const char label = command[12];
    const int8_t index = labelIndex(label);
    if (index >= 0) {
      char clearCommand[] = "LEARN CLEAR X";
      clearCommand[12] = label;
      if (!learnedSampleValid[index]) {
        writeLearningStatus("No valid raw waveform sample is stored for that label.", clearCommand, false);
        return;
      }
      char key[2] = {label, '\0'};
      if (!preferences.remove(key)) {
        writeLearningStatus("Failed to remove the stored raw waveform sample.", clearCommand, false);
        return;
      }
      learnedSampleValid[index] = false;
      writeLearningStatus("Stored raw waveform sample cleared.", clearCommand);
      return;
    }
  }
  writeLearningStatus("Unknown command. Use LEARN A|B|C, STOP, LEARN OFF, LEARN STATUS, or LEARN CLEAR A|B|C.", "", false);
}

void finishSerialCommand() {
  if (serialCommandOverflow) {
    writeLearningStatus("Command is too long and was discarded.", "", false);
  } else if (serialCommandLength > 0) {
    while (serialCommandLength > 0 &&
           (serialCommand[serialCommandLength - 1] == ' ' || serialCommand[serialCommandLength - 1] == '\t')) {
      serialCommandLength--;
    }
    uint8_t firstCharacter = 0;
    while (firstCharacter < serialCommandLength &&
           (serialCommand[firstCharacter] == ' ' || serialCommand[firstCharacter] == '\t')) {
      firstCharacter++;
    }
    if (firstCharacter < serialCommandLength) {
      const uint8_t commandLength = serialCommandLength - firstCharacter;
      memmove(serialCommand, serialCommand + firstCharacter, commandLength);
      serialCommand[commandLength] = '\0';
      handleSerialCommand(serialCommand);
    }
  }
  serialCommandLength = 0;
  serialCommandOverflow = false;
}

void readSerialCommands() {
  while (Serial.available() > 0) {
    const char character = static_cast<char>(Serial.read());
    if (character == '\r' || character == '\n') {
      finishSerialCommand();
      serialCommandLastByteMs = millis();
      continue;
    }
    if (serialCommandOverflow) continue;
    if (serialCommandLength + 1 >= sizeof(serialCommand)) {
      serialCommandOverflow = true;
      continue;
    }
    serialCommand[serialCommandLength++] = character;
    serialCommandLastByteMs = millis();
  }

  if ((serialCommandLength > 0 || serialCommandOverflow) &&
      millis() - serialCommandLastByteMs >= SERIAL_LINE_IDLE_TIMEOUT_MS) {
    finishSerialCommand();
  }
}

void processLearningFrame(const CapturedFrame &frame) {
  const char target = learningLabel;
  if (!frame.valid ||
      frame.count < MIN_PULSES ||
      frame.count > MAX_PULSES ||
      frame.storedCount != frame.count) return;

  for (uint16_t index = 0; index < frame.count; index++) {
    if (frame.pulseUs[index] < MIN_PULSE_US || frame.pulseUs[index] > MAX_PULSE_US) return;
  }

  const bool clusterExpired = learningCluster.active &&
      millis() - learningCluster.lastSeenMs > LEARNING_CLUSTER_TTL_MS;
  if (!learningCluster.active || clusterExpired) {
    learningCluster = {};
    learningCluster.active = true;
    learningCluster.count = frame.count;
    learningCluster.firstLevel = frame.firstLevel;
    learningCluster.repeatCount = 1;
    learningCluster.qualityPct = 100;
    learningCluster.lastSeenMs = millis();
    for (uint16_t index = 0; index < frame.count; index++) {
      learningCluster.pulseUs[index] = frame.pulseUs[index];
    }
    return;
  }

  if (learningCluster.count != frame.count || learningCluster.firstLevel != frame.firstLevel) {
    learningCluster = {};
    learningCluster.active = true;
    learningCluster.count = frame.count;
    learningCluster.firstLevel = frame.firstLevel;
    learningCluster.repeatCount = 1;
    learningCluster.qualityPct = 100;
    learningCluster.lastSeenMs = millis();
    for (uint16_t index = 0; index < frame.count; index++) {
      learningCluster.pulseUs[index] = frame.pulseUs[index];
    }
    return;
  }

  const uint8_t quality = comparePulses(
      learningCluster.pulseUs,
      frame.pulseUs,
      frame.count,
      learningCluster.firstLevel,
      frame.firstLevel);
  if (quality < MATCH_QUALITY_MIN) {
    learningCluster = {};
    learningCluster.active = true;
    learningCluster.count = frame.count;
    learningCluster.firstLevel = frame.firstLevel;
    learningCluster.repeatCount = 1;
    learningCluster.qualityPct = 100;
    learningCluster.lastSeenMs = millis();
    for (uint16_t index = 0; index < frame.count; index++) {
      learningCluster.pulseUs[index] = frame.pulseUs[index];
    }
    return;
  }

  if (learningCluster.repeatCount < 255) learningCluster.repeatCount++;
  learningCluster.qualityPct = quality;
  learningCluster.lastSeenMs = millis();
  for (uint16_t index = 0; index < frame.count; index++) {
    learningCluster.pulseUs[index] =
        (static_cast<uint32_t>(learningCluster.pulseUs[index]) * 3 + frame.pulseUs[index]) / 4;
  }

  if (learningCluster.repeatCount < REQUIRED_REPEAT_COUNT) {
    return;
  }

  if (!saveLearnedSample(target, learningCluster)) {
    char command[] = "LEARN X";
    command[6] = target;
    writeLearningStatus("NVS waveform write failed; capture remains active.", command, false);
    return;
  }

  if (!preferences.remove("learn")) {
    char command[] = "LEARN X";
    command[6] = target;
    writeLearningStatus("Waveform was stored but pending capture state could not be cleared.", command, false);
    return;
  }

  const SignalCluster completedCluster = learningCluster;
  learningLabel = '\0';
  captureSessionActive = false;
  learningCluster = {};
  discardQueuedFrames();
  resetClusters();
  writeCompletedLearningCapture(target, completedCluster);
}

void processFrame(const CapturedFrame &frame) {
  if (learningLabel != '\0' && captureSessionActive) {
    processLearningFrame(frame);
    return;
  }
  if (!frame.valid || frame.count < MIN_PULSES || frame.count > MAX_PULSES || frame.storedCount != frame.count) return;

  const uint32_t nowMs = millis();
  uint8_t clusterQuality = 0;
  SignalCluster *cluster = findCluster(frame, nowMs, clusterQuality);
  if (cluster == nullptr) {
    cluster = &newCluster(frame, nowMs);
  } else {
    if (cluster->repeatCount < 255) cluster->repeatCount++;
    cluster->qualityPct = clusterQuality;
    cluster->lastSeenMs = nowMs;
    for (uint16_t index = 0; index < frame.count; index++) {
      cluster->pulseUs[index] = (static_cast<uint32_t>(cluster->pulseUs[index]) * 3 + frame.pulseUs[index]) / 4;
    }
  }

  if (cluster->repeatCount < REQUIRED_REPEAT_COUNT) return;

  uint8_t matchQuality = 0;
  const char matchedLabel = findLearnedLabel(*cluster, matchQuality);
  if (matchedLabel != '\0' && matchQuality >= BUTTON_MATCH_MIN_QUALITY) {
    if (!cluster->matchReported) {
      cluster->matchReported = true;
      writeClusterJson(*cluster, matchedLabel, matchQuality, '\0');
      writeButtonMatchJson(*cluster, matchedLabel, matchQuality);
    }
    return;
  }

  if (cluster->lastReportedMs == 0) {
    cluster->lastReportedMs = nowMs == 0 ? 1 : nowMs;
    writeClusterJson(*cluster, '\0', matchQuality, '\0');
  }
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  writeResetReason();
  pinMode(PIN_CC1101_GDO0, INPUT);
  if (!configureCc1101()) {
    writeReceiverConfigStatus();
    Serial.println("{\"version\":1,\"type\":\"rf.error\",\"eventType\":\"error\",\"error\":\"CC1101 initialization failed; see rf.receiver.initFailureReason and register readbacks.\"}");
    while (true) delay(1000);
  }
  if (!preferences.begin("penpos-rf", false)) {
    Serial.println("{\"version\":1,\"type\":\"rf.error\",\"eventType\":\"error\",\"error\":\"Could not open NVS storage for learned raw waveforms.\"}");
    while (true) delay(1000);
  }
  loadLearnedSamples();
  const uint8_t persistedLearningLabel = preferences.getUChar("learn", 0);
  if (persistedLearningLabel == 'A' || persistedLearningLabel == 'B' || persistedLearningLabel == 'C') {
    learningLabel = static_cast<char>(persistedLearningLabel);
    captureSessionActive = true;
    writeLearningStatus("Restored pending learning target after reset; press only the selected button.", "RESTORE");
  } else {
    if (persistedLearningLabel != 0) preferences.remove("learn");
    writeLearningStatus("Ready. Use LEARN A, LEARN B, or LEARN C in Serial Monitor to learn measured raw waveforms.");
  }
  previousEdgeUs = micros();
  lastGdo0EdgeUs = previousEdgeUs;
  const int gdo0Interrupt = digitalPinToInterrupt(PIN_CC1101_GDO0);
  if (gdo0Interrupt < 0) {
    Serial.println("{\"version\":1,\"type\":\"rf.error\",\"eventType\":\"error\",\"error\":\"GPIO4 does not provide an attachable interrupt on this board configuration.\"}");
    while (true) delay(1000);
  }
  attachInterrupt(gdo0Interrupt, onGdo0Edge, CHANGE);
  gdo0InterruptAttached = true;
  writeReceiverConfigStatus();
  if (captureSessionActive) {
    lastDiagnosticsEdgeCount = isrEdgeCount;
    nextReceiverDiagnosticsMs = millis() + RECEIVER_DIAGNOSTICS_INTERVAL_MS;
    nextRssiSampleMs = millis();
    previousRssiSampleAvailable = false;
    previousRssiWindowAverageAvailable = false;
    rssiWindowMinSignedRaw = INT8_MAX;
    rssiWindowMaxSignedRaw = INT8_MIN;
    rssiWindowSumSignedRaw = 0;
    rssiWindowSampleCount = 0;
    writeReceiverDiagnostics("learn_restored");
  }
}

void loop() {
  readSerialCommands();
  sampleReceiverRssi();
  const uint32_t nowMs = millis();
  if (captureSessionActive &&
      static_cast<int32_t>(nowMs - nextReceiverDiagnosticsMs) >= 0) {
    nextReceiverDiagnosticsMs = nowMs + RECEIVER_DIAGNOSTICS_INTERVAL_MS;
    writeReceiverDiagnostics("learning");
  }
  CapturedFrame frame;
  if (takeNextFrame(frame)) {
    processFrame(frame);
  }
  delay(1);
}
