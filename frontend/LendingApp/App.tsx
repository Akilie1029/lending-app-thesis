import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { View, Text, StyleSheet } from 'react-native';

// User Screens
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import HomeScreen from './src/screens/HomeScreen';
import LoanApplicationScreen from './src/screens/LoanApplicationScreen';
import LoanDetailsScreen from './src/screens/LoanDetailsScreen';

// Admin Drawer Navigator
import AdminDrawerNavigator from './src/navigation/AdminDrawerNavigator';

// User Drawer Component
import CustomDrawer from './src/components/CustomDrawer';

// Drawer types (User drawer only)
export type DrawerParamList = {
  Dashboard: undefined;
  'Loan Application': undefined;
  Settings: undefined;
};

// Stack Routes (Root navigation)
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;

  // USER SHELL
  Home: undefined;

  // Loan
  'Loan Details': { loanId: string } | undefined;
  'Loan Application': undefined;

  // ADMIN SHELL
  AdminDrawer: undefined;
};

// Navigators
const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

// USER Drawer Navigator
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

// Settings placeholder
function PlaceholderScreen() {
  return (
    <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderText}>Settings coming soon ⚙️</Text>
    </View>
  );
}

// ROOT NAVIGATION
function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>

        {/* AUTH */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={SignupScreen} />

        {/* USER MAIN */}
        <Stack.Screen name="Home" component={DrawerNavigator} />

        {/* LOAN */}
        <Stack.Screen name="Loan Details" component={LoanDetailsScreen} />
        <Stack.Screen name="Loan Application" component={LoanApplicationScreen} />

        {/* ADMIN MAIN */}
        <Stack.Screen name="AdminDrawer" component={AdminDrawerNavigator} />

      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;

// Styles
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
