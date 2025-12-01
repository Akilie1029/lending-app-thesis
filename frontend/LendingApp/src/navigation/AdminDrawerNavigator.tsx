// src/navigation/AdminDrawerNavigator.tsx

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
} from "react-native";
import { DrawerContentScrollView } from "@react-navigation/drawer";
import { createDrawerNavigator } from "@react-navigation/drawer";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Admin Screens
import AdminDashboardScreen from "../screens/AdminDashboardScreen";
import AdminLoanApprovalScreen from "../screens/AdminLoanApprovalScreen";
import AdminDisbursementScreen from "../screens/AdminDisbursementScreen";
import AdminApprovedLoansScreen from "../screens/AdminApprovedLoansScreen"; // hidden but kept
import AdminAllLoansScreen from "../screens/AdminAllLoansScreen";
import AdminPaymentsScreen from "../screens/AdminPaymentScreen";

// ⭐ NEW — Loan Documents screen (hidden)
import AdminLoanDocumentsScreen from "../screens/AdminLoanDocumentsScreen";

const Drawer = createDrawerNavigator();

/* ============================================================
   CUSTOM DRAWER UI
============================================================ */
function AdminCustomDrawer(props: any) {
  const navigation = props.navigation;

  const handleLogout = () => {
    Alert.alert("Confirm Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("userToken");
          await AsyncStorage.removeItem("userRole");
          navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#169AF9" }}>
      {/* HEADER */}
      <View style={styles.header}>
        <Image
          source={require("../../assets/logo.png")}
          style={styles.logo}
        />
        <Text style={styles.adminName}>KAURta Admin</Text>
        <Text style={styles.adminEmail}>Management Panel</Text>
      </View>

      {/* MENU LIST */}
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.drawerScroll}
      >
        <View style={styles.drawerItems}>
          {/* Dashboard */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              navigation.navigate("AdminDashboard");
              navigation.closeDrawer();
            }}
          >
            <Icon name="view-dashboard-outline" size={40} color="#169AF9" />
            <Text style={styles.menuText}>Dashboard</Text>
          </TouchableOpacity>

          {/* Loan Approvals */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              navigation.navigate("AdminLoanApprovalScreen");
              navigation.closeDrawer();
            }}
          >
            <Icon name="clipboard-check-outline" size={40} color="#169AF9" />
            <Text style={styles.menuText}>Loan Approvals</Text>
          </TouchableOpacity>

          {/* Disbursement */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              navigation.navigate("AdminDisbursementScreen");
              navigation.closeDrawer();
            }}
          >
            <Icon name="cash-fast" size={40} color="#169AF9" />
            <Text style={styles.menuText}>Disbursement</Text>
          </TouchableOpacity>

          {/* All Loans */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              navigation.navigate("AdminAllLoansScreen");
              navigation.closeDrawer();
            }}
          >
            <Icon name="file-document-outline" size={40} color="#169AF9" />
            <Text style={styles.menuText}>All Loans</Text>
          </TouchableOpacity>

          {/* Payments */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              navigation.navigate("AdminPayments");
              navigation.closeDrawer();
            }}
          >
            <Icon name="credit-card-outline" size={40} color="#169AF9" />
            <Text style={styles.menuText}>Payments</Text>
          </TouchableOpacity>
        </View>
      </DrawerContentScrollView>

      {/* LOGOUT */}
      <View style={styles.bottomSection}>
        <TouchableOpacity style={styles.bottomItem} onPress={handleLogout}>
          <Icon name="logout" size={22} color="#FF3B30" />
          <Text style={[styles.bottomText, { color: "#FF3B30" }]}>
            Logout
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ============================================================
   MAIN NAVIGATOR
============================================================ */
export default function AdminDrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <AdminCustomDrawer {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: { width: "72%" },
        overlayColor: "rgba(0,0,0,0.4)",
      }}
    >
      {/* Visible Screens */}
      <Drawer.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Drawer.Screen
        name="AdminLoanApprovalScreen"
        component={AdminLoanApprovalScreen}
      />
      <Drawer.Screen
        name="AdminDisbursementScreen"
        component={AdminDisbursementScreen}
      />

      {/* Approved Loans — hidden */}
      <Drawer.Screen
        name="AdminApprovedLoansScreen"
        component={AdminApprovedLoansScreen}
        options={{ drawerItemStyle: { display: "none" } }}
      />

      <Drawer.Screen
        name="AdminAllLoansScreen"
        component={AdminAllLoansScreen}
      />

      {/* Payments */}
      <Drawer.Screen name="AdminPayments" component={AdminPaymentsScreen} />

      {/* ⭐ NEW — Loan Documents Screen (hidden) */}
      <Drawer.Screen
        name="AdminLoanDocuments"
        component={AdminLoanDocumentsScreen}
        options={{ drawerItemStyle: { display: "none" } }}
      />
    </Drawer.Navigator>
  );
}

/* ============================================================
   STYLES
============================================================ */
const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    backgroundColor: "#169AF9",
    padding: 20,
    paddingTop: 50,
  },
  logo: {
    width: 130,
    height: 55,
    marginBottom: 15,
    resizeMode: "contain",
  },
  adminName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
  adminEmail: {
    fontSize: 14,
    color: "#e3f3ff",
    marginBottom: 10,
  },
  drawerScroll: {
    backgroundColor: "#fff",
    marginHorizontal: 15,
    borderRadius: 20,
    paddingVertical: 5,
    elevation: 3,
    borderWidth: 3,
    borderColor: "#169AF9",
  },
  drawerItems: {},
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    marginLeft: 5,
  },
  menuText: {
    fontSize: 17,
    fontWeight: "500",
    marginLeft: 15,
    color: "#333",
  },
  bottomSection: {
    borderTopWidth: 2,
    borderTopColor: "#e0e0e0",
    backgroundColor: "#fff",
    alignItems: "center",
    borderRadius: 20,
    marginBottom: 15,
    marginHorizontal: 15,
    padding: 5,
  },
  bottomItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  bottomText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#169AF9",
    marginLeft: 10,
  },
});
