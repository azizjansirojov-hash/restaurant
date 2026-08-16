import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';
import { colors } from '../theme/tokens';
import type { OrderStatus } from '../types';

const STEPS: OrderStatus[] = ['received', 'preparing', 'ready', 'completed'];
const LABELS: Record<OrderStatus, string> = {
  received: 'Received',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Done',
  cancelled: 'Cancelled',
};

interface Props {
  status: OrderStatus;
}

export function OrderStatusStepper({ status }: Props) {
  if (status === 'cancelled') {
    return <Text style={styles.cancelled}>Order cancelled</Text>;
  }
  const idx = STEPS.indexOf(status);

  return (
    <View style={styles.row}>
      {STEPS.map((step, i) => {
        const active = i <= idx;
        const current = i === idx;
        return (
          <Animated.View
            key={step}
            layout={Layout.springify()}
            entering={FadeIn.delay(i * 40)}
            style={styles.step}
          >
            {i < STEPS.length - 1 && (
              <View style={[styles.line, i < idx && styles.lineActive]} />
            )}
            <View
              style={[
                styles.dot,
                active && styles.dotActive,
                current && styles.dotCurrent,
              ]}
            />
            <Text style={[styles.label, active && styles.labelActive]}>
              {LABELS[step]}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  step: { flex: 1, alignItems: 'center', position: 'relative' },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.hairline,
    marginBottom: 10,
    zIndex: 1,
  },
  dotActive: { backgroundColor: colors.olive },
  dotCurrent: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.pomegranate,
    marginBottom: 8,
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 0.2,
    color: colors.inkFaint,
    textAlign: 'center',
  },
  labelActive: { color: colors.charcoal },
  line: {
    position: 'absolute',
    top: 6,
    left: '50%',
    width: '100%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
  },
  lineActive: { backgroundColor: colors.olive },
  cancelled: {
    fontFamily: 'DMSans_500Medium',
    color: colors.danger,
    fontSize: 16,
  },
});
