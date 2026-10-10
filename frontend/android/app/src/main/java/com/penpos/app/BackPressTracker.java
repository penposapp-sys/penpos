package com.penpos.app;

final class BackPressTracker {

    static final long DOUBLE_PRESS_INTERVAL_MS = 2000;

    private long lastBackPressAt = Long.MIN_VALUE;

    boolean shouldShowExitConfirmation(long currentTimeMillis) {
        boolean isSecondPress = lastBackPressAt != Long.MIN_VALUE
                && currentTimeMillis >= lastBackPressAt
                && currentTimeMillis - lastBackPressAt <= DOUBLE_PRESS_INTERVAL_MS;
        lastBackPressAt = isSecondPress ? Long.MIN_VALUE : currentTimeMillis;
        return isSecondPress;
    }
}
