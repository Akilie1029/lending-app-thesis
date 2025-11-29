// App.tsx
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import AsyncStorage from "@react-native-async-storage/async-storage";

// Borrower Screens
import LoginScreen from "./src/screens/LoginScreen";
import SignupScreen from "./src/screens/SignupScreen";
import HomeScreen from "./src/screens/HomeScreen";
import LoanApplicationScreen from "./src/screens/LoanApplicationScreen";
import MyLoanScreen from "./src/screens/MyLoanScreen";
import PaymentHistoryScreen from "./src/screens/PaymentHistoryScreen";
import RepayLoanScreen from "./src/screens/RepayLoanScreen";
import LoanDetailsScreen from "./src/screens/LoanDetailsScreen";
import LoanPayMethodScreen from "./src/screens/LoanPayMethodScreen";
import GCashSimScreen from "./src/screens/GCashSimScreen";
import MayaSimScreen from "./src/screens/MayaSimScreen";
import BankPayScreen from "./src/screens/BankSimScreen";
import CardPayScreen from "./src/screens/CardPayScreen";

// Drawers
import DrawerNavigator from "./src/navigation/DrawerNavigator";
import AdminDrawerNavigator from "./src/navigation/AdminDrawerNavigator";

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<"Login" | "Drawer" | "AdminDrawer">("Login");

  useEffect(() => {
    checkLogin();
  }, []);

  async function checkLogin() {
    const token = await AsyncStorage.getItem("userToken");
    const role = await AsyncStorage.getItem("userRole");

    if (!token) {
      setInitialRoute("Login");
      return;
    }

    if (role === "admin") {
      setInitialRoute("AdminDrawer");
      return;
    }

    setInitialRoute("Drawer");
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>

        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />

        {/* Borrower Drawer */}
        <Stack.Screen name="Drawer" component={DrawerNavigator} />

        {/* Admin Drawer */}
        <Stack.Screen name="AdminDrawer" component={AdminDrawerNavigator} />

        {/* Loan Flow */}
        <Stack.Screen name="LoanApplication" component={LoanApplicationScreen} />
        <Stack.Screen name="MyLoanScreen" component={MyLoanScreen} />
        <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} />
        <Stack.Screen name="RepayLoan" component={RepayLoanScreen} />
        <Stack.Screen name="Loan Details" component={LoanDetailsScreen} />
        <Stack.Screen name="LoanPayMethod" component={LoanPayMethodScreen} />

        {/* Payment Method Screens */}
        <Stack.Screen name="GCashSim" component={GCashSimScreen} />
        <Stack.Screen name="MayaSim" component={MayaSimScreen} />
        <Stack.Screen name="BankPay" component={BankPayScreen} />
        <Stack.Screen name="CardPay" component={CardPayScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
