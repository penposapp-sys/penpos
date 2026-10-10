package com.penpos.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class BackPressTrackerTest {

    @Test
    public void secondPressWithinTwoSecondsRequestsExitConfirmation() {
        BackPressTracker tracker = new BackPressTracker();

        assertFalse(tracker.shouldShowExitConfirmation(1000));
        assertTrue(tracker.shouldShowExitConfirmation(3000));
    }

    @Test
    public void secondPressAfterTwoSecondsStartsANewSequence() {
        BackPressTracker tracker = new BackPressTracker();

        assertFalse(tracker.shouldShowExitConfirmation(1000));
        assertFalse(tracker.shouldShowExitConfirmation(3001));
        assertTrue(tracker.shouldShowExitConfirmation(4000));
    }

    @Test
    public void thirdPressAfterConfirmationStartsANewSequence() {
        BackPressTracker tracker = new BackPressTracker();

        assertFalse(tracker.shouldShowExitConfirmation(1000));
        assertTrue(tracker.shouldShowExitConfirmation(2000));
        assertFalse(tracker.shouldShowExitConfirmation(2100));
    }
}
