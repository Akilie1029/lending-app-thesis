// src/components/LoanFilterSheet.tsx
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

type SortKey = "newest" | "oldest" | "amount_desc" | "amount_asc";

export const STATUS_OPTIONS = [
  { key: "pending", label: "Pending", color: "#FFC107" },
  { key: "approved", label: "Approved", color: "#169AF9" },
  { key: "active", label: "Active", color: "#19d06b" },
  { key: "paid", label: "Paid", color: "#7b61ff" },
  { key: "rejected", label: "Rejected", color: "#ff4d4d" },
];

type Props = {
  visible: boolean;
  initial?: {
    q?: string;
    from?: string;
    to?: string;
    statuses?: string[];
    sort?: SortKey;
  };
  onRequestClose: () => void;
  onApply: (filters: {
    q?: string;
    from?: string | null;
    to?: string | null;
    statuses?: string[] | null;
    sort?: SortKey;
  }) => void;
};

export default function LoanFilterSheet({
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

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(
    initial.statuses || []
  );

  const [sort, setSort] = useState<SortKey>(initial.sort || "newest");

  useEffect(() => {
    if (visible) {
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SHEET_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  useEffect(() => {
    setFromDate(initial.from ? new Date(initial.from) : null);
    setToDate(initial.to ? new Date(initial.to) : null);
    setSelectedStatuses(initial.statuses || []);
    setSort(initial.sort || "newest");
  }, [initial, visible]);

  const toggleStatus = (key: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  };

  const clearAll = () => {
    setFromDate(null);
    setToDate(null);
    setSelectedStatuses([]);
    setSort("newest");
  };

  const applyFilters = () => {
    onApply({
      from: fromDate ? fromDate.toISOString().slice(0, 10) : null,
      to: toDate ? toDate.toISOString().slice(0, 10) : null,
      statuses: selectedStatuses.length > 0 ? selectedStatuses : null,
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
    } else if (option === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      setFromDate(new Date(start));
      setToDate(new Date(now));
    } else {
      const start = new Date(now);
      start.setDate(now.getDate() - 29);
      setFromDate(new Date(start));
      setToDate(new Date(now));
    }
  };

  const selectedCount = selectedStatuses.length;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <Pressable style={styles.backdrop} onPress={onRequestClose} />

      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        {/* Handle */}
        <View style={styles.handleBar} />

        {/* Header (NO RESET BUTTON) */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Filter Loans</Text>
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
                  {fromDate
                    ? fromDate.toISOString().slice(0, 10)
                    : "From"}
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

          {/* STATUS */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status</Text>

            <View style={styles.chipsRow}>
              {STATUS_OPTIONS.map((opt) => {
                const active = selectedStatuses.includes(opt.key);
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.chip,
                      active && {
                        borderColor: opt.color,
                        backgroundColor: `${opt.color}22`,
                      },
                    ]}
                    onPress={() => toggleStatus(opt.key)}
                  >
                    <View
                      style={[styles.statusDot, { backgroundColor: opt.color }]}
                    />
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

        {/* BOTTOM BUTTONS */}
        <View style={styles.bottomRow}>
          <TouchableOpacity style={styles.resetBtnBottom} onPress={clearAll}>
            <Text style={styles.resetBtnText}>Reset All</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.applyBtnBottom} onPress={applyFilters}>
            <Text style={styles.applyBtnText}>
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
              if (d)
                setFromDate(
                  new Date(d.getFullYear(), d.getMonth(), d.getDate())
                );
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
              if (d)
                setToDate(
                  new Date(d.getFullYear(), d.getMonth(), d.getDate())
                );
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
    elevation: 8,
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
    paddingBottom: 6,
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#111" },

  content: { paddingHorizontal: 18, paddingTop: 8, flex: 1 },

  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111" },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
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
  dateText: { marginLeft: 6, color: "#333", fontWeight: "600" },

  quickRow: {
    flexDirection: "row",
    marginTop: 12,
  },
  quickBtn: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#eef2f6",
    marginRight: 8,
  },
  quickBtnText: { color: "#444", fontWeight: "700" },

  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  chipText: { marginLeft: 8, fontWeight: "600" },
  statusDot: { width: 10, height: 10, borderRadius: 5 },

  selectBox: {
    backgroundColor: "#f8f9fb",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eef2f6",
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

  resetBtnBottom: {
    flex: 1,
    marginRight: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#169AF9",
    paddingVertical: 12,
    alignItems: "center",
  },
  resetBtnText: {
    color: "#169AF9",
    fontWeight: "800",
  },

  applyBtnBottom: {
    backgroundColor: "#169AF9",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    minWidth: 140,
  },
  applyBtnText: { color: "#fff", fontWeight: "800" },
});
