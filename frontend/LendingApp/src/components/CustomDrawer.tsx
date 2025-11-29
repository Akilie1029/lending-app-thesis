// src/navigation/CustomDrawer.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
} from "react-native";
import { DrawerContentScrollView } from "@react-navigation/drawer";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";

const CustomDrawer = (props: any) => {
  const [user, setUser] = useState<any>(null);
  const [hasActiveLoan, setHasActiveLoan] = useState(false);
  const [hasPendingLoan, setHasPendingLoan] = useState(false);
  const [hasAnyLoan, setHasAnyLoan] = useState(false);

  const loadDrawerData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        props.navigation.replace("Login");
        return;
      }

      // --- Fetch user ---
      const me = await api.get("/auth/me");
      setUser(me.data);

      // --- Active Loan ---
      const activeRes = await api.get("/loans/my-active");
      const activeLoan = activeRes.data;
      setHasActiveLoan(!!activeLoan?.id && activeLoan.status === "active");

      // --- Latest Loan for pending detection ---
      const latestRes = await api.get("/loans/my-latest");
      const latestLoan = latestRes.data?.latestLoan;
      setHasPendingLoan(latestLoan?.status === "pending");

      // --- All loans for "My Loan" menu ---
      const allLoans = await api.get("/loans/my-loans");
      setHasAnyLoan(allLoans.data.length > 0);
    } catch (err) {
      console.error("❌ Drawer load error:", err);
    }
  }, []);

  useEffect(() => {
    loadDrawerData();

    const unsubscribe = props.navigation.addListener("focus", () => {
      loadDrawerData();
    });

    return unsubscribe;
  }, []);

  const handleLogout = () => {
    Alert.alert("Confirm Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("userToken");
          props.navigation.reset({
            index: 0,
            routes: [{ name: "Login" }],
          });
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#169AF9" }}>
      {/* HEADER */}
      <View style={styles.header}>
        <Image
          source={require("../../assets/logo.png")}
          style={styles.logo}
        />

        <Image
          source={{
            uri:
              user?.avatar ||
              "https://cdn-icons-png.flaticon.com/512/149/149071.png",
          }}
          style={styles.avatar}
        />

        <Text style={styles.userName}>{user?.full_name || "Loading..."}</Text>
        <Text style={styles.userEmail}>{user?.email || ""}</Text>
      </View>

      {/* MENU */}
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.drawerScroll}
      >
        <View style={styles.drawerItems}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              props.navigation.navigate("Dashboard");
              props.navigation.closeDrawer();
            }}
          >
            <Icon name="view-dashboard-outline" size={40} color="#169AF9" />
            <Text style={styles.menuText}>Dashboard</Text>
          </TouchableOpacity>

          {/* Loan Application (hidden if active or pending) */}
          {!hasActiveLoan && !hasPendingLoan && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                props.navigation.navigate("Loan Application");
                props.navigation.closeDrawer();
              }}
            >
              <Icon name="file-plus-outline" size={40} color="#169AF9" />
              <Text style={styles.menuText}>Loan Application</Text>
            </TouchableOpacity>
          )}

          {/* My Loan */}
          {hasAnyLoan && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => props.navigation.navigate("My Loan")}
            >
              <Icon name="file-document-outline" size={40} color="#169AF9" />
              <Text style={styles.menuText}>My Loan</Text>
            </TouchableOpacity>
          )}

          {/* Payment History */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => props.navigation.navigate("Payment History")}
          >
            <Icon name="calendar-month-outline" size={40} color="#169AF9" />
            <Text style={styles.menuText}>Payment History</Text>
          </TouchableOpacity>

          {/* Settings */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => props.navigation.navigate("Account Settings")}
          >
            <Icon name="cog-outline" size={40} color="#169AF9" />
            <Text style={styles.menuText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </DrawerContentScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={styles.bottomItem}
          onPress={() => props.navigation.navigate("Help Support")}
        >
          <Icon name="help-circle-outline" size={22} color="#169AF9" />
          <Text style={styles.bottomText}>Help & Support</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomItem}
          onPress={handleLogout}
        >
          <Icon name="logout" size={22} color="#FF3B30" />
          <Text style={[styles.bottomText, { color: "#FF3B30" }]}>
            Logout
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default CustomDrawer;

/* --- Styles unchanged --- */
const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    backgroundColor: "#169AF9",
    padding: 20,
  },
  logo: {
    width: 110,
    height: 45,
    marginBottom: 15,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#0367A6",
    marginBottom: 10,
  },
  userName: { fontSize: 18, fontWeight: "700", color: "#fff" },
  userEmail: { fontSize: 13, color: "#f0f0f0" },
  drawerScroll: {
    backgroundColor: "#fff",
    marginHorizontal: 15,
    borderRadius: 20,
    paddingVertical: 5,
    elevation: 3,
    borderWidth: 3,
    borderColor: "#169AF9",
  },
  drawerItems: {},
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    marginLeft: 5,
  },
  menuText: { fontSize: 17, fontWeight: "500", marginLeft: 15, color: "#333" },
  bottomSection: {
    borderTopWidth: 2,
    borderTopColor: "#e0e0e0",
    backgroundColor: "#fff",
    alignItems: "center",
    borderRadius: 20,
    marginBottom: 15,
    marginHorizontal: 15,
    padding: 5,
  },
  bottomItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  bottomText: { fontSize: 15, fontWeight: "600", color: "#169AF9", marginLeft: 10 },
});
