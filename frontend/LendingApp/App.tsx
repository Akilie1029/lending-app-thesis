import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';

// --- Screen Imports ---
// We import all the screens our app will use.
import LoginScreen from './src/screens/LoginScreen';

import HomeScreen from './src/screens/HomeScreen';
import LoanApplicationScreen from './src/screens/LoanApplicationScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';

// --- Type Definitions for our Navigation Stack ---
// This tells TypeScript what screens are available and what data they might receive.
export type RootStackParamList = {
  Login: undefined; 
  Register: undefined;  // 👈 Add this line
  Home: undefined;
  LoanApplication: undefined; 
  AdminDashboard: undefined;

};

// This creates the stack navigator based on our type definitions
const Stack = createNativeStackNavigator<RootStackParamList>();

// We export the prop types so each screen can use them. This is great practice.
export type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;

export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type LoanApplicationScreenProps = NativeStackScreenProps<RootStackParamList, 'LoanApplication'>;
export type AdminDashboardScreenProps = NativeStackScreenProps<RootStackParamList, 'AdminDashboard'>;


// --- The Main App Component ---
function App(): React.JSX.Element {
  return (
    // NavigationContainer is the root of our app's navigation
    <NavigationContainer>
      {/* Stack.Navigator manages all our screens in a stack */}
      <Stack.Navigator 
        initialRouteName="Login" // The app will start on the Login screen
        screenOptions={{ headerShown: false }} // This hides the default header bar
      >
        {/* --- Screen Definitions --- */}
        {/* Each screen must be defined here with its name and the component to show */}
        <Stack.Screen name="Login" component={LoginScreen} /> 
        
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="LoanApplication" component={LoanApplicationScreen} />
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;

