import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/Ionicons";

export default function LoanPayMethodScreen({ route, navigation }: any) {
  const { loan, amount } = route.params;

  const methods = [
    { label: "GCash", icon: "phone-portrait", route: "GCashPay" },
    { label: "Maya", icon: "wallet", route: "MayaPay" },
    { label: "Bank Transfer", icon: "business", route: "BankPay" },
    { label: "Debit / Credit Card", icon: "card", route: "CardPay" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f7fb" }}>
      <LinearGradient colors={["#169AF9", "#37AAF2"]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Payment Method</Text>
        <View style={{ width: 26 }} />
      </LinearGradient>

      <View style={{ marginTop: 10 }}>
        {methods.map((m, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.methodCard}
            onPress={() =>
              navigation.navigate(m.route, { loan, amount })
            }
          >
            <Icon name={m.icon} size={28} color="#169AF9" />
            <Text style={styles.methodText}>{m.label}</Text>
            <Icon name="chevron-forward" size={24} color="#777" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 50,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },

  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#169AF9",
  },

  methodText: {
    fontSize: 17,
    fontWeight: "700",
    marginLeft: 12,
    flex: 1,
  },
});
