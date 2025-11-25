import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { View, Text, StyleSheet, Alert } from "react-native";

import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Navigation Ref
import { navigationRef } from "./src/navigation/NavigationRef";

// User Screens
import LoginScreen from "./src/screens/LoginScreen";
import SignupScreen from "./src/screens/SignupScreen";
import HomeScreen from "./src/screens/HomeScreen";
import LoanApplicationScreen from "./src/screens/LoanApplicationScreen";
import LoanDetailsScreen from "./src/screens/LoanDetailsScreen";
import PaymentHistoryScreen from "./src/screens/PaymentHistoryScreen";
import MyLoanScreen from "./src/screens/MyLoanScreen";
import AccountSettingsScreen from "./src/screens/AccountSettingsScreen";
import HelpSupportScreen from "./src/screens/HelpSupportScreen";

// Repayment
import RepayLoanScreen from "./src/screens/RepayLoanScreen";
import LoanPayMethodScreen from "./src/screens/LoanPayMethodScreen";
import GCashPayScreen from "./src/screens/GCashSimScreen";
import MayaPayScreen from "./src/screens/MayaSimScreen";
import BankPayScreen from "./src/screens/BankPayScreen";
import CardPayScreen from "./src/screens/CardPayScreen";

// Admin Navigation
import AdminDrawerNavigator from "./src/navigation/AdminDrawerNavigator";

// Drawer Component
import CustomDrawer from "./src/components/CustomDrawer";


// ===============================================
// Drawer Types
// ===============================================
export type DrawerParamList = {
  Dashboard: undefined;
  "Loan Application": undefined;
  "Payment History": undefined;
  "My Loan": undefined;
  "Account Settings": undefined;
  "Help Support": undefined;
};


// ===============================================
// Stack Types
// ===============================================
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;

  Home: undefined;

  "Loan Details": { loanId: string } | undefined;
  "Loan Application": undefined;

  // Admin
  AdminDrawer: undefined;

  // Repayment Flow
  RepayLoan: { loan: any };
  LoanPayMethod: { loan: any };

  GCashPay: { loan: any; amount: number };
  MayaPay: { loan: any; amount: number };
  BankPay: { loan: any; amount: number };
  CardPay: { loan: any; amount: number };

  // History
  "Payment History": undefined;
};


// ===============================================
// Navigators
// ===============================================
const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();


// ===============================================
// 🔐 AXIOS INTERCEPTOR — Auto-Logout JWT Expiration
// ===============================================
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;

    if (status === 401) {
      console.log("🔐 JWT expired — Logging out user");

      await AsyncStorage.removeItem("userToken");

      Alert.alert("Session Expired", "Please log in again.");

      if (navigationRef.isReady()) {
        navigationRef.reset({
          index: 0,
          routes: [{ name: "Login" }],
        });
      }
    }

    return Promise.reject(error);
  }
);


// ===============================================
// Drawer for Regular Users
// ===============================================
function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawer {...props} />}
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: "#0A9EFA",
        drawerLabelStyle: { fontSize: 16, fontWeight: "600" },
      }}
    >
      <Drawer.Screen
        name="Dashboard"
        component={HomeScreen}
        options={{ drawerLabel: "Home" }}
      />

      <Drawer.Screen
        name="Loan Application"
        component={LoanApplicationScreen}
        options={{ drawerLabel: "Apply for Loan" }}
      />

      <Drawer.Screen
        name="Payment History"
        component={PaymentHistoryScreen}
        options={{ drawerLabel: "Payment History" }}
      />

      <Drawer.Screen
        name="My Loan"
        component={MyLoanScreen}
        options={{ drawerLabel: "My Loan" }}
      />

      <Drawer.Screen
        name="Account Settings"
        component={AccountSettingsScreen}
        options={{ drawerLabel: "Account Settings" }}
      />

      <Drawer.Screen
        name="Help Support"
        component={HelpSupportScreen}
        options={{ drawerLabel: "Help & Support" }}
      />
    </Drawer.Navigator>
  );
}


// ===============================================
// ROOT APP NAVIGATION
// ===============================================
function App() {
  global.navigationRef = navigationRef;

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{ headerShown: false }}
      >
        {/* AUTH */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={SignupScreen} />

        {/* USER MAIN */}
        <Stack.Screen name="Home" component={DrawerNavigator} />

        {/* LOAN ROUTES */}
        <Stack.Screen name="Loan Details" component={LoanDetailsScreen} />
        <Stack.Screen name="Loan Application" component={LoanApplicationScreen} />
        <Stack.Screen name="Payment History" component={PaymentHistoryScreen} />

        {/* REPAYMENT FLOW */}
        <Stack.Screen name="RepayLoan" component={RepayLoanScreen} />
        <Stack.Screen name="LoanPayMethod" component={LoanPayMethodScreen} />

        <Stack.Screen name="GCashPay" component={GCashPayScreen} />
        <Stack.Screen name="MayaPay" component={MayaPayScreen} />
        <Stack.Screen name="BankPay" component={BankPayScreen} />
        <Stack.Screen name="CardPay" component={CardPayScreen} />

        {/* ADMIN */}
        <Stack.Screen name="AdminDrawer" component={AdminDrawerNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;


// ===============================================
// Styles
// ===============================================
const styles = StyleSheet.create({
  placeholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 18,
    color: "#555",
    fontWeight: "500",
  },
});
