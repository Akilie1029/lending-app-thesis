// src/navigation/AdminDrawerNavigator.tsx

import React from "react";
import { createDrawerNavigator } from "@react-navigation/drawer";

// Custom Admin Drawer UI
import AdminDrawer from "../components/AdminDrawer";

// Admin Screens
import AdminDashboardScreen from "../screens/AdminDashboardScreen";
import AdminLoanApprovalScreen from "../screens/AdminLoanApprovalScreen";
import AdminDisbursementScreen from "../screens/AdminDisbursementScreen";
import AdminBorrowerListScreen from "../screens/AdminBorrowerListScreen";
import AdminLoansListScreen from "../screens/AdminLoansListScreen";
import AdminCollectionsScreen from "../screens/AdminCollectionsScreen";

const Drawer = createDrawerNavigator();

export default function AdminDrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <AdminDrawer {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        drawerActiveTintColor: "#0A9EFA",
        drawerLabelStyle: { fontSize: 16, fontWeight: "600" },
      }}
    >
      {/* Dashboard */}
      <Drawer.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ drawerLabel: "Dashboard" }}
      />

      {/* Pending Loan Approval */}
      <Drawer.Screen
        name="AdminLoanApprovalScreen"
        component={AdminLoanApprovalScreen}
        options={{ drawerLabel: "Pending Loan Approval" }}
      />

      {/* Pending Disbursement */}
      <Drawer.Screen
        name="AdminDisbursementScreen"
        component={AdminDisbursementScreen}
        options={{ drawerLabel: "Pending Disbursement" }}
      />

      {/* Borrowers */}
      <Drawer.Screen
        name="AdminBorrowerListScreen"
        component={AdminBorrowerListScreen}
        options={{ drawerLabel: "Borrowers" }}
      />

      {/* Loans List */}
      <Drawer.Screen
        name="AdminLoansListScreen"
        component={AdminLoansListScreen}
        options={{ drawerLabel: "Loans" }}
      />

      {/* Collections */}
      <Drawer.Screen
        name="AdminCollectionsScreen"
        component={AdminCollectionsScreen}
        options={{ drawerLabel: "Collections" }}
      />
    </Drawer.Navigator>
  );
}
