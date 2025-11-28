// src/navigation/DrawerNavigator.tsx
import React from "react";
import { createDrawerNavigator } from "@react-navigation/drawer";
import CustomDrawer from "../components/CustomDrawer";

// User Screens
import HomeScreen from "../screens/HomeScreen";
import LoanApplicationScreen from "../screens/LoanApplicationScreen";
import MyLoanScreen from "../screens/MyLoanScreen";
import PaymentHistoryScreen from "../screens/PaymentHistoryScreen";
import AccountSettingsScreen from "../screens/AccountSettingsScreen";
import HelpSupportScreen from "../screens/HelpSupportScreen";

const Drawer = createDrawerNavigator();

export default function DrawerNavigator() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerType: "front",
      }}
      drawerContent={(props) => <CustomDrawer {...props} />}
    >
      {/* MUST MATCH THE NAMES USED IN CustomDrawer */}
      <Drawer.Screen name="Dashboard" component={HomeScreen} />
      <Drawer.Screen name="Loan Application" component={LoanApplicationScreen} />
      <Drawer.Screen name="My Loan" component={MyLoanScreen} />
      <Drawer.Screen name="Payment History" component={PaymentHistoryScreen} />
      <Drawer.Screen name="Account Settings" component={AccountSettingsScreen} />
      <Drawer.Screen name="Help Support" component={HelpSupportScreen} />
    </Drawer.Navigator>
  );
}
