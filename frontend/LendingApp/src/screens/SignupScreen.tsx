// src/screens/SignupScreen.tsx

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LoginScreenProps } from "../../App";
import { API_BASE } from "../config";

// Responsive helpers
const { width, height } = Dimensions.get("window");
const scale = (size: number) => (width / 375) * size;
const verticalScale = (size: number) => (height / 812) * size;
const moderateScale = (size: number, factor = 0.5) =>
  size + (scale(size) - size) * factor;

const SignupScreen = ({ navigation }: LoginScreenProps) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      console.log("📤 SIGNUP REQUEST →", {
        full_name: fullName,
        email,
        password,
      });

      const res = await axios.post(`${API_BASE}/auth/register`, {
        full_name: fullName,
        email,
        password,
      });

      console.log("📥 SIGNUP RESPONSE →", res.data);

      const token = res.data?.token;

      if (token) {
        await AsyncStorage.setItem("userToken", token);
      }

      // Ensure role is set properly
      await AsyncStorage.setItem("userRole", "user");

      Alert.alert("Success", "Account created successfully!", [
        {
          text: "OK",
          onPress: () =>
            navigation.reset({
              index: 0,
              routes: [{ name: "Drawer" }],
            }),
        },
      ]);
    } catch (error: any) {
      console.log("❌ Signup error:", error?.response?.data || error.message);

      Alert.alert(
        "Signup Failed",
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#169AF9", "#37AAF2"]}
      start={{ x: 0, y: 0.04 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradientBackground}
    >
      <SafeAreaView style={styles.container}>
        {/* Top header with circular logo */}
        <View style={styles.blueHeader}>
          <View style={styles.logoWrapper}>
            <Image
              source={require("../../assets/logo.png")}
              style={styles.logo}
            />
          </View>
        </View>

        {/* Signup form container */}
        <View style={styles.formContainer}>
          <Text style={styles.title}>Create Account</Text>

          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#666"
            value={fullName}
            onChangeText={setFullName}
          />

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

          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#666"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          {/* Signup Button */}
          <TouchableOpacity
            style={styles.button}
            onPress={handleSignup}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Creating..." : "Sign Up"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>Already have an account?</Text>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate("Login" as any)}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default SignupScreen;

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },

  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },

  blueHeader: {
    width: "100%",
    height: height * 0.18,
    justifyContent: "flex-end",
    alignItems: "center",
    borderBottomLeftRadius: scale(60),
    borderBottomRightRadius: scale(60),
    overflow: "hidden",
  },

  logoWrapper: {
    backgroundColor: "#FFFFFF",
    borderRadius: scale(60),
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    position: "relative",
    marginTop: verticalScale(-40),
  },

  logo: {
    width: scale(230),
    height: verticalScale(180),
    resizeMode: "contain",
    marginHorizontal: scale(20),
    bottom: verticalScale(-30),
  },

  formContainer: {
    position: "absolute",
    bottom: verticalScale(20),
    backgroundColor: "#fff",
    width: "95%",
    height: height * 0.78,
    borderRadius: scale(30),
    alignItems: "center",
    paddingHorizontal: scale(30),
    paddingTop: verticalScale(100),
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },

  title: {
    fontSize: moderateScale(26),
    fontWeight: "700",
    color: "#007BFF",
    marginBottom: verticalScale(25),
  },

  input: {
    width: "100%",
    height: verticalScale(50),
    borderWidth: 1.5,
    borderColor: "#007BFF",
    borderRadius: scale(12),
    paddingHorizontal: scale(15),
    marginBottom: verticalScale(14),
    fontSize: moderateScale(16),
  },

  button: {
    width: "50%",
    backgroundColor: "#0A9EFA",
    borderRadius: scale(15),
    paddingVertical: verticalScale(10),
    alignItems: "center",
    marginTop: verticalScale(10),
    borderWidth: 2,
    borderColor: "#0367A6",
  },

  buttonText: {
    color: "#fff",
    fontSize: moderateScale(16),
    fontWeight: "700",
  },

  footerText: {
    marginTop: verticalScale(50),
    color: "#444",
    fontSize: moderateScale(14),
  },

  loginButton: {
    width: "40%",
    backgroundColor: "#0A9EFA",
    borderRadius: scale(12),
    paddingVertical: verticalScale(5),
    alignItems: "center",
    marginTop: verticalScale(15),
    borderWidth: 2,
    borderColor: "#0367A6",
  },

  loginButtonText: {
    color: "#fff",
    fontSize: moderateScale(16),
    fontWeight: "700",
  },
});
