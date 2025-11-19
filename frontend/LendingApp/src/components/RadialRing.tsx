// src/components/RadialRing.tsx
import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

type Props = {
  progress: number; // 0 - 100
  label: string;
  amount: number;
  size?: number; // px
  strokeWidth?: number;
  colors?: { start: string; end: string };
};

export default function RadialRing({
  progress,
  label,
  amount,
  size = 92,
  strokeWidth = 10,
  colors = { start: "#4facfe", end: "#00c6fb" },
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Animated value 0..100 used to animate strokeDashoffset
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.max(0, Math.min(100, progress)),
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, [progress, anim]);

  const strokeDashoffset = anim.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  // rotation -90 to start from top
  const cx = size / 2;
  const cy = size / 2;

  const AnimatedCircle = Animated.createAnimatedComponent(Circle);

  return (
    <View style={styles.wrapper}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={`grad-${label}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={colors.start} />
            <Stop offset="100%" stopColor={colors.end} />
          </LinearGradient>
        </Defs>

        {/* background circle */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke="#E6EEF8"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* animated progress */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={`url(#grad-${label})`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset as any}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx}, ${cy}`}
        />
      </Svg>

      {/* Percentage centered */}
      <View style={[styles.centerText, { top: size * 0.33 }]}>
        <Text style={styles.percentText}>{Math.round(progress)}%</Text>
      </View>

      {/* Separator line below the percent */}
      <View style={styles.sep} />

      {/* Label and amount */}
      <Text style={styles.labelText}>{label}</Text>
      <Text style={styles.amountText}>₱ {amount.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    width: 80,
  },
  centerText: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  percentText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0b1220",
  },
  sep: {
    width: 36,
    height: 2,
    backgroundColor: "#e6eef8",
    marginTop: 8,
    borderRadius: 2,
  },
  labelText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  amountText: {
    marginTop: 4,
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
  },
});
