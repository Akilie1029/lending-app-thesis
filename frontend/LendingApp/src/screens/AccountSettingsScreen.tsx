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
  Image,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Icon from "react-native-vector-icons/Ionicons";
import { launchImageLibrary } from "react-native-image-picker";
import { API_BASE } from "../config";

export default function AccountSettingsScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);

  // Change password fields
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem("userToken");
    return { Authorization: `Bearer ${token}` };
  };

  const loadProfile = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const res = await axios.get(`${API_BASE}/auth/me`, { headers });
      const user = res.data;
      setFullName(user.full_name || "");
      setEmail(user.email || "");
      setProfilePhotoUrl(user.profile_photo_url || null);
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
      const headers = await getAuthHeaders();
      const res = await axios.put(
        `${API_BASE}/auth/update-profile`,
        { full_name: fullName },
        { headers }
      );

      // Update local profilePhotoUrl if backend returned user
      if (res.data?.user?.profile_photo_url) {
        setProfilePhotoUrl(res.data.user.profile_photo_url);
      }

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
    if (pass1.length < 6) return Alert.alert("Error", "Password must be at least 6 characters.");

    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      await axios.put(
        `${API_BASE}/auth/change-password`,
        { new_password: pass1 },
        { headers }
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

  // ------------------- PROFILE PHOTO UPLOAD --------------------
  const pickProfilePhoto = async () => {
    try {
      const res = await launchImageLibrary({
        mediaType: "photo",
        quality: 0.8,
      });

      if (!res.didCancel && res.assets?.[0]) {
        const a = res.assets[0];
        await uploadProfilePhoto(a.uri!, a.fileName || `profile_${Date.now()}.jpg`, a.type || "image/jpeg");
      }
    } catch (err) {
      console.error("Pick photo error:", err);
      Alert.alert("Error", "Unable to pick photo.");
    }
  };

  const uploadProfilePhoto = async (uri: string, fileName: string, type: string) => {
    setUploading(true);
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) throw new Error("Not authenticated");

      const form = new FormData();
      // On Android the file uri is good. On iOS prefix 'file://'
      const normalizedUri = Platform.OS === "ios" && !uri.startsWith("file://") ? `file://${uri}` : uri;

      form.append("file", {
        uri: normalizedUri,
        name: fileName,
        type,
      } as any);

      const res = await fetch(`${API_BASE}/upload/profile-photo`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        body: form,
      });

      const json = await res.json();
      if (!res.ok) {
        console.error("Upload failed response:", json);
        throw new Error(json.error || "Upload failed");
      }

      // Server returns profile_photo_url in response
      const newUrl = json.profile_photo_url || (json.document && json.document.url) || null;
      if (newUrl) {
        setProfilePhotoUrl(newUrl);

        // Also update users table via update-profile to keep user API consistent (optional)
        try {
          const headers = await getAuthHeaders();
          await axios.put(`${API_BASE}/auth/update-profile`, { profile_photo_url: newUrl }, { headers });
        } catch (uErr) {
          console.warn("Failed to call update-profile after photo upload (non-fatal):", uErr);
        }

        Alert.alert("Success", "Profile photo updated.");
      } else {
        Alert.alert("Success", "Profile uploaded.");
      }
    } catch (err) {
      console.error("Profile upload error:", err);
      Alert.alert("Upload failed", err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
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

        <View style={{ alignItems: "center", marginBottom: 12 }}>
          <Image
            source={{
              uri: profilePhotoUrl || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
            }}
            style={styles.avatar}
          />

          <TouchableOpacity
            style={styles.uploadSmallBtn}
            onPress={pickProfilePhoto}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.uploadSmallText}>Change Photo</Text>
            )}
          </TouchableOpacity>
        </View>

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
    backgroundColor: "#fff",
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

  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: "#0367A6",
    marginBottom: 8,
  },

  uploadSmallBtn: {
    marginTop: 6,
    backgroundColor: "#0A9EFA",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  uploadSmallText: { color: "#fff", fontWeight: "700" },
});
