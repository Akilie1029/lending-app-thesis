// src/screens/AccountSettingsScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Icon from "react-native-vector-icons/Ionicons";
import { API_BASE } from "../config";

export default function AccountSettingsScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  // Change password fields
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) return;

      const res = await axios.get(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const user = res.data;
      setFullName(user.full_name || "");
      setEmail(user.email || "");
    } catch (err) {
      console.error("Settings load error:", err);
      Alert.alert("Error", "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  const saveChanges = async () => {
    if (!fullName) return Alert.alert("Error", "Name cannot be empty.");

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("userToken");

      await axios.put(
        `${API_BASE}/auth/update-profile`,
        { full_name: fullName },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert("Updated", "Your profile has been updated.");
    } catch (err) {
      console.error("Update profile error:", err);
      Alert.alert("Error", "Could not update profile.");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!pass1 || !pass2) return Alert.alert("Error", "Enter both password fields.");

    if (pass1 !== pass2) return Alert.alert("Error", "Passwords do not match.");

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("userToken");

      await axios.put(
        `${API_BASE}/auth/change-password`,
        { new_password: pass1 },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert("Success", "Password updated.");
      setPass1("");
      setPass2("");
    } catch (err) {
      console.error("Change password error:", err);
      Alert.alert("Error", "Failed to update password.");
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    Alert.alert("Confirm Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("userToken");
          navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#169AF9" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Settings</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profile</Text>

        <TextInput
          style={styles.input}
          placeholder="Full Name"
          value={fullName}
          onChangeText={setFullName}
        />

        <TextInput style={styles.input} value={email} editable={false} />

        <TouchableOpacity style={styles.saveBtn} onPress={saveChanges} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Changes</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Change Password</Text>

        <TextInput
          style={styles.input}
          placeholder="New Password"
          secureTextEntry
          value={pass1}
          onChangeText={setPass1}
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          secureTextEntry
          value={pass2}
          onChangeText={setPass2}
        />

        <TouchableOpacity style={styles.saveBtn} onPress={changePassword} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Update Password</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f6f7fb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    backgroundColor: "#169AF9",
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontWeight: "700", fontSize: 18 },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 3,
  },
  cardTitle: { fontWeight: "800", marginBottom: 10, fontSize: 15 },

  input: {
    borderWidth: 1,
    borderColor: "#cfeefc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },

  saveBtn: {
    backgroundColor: "#169AF9",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "700" },

  logoutBtn: {
    marginTop: 20,
    backgroundColor: "#ff3b30",
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  logoutText: { color: "#fff", fontWeight: "800" },
});
