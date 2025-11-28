// src/screens/LoanPayMethodScreen.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/Ionicons";
import { useRoute, useNavigation } from "@react-navigation/native";

export default function LoanPayMethodScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const loan = route.params?.loan;
  const amount = route.params?.amount ?? loan?.daily_payment ?? 0;

  if (!loan) {
    return (
      <View style={styles.center}>
        <Text>No loan selected.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f7fb" }}>
      <LinearGradient colors={["#169AF9", "#37AAF2"]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Choose Payment Method</Text>
        <View style={{ width: 44 }} />
      </LinearGradient>

      <View style={styles.container}>
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Amount to Pay</Text>
          <Text style={styles.amountValue}>₱ {Number(amount).toLocaleString()}</Text>
        </View>

        {/* GCash */}
        <TouchableOpacity
          style={styles.methodCard}
          onPress={() => navigation.navigate("GCashSim", { loan, amount })}
        >
          <Icon name="phone-portrait" size={30} color="#169AF9" />
          <View>
            <Text style={styles.methodTitle}>GCash</Text>
            <Text style={styles.methodSub}>Pay using GCash wallet</Text>
          </View>
        </TouchableOpacity>

        {/* Maya */}
        <TouchableOpacity
          style={styles.methodCard}
          onPress={() => navigation.navigate("MayaSim", { loan, amount })}
        >
          <Icon name="wallet" size={30} color="#8A2BE2" />
          <View>
            <Text style={styles.methodTitle}>Maya</Text>
            <Text style={styles.methodSub}>Pay using Maya</Text>
          </View>
        </TouchableOpacity>

        {/* Bank */}
        <TouchableOpacity
          style={styles.methodCard}
          onPress={() => navigation.navigate("BankPay", { loan, amount })}
        >
          <Icon name="md-bank" size={30} color="#0077C8" />
          <View>
            <Text style={styles.methodTitle}>Bank Transfer</Text>
            <Text style={styles.methodSub}>Deposit & confirm reference</Text>
          </View>
        </TouchableOpacity>

        {/* Card */}
        <TouchableOpacity
          style={styles.methodCard}
          onPress={() => navigation.navigate("CardPay", { loan, amount })}
        >
          <Icon name="card" size={30} color="#0A84FF" />
          <View>
            <Text style={styles.methodTitle}>Debit / Credit Card</Text>
            <Text style={styles.methodSub}>Mastercard / Visa</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 50, paddingBottom: 18, paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { color: "#fff", fontWeight: "700", fontSize: 20 },

  container: { padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  amountBox: {
    backgroundColor: "#fff",
    padding: 14,
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e8f4ff",
  },
  amountLabel: { color: "#666" },
  amountValue: { fontSize: 26, fontWeight: "900", marginTop: 6 },

  methodCard: {
    flexDirection: "row",
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
    elevation: 2,
    borderWidth: 1,
    borderColor: "#eaf6ff",
    gap: 14,
  },
  methodTitle: { fontWeight: "800", fontSize: 16 },
  methodSub: { color: "#666", fontSize: 12 },
});
