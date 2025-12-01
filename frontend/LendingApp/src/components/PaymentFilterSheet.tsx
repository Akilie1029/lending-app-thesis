// src/components/PaymentFilterSheet.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  Animated,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Pressable,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Icon from "react-native-vector-icons/Ionicons";

const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_HEIGHT = Math.round(SCREEN_H * 0.8);

export const PAYMENT_METHODS = [
  { key: "GCash", label: "GCash" },
  { key: "Maya", label: "Maya" },
  { key: "Bank", label: "Bank" },
  { key: "Card", label: "Card" },
];

type SortKey = "newest" | "oldest" | "amount_desc" | "amount_asc";

type Props = {
  visible: boolean;
  initial?: {
    from?: string;
    to?: string;
    method?: string | null;
    sort?: SortKey;
  };
  onRequestClose: () => void;
  onApply: (filters: {
    from: string | null;
    to: string | null;
    method: string | null;
    sort: SortKey;
  }) => void;
};

export default function PaymentFilterSheet({
  visible,
  initial = {},
  onRequestClose,
  onApply,
}: Props) {
  const [translateY] = useState(new Animated.Value(SHEET_HEIGHT));

  const [fromDate, setFromDate] = useState<Date | null>(
    initial.from ? new Date(initial.from) : null
  );
  const [toDate, setToDate] = useState<Date | null>(
    initial.to ? new Date(initial.to) : null
  );

  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const [selectedMethod, setSelectedMethod] = useState<string | null>(
    initial.method || null
  );

  const [sort, setSort] = useState<SortKey>(initial.sort || "newest");

  /** Slide animation */
  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : SHEET_HEIGHT,
      duration: visible ? 260 : 200,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  /** Sync initial values when modal opens */
  useEffect(() => {
    setFromDate(initial.from ? new Date(initial.from) : null);
    setToDate(initial.to ? new Date(initial.to) : null);
    setSelectedMethod(initial.method || null);
    setSort(initial.sort || "newest");
  }, [visible]);

  const clearAll = () => {
    setFromDate(null);
    setToDate(null);
    setSelectedMethod(null);
    setSort("newest");
  };

  const applyFilters = () => {
    onApply({
      from: fromDate ? fromDate.toISOString().slice(0, 10) : null,
      to: toDate ? toDate.toISOString().slice(0, 10) : null,
      method: selectedMethod,
      sort,
    });
    onRequestClose();
  };

  const quickSelect = (option: "today" | "week" | "month") => {
    const now = new Date();

    if (option === "today") {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      setFromDate(d);
      setToDate(d);
      return;
    }

    if (option === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      setFromDate(start);
      setToDate(now);
      return;
    }

    // this month (last 30 days)
    const start = new Date(now);
    start.setDate(now.getDate() - 29);
    setFromDate(start);
    setToDate(now);
  };

  const selectedCount =
    (selectedMethod ? 1 : 0) + (fromDate || toDate ? 1 : 0);

  return (
    <Modal visible={visible} transparent animationType="none">
      <Pressable style={styles.backdrop} onPress={onRequestClose} />

      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.handleBar} />

        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Filter Payments</Text>
        </View>

        <View style={styles.content}>
          {/* DATE RANGE */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date Range</Text>

            <View style={styles.row}>
              <TouchableOpacity
                style={styles.dateBox}
                onPress={() => setShowFromPicker(true)}
              >
                <Icon name="calendar-outline" size={18} color="#444" />
                <Text style={styles.dateText}>
                  {fromDate ? fromDate.toISOString().slice(0, 10) : "From"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateBox}
                onPress={() => setShowToPicker(true)}
              >
                <Icon name="calendar-outline" size={18} color="#444" />
                <Text style={styles.dateText}>
                  {toDate ? toDate.toISOString().slice(0, 10) : "To"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.quickRow}>
              <TouchableOpacity
                style={styles.quickBtn}
                onPress={() => quickSelect("today")}
              >
                <Text style={styles.quickBtnText}>Today</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickBtn}
                onPress={() => quickSelect("week")}
              >
                <Text style={styles.quickBtnText}>This Week</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickBtn}
                onPress={() => quickSelect("month")}
              >
                <Text style={styles.quickBtnText}>This Month</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* PAYMENT METHOD */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Method</Text>

            <View style={styles.chipsRow}>
              {PAYMENT_METHODS.map((opt) => {
                const active = selectedMethod === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.chip,
                      active && {
                        backgroundColor: "#169AF922",
                        borderColor: "#169AF9",
                      },
                    ]}
                    onPress={() =>
                      setSelectedMethod(active ? null : opt.key)
                    }
                  >
                    <Text style={styles.chipText}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* SORT */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sort</Text>

            <TouchableOpacity
              style={styles.selectBox}
              onPress={() => {
                const order: SortKey[] = [
                  "newest",
                  "oldest",
                  "amount_desc",
                  "amount_asc",
                ];
                const idx = order.indexOf(sort);
                setSort(order[(idx + 1) % order.length]);
              }}
            >
              <Text style={styles.selectText}>
                {sort === "newest"
                  ? "Newest first"
                  : sort === "oldest"
                  ? "Oldest first"
                  : sort === "amount_desc"
                  ? "Amount: High → Low"
                  : "Amount: Low → High"}
              </Text>
              <Icon name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom buttons */}
        <View style={styles.bottomRow}>
          <TouchableOpacity style={styles.resetBtn} onPress={clearAll}>
            <Text style={styles.resetText}>Reset All</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
            <Text style={styles.applyText}>
              Apply Filters
              {selectedCount > 0 ? ` (${selectedCount})` : ""}
            </Text>
          </TouchableOpacity>
        </View>

        {/* DATE PICKERS */}
        {showFromPicker && (
          <DateTimePicker
            value={fromDate || new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "calendar"}
            onChange={(e, d) => {
              setShowFromPicker(false);
              if (d) setFromDate(new Date(d));
            }}
          />
        )}

        {showToPicker && (
          <DateTimePicker
            value={toDate || new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "calendar"}
            onChange={(e, d) => {
              setShowToPicker(false);
              if (d) setToDate(new Date(d));
            }}
          />
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#00000066",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: SHEET_HEIGHT,
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 10,
  },
  handleBar: {
    width: 44,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#e6e6e6",
    alignSelf: "center",
    marginBottom: 8,
  },
  headerRow: {
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dateBox: {
    width: "48%",
    backgroundColor: "#f8f9fb",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eef2f6",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateText: { color: "#333", fontWeight: "600" },

  quickRow: { flexDirection: "row", marginTop: 10 },
  quickBtn: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#eef2f6",
    marginRight: 8,
  },
  quickBtnText: { fontWeight: "700", color: "#444" },

  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  chipText: {
    fontWeight: "600",
    color: "#333",
  },

  selectBox: {
    backgroundColor: "#f8f9fb",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eef2f6",
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectText: { fontWeight: "600", color: "#333" },

  bottomRow: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  resetBtn: {
    flex: 1,
    marginRight: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#169AF9",
    paddingVertical: 12,
    alignItems: "center",
  },
  resetText: {
    fontWeight: "800",
    color: "#169AF9",
  },
  applyBtn: {
    backgroundColor: "#169AF9",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minWidth: 140,
    alignItems: "center",
  },
  applyText: { fontWeight: "800", color: "#fff" },
});
