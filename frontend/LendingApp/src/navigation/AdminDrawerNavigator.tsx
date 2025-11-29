// src/navigation/AdminDrawerNavigator.tsx
import React from "react";
import { createDrawerNavigator } from "@react-navigation/drawer";
import Icon from "react-native-vector-icons/Ionicons";

import AdminDashboardScreen from "../screens/AdminDashboardScreen";
import AdminLoanApprovalScreen from "../screens/AdminLoanApprovalScreen";
import AdminDisbursementScreen from "../screens/AdminDisbursementScreen";
import AdminApprovedLoansScreen from "../screens/AdminApprovedLoansScreen";
import AdminAllLoansScreen from "../screens/AdminAllLoansScreen"; // ✔ NEW correct screen

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

const Drawer = createDrawerNavigator();

// ===============================
// HEADER
// ===============================
function DrawerHeader() {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>KAURta Admin</Text>
      <Text style={styles.headerSubtitle}>Management Panel</Text>
    </View>
  );
}

// ===============================
// LOGOUT BUTTON
// ===============================
function LogoutButton({ navigation }: any) {
  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("userToken");
          navigation.reset({
            index: 0,
            routes: [{ name: "Login" }],
          });
        },
      },
    ]);
  };

  return (
    <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
      <Icon name="log-out-outline" size={22} color="#ff3b30" />
      <Text style={styles.logoutText}>Logout</Text>
    </TouchableOpacity>
  );
}

// ===============================
// DRAWER NAVIGATOR
// ===============================
export default function AdminDrawerNavigator({ navigation }: any) {
  return (
    <Drawer.Navigator
      screenOptions={{
        header: () => <DrawerHeader />,
        drawerActiveBackgroundColor: "#dff3ff",
        drawerActiveTintColor: "#169AF9",
        drawerLabelStyle: { fontWeight: "600" },
      }}
    >
      {/* DASHBOARD */}
      <Drawer.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{
          drawerLabel: "Dashboard",
          drawerIcon: ({ color }) => (
            <Icon name="grid-outline" size={20} color={color} />
          ),
        }}
      />

      {/* LOAN APPROVALS */}
      <Drawer.Screen
        name="AdminLoanApprovalScreen"
        component={AdminLoanApprovalScreen}
        options={{
          drawerLabel: "Loan Approvals",
          drawerIcon: ({ color }) => (
            <Icon name="clipboard-outline" size={20} color={color} />
          ),
        }}
      />

      {/* DISBURSEMENTS */}
      <Drawer.Screen
        name="AdminDisbursementScreen"
        component={AdminDisbursementScreen}
        options={{
          drawerLabel: "Disbursement",
          drawerIcon: ({ color }) => (
            <Icon name="cash-outline" size={20} color={color} />
          ),
        }}
      />

      {/* APPROVED LOANS */}
      <Drawer.Screen
        name="AdminApprovedLoansScreen"
        component={AdminApprovedLoansScreen}
        options={{
          drawerLabel: "Approved Loans",
          drawerIcon: ({ color }) => (
            <Icon name="checkmark-done-outline" size={20} color={color} />
          ),
        }}
      />

      {/* ALL LOANS LIST (REPLACED OLD AdminLoansListScreen) */}
      <Drawer.Screen
        name="AdminAllLoansScreen"
        component={AdminAllLoansScreen}
        options={{
          drawerLabel: "All Loans",
          drawerIcon: ({ color }) => (
            <Icon name="document-text-outline" size={20} color={color} />
          ),
        }}
      />

      {/* LOGOUT */}
      <Drawer.Screen
        name="AdminLogout"
        children={() => <LogoutButton navigation={navigation} />}
        options={{
          drawerLabel: "Logout",
          drawerIcon: () => (
            <Icon name="log-out-outline" size={20} color="#ff3b30" />
          ),
        }}
      />
    </Drawer.Navigator>
  );
}

// ===============================
// STYLES
// ===============================
const styles = StyleSheet.create({
  header: {
    padding: 20,
    backgroundColor: "#169AF9",
    paddingTop: 50,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
  },
  headerSubtitle: {
    color: "#e6f7ff",
    marginTop: 4,
    fontSize: 13,
  },
  logoutBtn: {
    flexDirection: "row",
    padding: 14,
    alignItems: "center",
    gap: 10,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ff3b30",
  },
});
