import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from "react-native";
import { DrawerContentComponentProps } from "@react-navigation/drawer";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function AdminDrawer(props: DrawerContentComponentProps) {
  const { navigation } = props;

  const logout = async () => {
    await AsyncStorage.removeItem("userToken");
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  return (
    <View style={{ flex: 1 }}>
      {/* ------------------------------------- */}
      {/* 🔵 TOP BLUE SECTION */}
      {/* ------------------------------------- */}
      <View style={styles.topSection}>
        <Image
          source={require("../../assets/logo.png")} // Change if needed
          style={styles.logo}
        />

        <View style={styles.profileWrapper}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={48} color="#1F87E5" />
          </View>

          <Text style={styles.adminName}>Admin Keanna</Text>
          <Text style={styles.adminEmail}>samples@admin.com</Text>
        </View>
      </View>

      {/* ------------------------------------- */}
      {/* ⚪ WHITE CARD MENU */}
      {/* ------------------------------------- */}
      <View style={styles.menuCard}>
        {/* Dashboard */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("AdminDashboardScreen")}
        >
          <MaterialCommunityIcons name="view-dashboard" size={22} color="#1F87E5" />
          <Text style={styles.menuText}>Dashboard</Text>
        </TouchableOpacity>

        {/* Loan Applications */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("AdminLoanApprovalScreen")}
        >
          <Ionicons name="document-text-outline" size={22} color="#1F87E5" />
          <Text style={styles.menuText}>Loan Applications</Text>
        </TouchableOpacity>

        {/* Disbursement */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("AdminDisbursementScreen")}
        >
          <MaterialCommunityIcons name="cash-fast" size={22} color="#1F87E5" />
          <Text style={styles.menuText}>Disbursement</Text>
        </TouchableOpacity>

        {/* Payment Overview */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("AdminCollectionsScreen")}
        >
          <MaterialCommunityIcons name="calendar-month" size={22} color="#1F87E5" />
          <Text style={styles.menuText}>Payment Overview</Text>
        </TouchableOpacity>

        {/* Settings */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("Settings")}
        >
          <Ionicons name="settings-outline" size={22} color="#1F87E5" />
          <Text style={styles.menuText}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* ------------------------------------- */}
      {/* 🚪 LOGOUT + HELP SECTION */}
      {/* ------------------------------------- */}
      <View style={styles.bottomSection}>
        <TouchableOpacity style={styles.bottomItem}>
          <Ionicons name="help-circle-outline" size={22} color="#1F87E5" />
          <Text style={styles.bottomText}>Help & Support</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomItem} onPress={logout}>
          <Ionicons name="log-out-outline" size={22} color="#d9534f" />
          <Text style={[styles.bottomText, { color: "#d9534f" }]}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topSection: {
    backgroundColor: "#1F87E5",
    paddingVertical: 30,
    alignItems: "center",
    borderBottomLeftRadius: 40,
  },

  logo: {
    width: 110,
    height: 45,
    resizeMode: "contain",
    marginBottom: 15,
  },

  profileWrapper: {
    alignItems: "center",
  },

  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },

  adminName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  adminEmail: {
    color: "#e0e0e0",
    fontSize: 13,
    marginTop: 2,
  },

  menuCard: {
    backgroundColor: "#fff",
    marginTop: -20,
    marginHorizontal: 20,
    paddingVertical: 20,
    paddingHorizontal: 10,
    borderRadius: 20,
    elevation: 3,
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },

  menuText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },

  bottomSection: {
    marginTop: "auto",
    marginBottom: 20,
    paddingHorizontal: 25,
  },

  bottomItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },

  bottomText: {
    marginLeft: 10,
    fontSize: 15,
    fontWeight: "500",
    color: "#1F87E5",
  },
});
