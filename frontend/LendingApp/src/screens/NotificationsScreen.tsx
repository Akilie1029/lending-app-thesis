// src/screens/NotificationsScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE } from "../config";

const NotificationsScreen = ({ navigation }: any) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) return;

      const res = await axios.get(`${API_BASE}/notifications/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications(res.data.notifications || []);
    } catch (err) {
      console.log("[NOTIFS] Fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      await axios.post(
        `${API_BASE}/notifications/${id}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.log("[NOTIFS] markAsRead error:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, []);

  const renderItem = ({ item }: any) => {
    return (
      <TouchableOpacity
        onPress={() => markAsRead(item.id)}
        style={[styles.card, !item.is_read && styles.unreadCard]}
      >
        <View style={styles.row}>
          <View style={styles.textContainer}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.date}>
              {new Date(item.created_at).toLocaleString()}
            </Text>
          </View>

          {!item.is_read && <View style={styles.dot} />}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#169AF9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      {/* LIST */}
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
};

export default NotificationsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fb" },

  header: {
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: "#169AF9",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
  },

  loading: { flex: 1, justifyContent: "center", alignItems: "center" },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: 15,
    marginTop: 10,
    padding: 15,
    borderRadius: 12,
    elevation: 2,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#169AF9",
  },
  row: { flexDirection: "row", justifyContent: "space-between" },

  textContainer: { flex: 1, paddingRight: 10 },

  title: { fontSize: 16, fontWeight: "bold", color: "#000" },
  message: { marginTop: 4, color: "#555" },
  date: { marginTop: 6, fontSize: 12, color: "#777" },

  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#169AF9",
    marginTop: 8,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: { fontSize: 16, color: "#666" },
});
