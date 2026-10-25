import { Injectable } from '@nestjs/common';
import { AlertCondition, AlertState } from '@prisma/client';

export interface StateTransitionInput {
  conditionMet: boolean;
  currentState: AlertState; // NORMAL if no active instance
  pendingSince: Date | null;
  startedAt: Date | null;
  durationSeconds: number; // FOR duration in seconds
  now: Date;
}

export interface StateTransitionOutput {
  newState: AlertState;
  shouldCreateInstance: boolean;
  shouldFire: boolean;
  shouldResolve: boolean;
  newPendingSince: Date | null;
  newStartedAt: Date | null;
  resolvedAt: Date | null;
}

@Injectable()
export class AlertStateMachineService {
  /**
   * Evaluates if a metric value violates the specified threshold condition.
   * Returns false if metricValue is null (NO_DATA), distinguishing missing data from zero.
   */
  evaluateCondition(
    metricValue: number | null,
    condition: AlertCondition,
    threshold: number,
  ): boolean {
    if (metricValue === null || metricValue === undefined || isNaN(metricValue)) {
      return false; // NO_DATA does not trigger condition
    }

    switch (condition) {
      case AlertCondition.GREATER_THAN:
        return metricValue > threshold;
      case AlertCondition.GREATER_THAN_OR_EQUAL:
        return metricValue >= threshold;
      case AlertCondition.LESS_THAN:
        return metricValue < threshold;
      case AlertCondition.LESS_THAN_OR_EQUAL:
        return metricValue <= threshold;
      case AlertCondition.EQUAL:
        return Math.abs(metricValue - threshold) < 0.0001;
      case AlertCondition.NOT_EQUAL:
        return Math.abs(metricValue - threshold) >= 0.0001;
      default:
        return false;
    }
  }

  /**
   * Pure deterministic state transition evaluator.
   *
   * Transitions:
   * NORMAL + false   -> NORMAL
   * NORMAL + true    -> PENDING (or FIRING if duration == 0)
   * PENDING + true   -> PENDING (or FIRING if elapsed >= duration)
   * PENDING + false  -> RESOLVED (clears back to NORMAL)
   * FIRING + true    -> FIRING
   * FIRING + false   -> RESOLVED
   */
  computeTransition(input: StateTransitionInput): StateTransitionOutput {
    const { conditionMet, currentState, pendingSince, startedAt, durationSeconds, now } = input;

    // 1. Previous state was NORMAL (no active instance)
    if (currentState === AlertState.NORMAL || currentState === AlertState.RESOLVED) {
      if (!conditionMet) {
        return {
          newState: AlertState.NORMAL,
          shouldCreateInstance: false,
          shouldFire: false,
          shouldResolve: false,
          newPendingSince: null,
          newStartedAt: null,
          resolvedAt: null,
        };
      }

      // Condition met: check if FOR duration is 0 (immediate)
      if (durationSeconds <= 0) {
        return {
          newState: AlertState.FIRING,
          shouldCreateInstance: true,
          shouldFire: true,
          shouldResolve: false,
          newPendingSince: now,
          newStartedAt: now,
          resolvedAt: null,
        };
      }

      return {
        newState: AlertState.PENDING,
        shouldCreateInstance: true,
        shouldFire: false,
        shouldResolve: false,
        newPendingSince: now,
        newStartedAt: null,
        resolvedAt: null,
      };
    }

    // 2. Previous state was PENDING
    if (currentState === AlertState.PENDING) {
      if (!conditionMet) {
        // Condition cleared before duration was reached (spike avoided)
        return {
          newState: AlertState.RESOLVED,
          shouldCreateInstance: false,
          shouldFire: false,
          shouldResolve: true,
          newPendingSince: null,
          newStartedAt: null,
          resolvedAt: now,
        };
      }

      // Condition remains met: check if elapsed duration reached
      const effectivePendingSince = pendingSince || now;
      const elapsedSeconds = (now.getTime() - effectivePendingSince.getTime()) / 1000;

      if (elapsedSeconds >= durationSeconds) {
        return {
          newState: AlertState.FIRING,
          shouldCreateInstance: false,
          shouldFire: true,
          shouldResolve: false,
          newPendingSince: effectivePendingSince,
          newStartedAt: now,
          resolvedAt: null,
        };
      }

      // Still in pending grace period
      return {
        newState: AlertState.PENDING,
        shouldCreateInstance: false,
        shouldFire: false,
        shouldResolve: false,
        newPendingSince: effectivePendingSince,
        newStartedAt: null,
        resolvedAt: null,
      };
    }

    // 3. Previous state was FIRING
    if (currentState === AlertState.FIRING) {
      if (conditionMet) {
        // Still firing
        return {
          newState: AlertState.FIRING,
          shouldCreateInstance: false,
          shouldFire: false,
          shouldResolve: false,
          newPendingSince: pendingSince,
          newStartedAt: startedAt || now,
          resolvedAt: null,
        };
      }

      // Recovered! Condition is no longer met
      return {
        newState: AlertState.RESOLVED,
        shouldCreateInstance: false,
        shouldFire: false,
        shouldResolve: true,
        newPendingSince: null,
        newStartedAt: startedAt,
        resolvedAt: now,
      };
    }

    // Fallback
    return {
      newState: AlertState.NORMAL,
      shouldCreateInstance: false,
      shouldFire: false,
      shouldResolve: false,
      newPendingSince: null,
      newStartedAt: null,
      resolvedAt: null,
    };
  }
}
