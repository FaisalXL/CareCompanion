// CareCompanion — Arduino sketch
//
// Reads the Modulino Movement accelerometer at ~62.5 Hz and forwards
// (x, y, z) g-values to the Python side via Bridge.notify().
// Also provides a "set_led_state" callback so Python can drive the
// LED matrix for visual status indicators.

#include <Arduino_Modulino.h>
#include <Arduino_LED_Matrix.h>
#include <Arduino_RouterBridge.h>

ModulinoMovement  movement;
Arduino_LED_Matrix matrix;

float x_accel, y_accel, z_accel;

unsigned long previousMillis = 0;
const long    interval       = 16;   // 16 ms → ~62.5 Hz
int           has_movement   = 0;

// ── LED status frames ────────────────────────────────────────────────────
const uint32_t IDLE_FRAME[] = {
  0x00000000, 0x00000000, 0x00000000
};

const uint32_t ALERT_FRAME[] = {
  0x00400000, 0x00E00000, 0x00400000
};

const uint32_t LISTENING_FRAME[] = {
  0x0CC30000, 0x1E780000, 0x0CC30000
};

// Python can request an LED state change
void set_led_state(int state) {
  switch (state) {
    case 0: matrix.loadFrame(IDLE_FRAME);      break;
    case 1: matrix.loadFrame(ALERT_FRAME);     break;
    case 2: matrix.loadFrame(LISTENING_FRAME); break;
    default: matrix.clear();                   break;
  }
}

void setup() {
  Bridge.begin();

  matrix.begin();
  matrix.loadFrame(IDLE_FRAME);

  Modulino.begin(Wire1);

  while (!movement.begin()) {
    delay(1000);
  }

  Bridge.provide("set_led_state", set_led_state);
}

void loop() {
  unsigned long currentMillis = millis();

  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

    has_movement = movement.update();
    if (has_movement == 1) {
      x_accel = movement.getX();
      y_accel = movement.getY();
      z_accel = movement.getZ();

      Bridge.notify("record_sensor_movement", x_accel, y_accel, z_accel);
    }
  }
}
