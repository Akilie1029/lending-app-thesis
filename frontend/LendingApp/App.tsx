import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { View, Text, StyleSheet } from 'react-native';

// --- 🧩 Import Screens ---
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import HomeScreen from './src/screens/HomeScreen';
import LoanApplicationScreen from './src/screens/LoanApplicationScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import LoanDetailsScreen from './src/screens/LoanDetailsScreen';


// --- 🧩 Import the Custom Drawer UI Component ---
import CustomDrawer from './src/components/CustomDrawer'; // 🆕 Added import

// ======================================================================
// 📋 Type Definitions
// ======================================================================

// Drawer routes (inside Home after login)
type DrawerParamList = {
  Dashboard: undefined;
  'Loan Application': undefined;
  AdminDashboard: undefined;
  Settings: undefined;
};

// Stack routes (main app flow: login → home/drawer)
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
};

// ======================================================================
// 🧭 Navigator Setup
// ======================================================================
const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

// --- Type-safe props for each screen ---
export type LoginScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Login'
>;
export type SignupScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Register'
>;
export type HomeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Home'
>;

// ======================================================================
// 🧩 Drawer Navigator (used after login)
// ======================================================================
function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawer {...props} />} // 🆕 Custom drawer UI
      screenOptions={{
        headerShown: false, // hide default header
        drawerActiveTintColor: '#0A9EFA',
        drawerLabelStyle: { fontSize: 16, fontWeight: '600' },
      }}
    >
      {/* 🏠 Dashboard */}
      <Drawer.Screen
        name="Dashboard"
        component={HomeScreen}
        options={{ drawerLabel: 'Home' }}
      />

      {/* 💸 Loan Application */}
      <Drawer.Screen
        name="Loan Application"
        component={LoanApplicationScreen}
        options={{ drawerLabel: 'Apply for Loan' }}
      />

      {/* 🧑‍💼 Admin Dashboard */}
      <Drawer.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ drawerLabel: 'Admin Dashboard' }}
      />

      {/* ⚙️ Placeholder Settings */}
      <Drawer.Screen
        name="Settings"
        component={PlaceholderScreen}
        options={{ drawerLabel: 'Settings' }}
      />
    </Drawer.Navigator>
  );
}

// ======================================================================
// ⚙️ Placeholder Screen (Temporary)
// ======================================================================
function PlaceholderScreen() {
  return (
    <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderText}>Settings coming soon ⚙️</Text>
    </View>
  );
}

// ======================================================================
// 🚀 Main App Navigator
// ======================================================================
function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{ headerShown: false }}
      >
        {/* 🔐 Auth Screens */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={SignupScreen} />

        {/* 🏠 Drawer (Main App Shell) */}
        <Stack.Screen name="Home" component={DrawerNavigator} />

        {/* 📄 Loan Details (Global Access) */}
        <Stack.Screen name="Loan Details" component={LoanDetailsScreen} />

        {/* 💸 Optional Direct Access */}
        <Stack.Screen name="Loan Application" component={LoanApplicationScreen} />
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
