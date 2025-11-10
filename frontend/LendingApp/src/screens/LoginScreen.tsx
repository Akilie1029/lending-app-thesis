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
import LinearGradient from 'react-native-linear-gradient'; // ✅ Keep for gradient background
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoginScreenProps } from '../../App';

const { height } = Dimensions.get('window');

const LoginScreen = ({ navigation }: LoginScreenProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    try {
      const response = await axios.post('http://192.168.1.222:5001/api/auth/login', {
        email,
        password,
      });

      const { token } = response.data;
      await AsyncStorage.setItem('userToken', token);
      navigation.navigate('Home');
    } catch (error: any) {
      Alert.alert('Login Failed', error.response?.data?.error || 'Invalid credentials');
    }
  };

  return (
    // ✅ Gradient replaces solid blue background
    <LinearGradient
      colors={['#169AF9', '#37AAF2']}
      start={{ x: 0, y: 0.04 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradientBackground}
    >
      <SafeAreaView style={styles.container}>
        {/* 🔵 Header with circular logo wrapper */}
        <View style={styles.blueHeader}>
          <View style={styles.logoWrapper}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
            />
          </View>
        </View>

        {/* ⚪ White content container */}
        <View style={styles.formContainer}>
          <Text style={styles.title}>Welcome Back</Text>

          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor="#666"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#666"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>

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

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },

  // 🔵 Gradient header with rounded bottom edges
  blueHeader: {
    width: '100%',
    height: '18%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
    overflow: 'hidden',
  },

  // ⚪ Logo “island” wrapper
  logoWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 60,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    position: 'relative',
    marginTop: -40,
  },

  // 🖼️ Logo image itself
  logo: {
    width: 230,
    height: 180,
    resizeMode: 'contain',
    marginHorizontal: 20,
    bottom: -30,
  },

  // ⚪ Main white container with inputs
  formContainer: {
    position: 'absolute',
    bottom: 20,
    backgroundColor: '#fff',
    width: '95%',
    height: height * 0.75,
    borderRadius: 30,
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 120,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#007BFF',
    marginBottom: 30,
    fontFamily: 'Roboto', // ✅ system font
  },

  input: {
    width: '100%',
    height: 50,
    borderWidth: 1.5,
    borderColor: '#007BFF',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 16,
    fontSize: 16,
    fontFamily: 'Roboto',
  },

  button: {
    width: '50%',
    backgroundColor: '#0A9EFA',
    borderRadius: 15,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#0367A6',
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },

  footerText: {
    marginTop: 100,
    color: '#444',
    fontFamily: 'Roboto',
  },

  signupButton: {
    width: '40%',
    backgroundColor: '#0A9EFA',
    borderRadius: 12,
    paddingVertical: 5,
    alignItems: 'center',
    marginTop: 15,
    borderWidth: 2,
    borderColor: '#0367A6',
  },

  signupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
});
