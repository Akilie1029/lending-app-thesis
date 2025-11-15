import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { View, Text, StyleSheet } from 'react-native';

// --- 🧩 Import User Screens ---
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import HomeScreen from './src/screens/HomeScreen';
import LoanApplicationScreen from './src/screens/LoanApplicationScreen';
import LoanDetailsScreen from './src/screens/LoanDetailsScreen';

// --- 🧩 Import Admin Screens ---
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import AdminLoanApprovalScreen from './src/screens/AdminLoanApprovalScreen';
import AdminDisbursementScreen from './src/screens/AdminDisbursementScreen';
import AdminBorrowerListScreen from './src/screens/AdminBorrowerListScreen';
import AdminLoansListScreen from './src/screens/AdminLoansListScreen';
import AdminCollectionsScreen from './src/screens/AdminCollectionsScreen';

// --- 🧩 Import Admin Drawer ---
import AdminDrawerNavigator from './src/navigation/AdminDrawerNavigator';

// --- 🧩 Import User Drawer ---
import CustomDrawer from './src/components/CustomDrawer';

// ======================================================================
// 📋 Type Definitions
// ======================================================================

export type DrawerParamList = {
  Dashboard: undefined;
  'Loan Application': undefined;
  Settings: undefined;
};

// Stack routes (global)
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;

  // User main shell
  Home: undefined;

  // Loan
  'Loan Details': { loanId: string } | undefined;
  'Loan Application': undefined;

  // Admin shell
  AdminDrawer: undefined;

  // Admin stack-only screens
  AdminLoanApprovalScreen: undefined;
  AdminDisbursementScreen: undefined;
  AdminBorrowerListScreen: undefined;
  AdminLoansListScreen: undefined;
  AdminCollectionsScreen: undefined;
};

// ======================================================================
// 🧭 Navigator Setup
// ======================================================================
const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

// ======================================================================
// 🧩 USER Drawer Navigator
// ======================================================================
function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawer {...props} />}
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: '#0A9EFA',
        drawerLabelStyle: { fontSize: 16, fontWeight: '600' },
      }}
    >
      <Drawer.Screen
        name="Dashboard"
        component={HomeScreen}
        options={{ drawerLabel: 'Home' }}
      />

      <Drawer.Screen
        name="Loan Application"
        component={LoanApplicationScreen}
        options={{ drawerLabel: 'Apply for Loan' }}
      />

      <Drawer.Screen
        name="Settings"
        component={PlaceholderScreen}
        options={{ drawerLabel: 'Settings' }}
      />
    </Drawer.Navigator>
  );
}

// ======================================================================
// ⚙️ Placeholder Screen
// ======================================================================
function PlaceholderScreen() {
  return (
    <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderText}>Settings coming soon ⚙️</Text>
    </View>
  );
}

// ======================================================================
// 🚀 MAIN App Navigator (Stack)
// ======================================================================
function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>

        {/* Authentication */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={SignupScreen} />

        {/* USER Drawer */}
        <Stack.Screen name="Home" component={DrawerNavigator} />

        {/* Loan */}
        <Stack.Screen name="Loan Details" component={LoanDetailsScreen} />
        <Stack.Screen name="Loan Application" component={LoanApplicationScreen} />

        {/* ADMIN Drawer */}
        <Stack.Screen name="AdminDrawer" component={AdminDrawerNavigator} />

        {/* ADMIN Supporting Screens */}
        <Stack.Screen name="AdminLoanApprovalScreen" component={AdminLoanApprovalScreen} />
        <Stack.Screen name="AdminDisbursementScreen" component={AdminDisbursementScreen} />
        <Stack.Screen name="AdminBorrowerListScreen" component={AdminBorrowerListScreen} />
        <Stack.Screen name="AdminLoansListScreen" component={AdminLoansListScreen} />
        <Stack.Screen name="AdminCollectionsScreen" component={AdminCollectionsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;

// ======================================================================
// 🎨 Styles
// ======================================================================
const styles = StyleSheet.create({
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 18,
    color: '#555',
    fontWeight: '500',
  },
});
