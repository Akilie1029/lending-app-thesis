// ✅ Responsive Login Screen with Role-Based Routing

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoginScreenProps } from '../../App';

// Screen dimensions
const { width, height } = Dimensions.get('window');

// Responsive scale helpers
const scale = (size: number) => (width / 375) * size;
const verticalScale = (size: number) => (height / 812) * size;
const moderateScale = (size: number, factor = 0.5) =>
  size + (scale(size) - size) * factor;

const LoginScreen = ({ navigation }: LoginScreenProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // =================================================================
  //                      HANDLE LOGIN
  // =================================================================
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    try {
      console.log("🔐 Logging in:", email);

      // 1️⃣ Login → get token
      const response = await axios.post('http://192.168.1.222:5001/api/auth/login', {
        email,
        password,
      });

      const { token } = response.data;

      // 2️⃣ Save token
      await AsyncStorage.setItem('userToken', token);
      console.log("💾 Token stored:", token);

      // 3️⃣ Fetch user details (for role)
      const me = await axios.get('http://192.168.1.222:5001/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("👤 Logged-in user:", me.data);

// 4️⃣ ROUTE BASED ON ROLE (case-insensitive)
if (me.data.role?.toUpperCase() === "ADMIN") {
  console.log("🛡️ Admin detected → redirecting to AdminDrawer");

  navigation.reset({
    index: 0,
    routes: [{ name: "AdminDrawer" }],
  });

} else {
  console.log("👤 Borrower detected → redirecting to Home");

  navigation.reset({
    index: 0,
    routes: [{ name: "Home" }],
  });
}


    } catch (error: any) {
      console.log("❌ Login Error:", error.response?.data || error.message);
      Alert.alert('Login Failed', error.response?.data?.error || 'Invalid credentials');
    }
  };

  // =================================================================
  //                      UI / RENDER
  // =================================================================
  return (
    <LinearGradient
      colors={['#169AF9', '#37AAF2']}
      start={{ x: 0, y: 0.04 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradientBackground}
    >
      <SafeAreaView style={styles.container}>

        {/* Blue header */}
        <View style={styles.blueHeader}>
          <View style={styles.logoWrapper}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
            />
          </View>
        </View>

        {/* White form container */}
        <View style={styles.formContainer}>
          <Text style={styles.title}>Welcome Back</Text>

          {/* Email */}
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor="#666"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          {/* Password */}
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#666"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {/* Login Button */}
          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>

          {/* Footer */}
          <Text style={styles.footerText}>Don’t have an account?</Text>

          <TouchableOpacity
            style={styles.signupButton}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.signupButtonText}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default LoginScreen;

// =================================================================
//                         STYLE SHEET
// =================================================================

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },

  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },

  blueHeader: {
    width: '100%',
    height: height * 0.18,
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderBottomLeftRadius: scale(60),
    borderBottomRightRadius: scale(60),
    overflow: 'hidden',
  },

  logoWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(60),
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    position: 'relative',
    marginTop: verticalScale(-40),
  },

  logo: {
    width: scale(230),
    height: verticalScale(180),
    resizeMode: 'contain',
    marginHorizontal: scale(20),
    bottom: verticalScale(-30),
  },

  formContainer: {
    position: 'absolute',
    bottom: verticalScale(20),
    backgroundColor: '#fff',
    width: '95%',
    height: height * 0.75,
    borderRadius: scale(30),
    alignItems: 'center',
    paddingHorizontal: scale(30),
    paddingTop: verticalScale(120),
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },

  title: {
    fontSize: moderateScale(26),
    fontWeight: '700',
    color: '#007BFF',
    marginBottom: verticalScale(30),
  },

  input: {
    width: '100%',
    height: verticalScale(50),
    borderWidth: 1.5,
    borderColor: '#007BFF',
    borderRadius: scale(12),
    paddingHorizontal: scale(15),
    marginBottom: verticalScale(16),
    fontSize: moderateScale(16),
  },

  button: {
    width: '50%',
    backgroundColor: '#0A9EFA',
    borderRadius: scale(15),
    paddingVertical: verticalScale(10),
    alignItems: 'center',
    marginTop: verticalScale(12),
    borderWidth: 2,
    borderColor: '#0367A6',
  },

  buttonText: {
    color: '#fff',
    fontSize: moderateScale(16),
    fontWeight: '700',
  },

  footerText: {
    marginTop: verticalScale(100),
    color: '#444',
    fontSize: moderateScale(14),
  },

  signupButton: {
    width: '40%',
    backgroundColor: '#0A9EFA',
    borderRadius: scale(12),
    paddingVertical: verticalScale(5),
    alignItems: 'center',
    marginTop: verticalScale(15),
    borderWidth: 2,
    borderColor: '#0367A6',
  },

  signupButtonText: {
    color: '#fff',
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
});
