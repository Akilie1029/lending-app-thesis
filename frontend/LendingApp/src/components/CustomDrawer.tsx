import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_BASE = 'http://192.168.1.222:5001/api'; // ✅ same API base as HomeScreen

const CustomDrawer = (props: any) => {
  const [user, setUser] = useState<any>(null);

  // ✅ Fetch user info from /auth/me
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (!token) {
          console.log('⚠️ No token found — redirecting to Login');
          props.navigation.replace('Login');
          return;
        }

        const response = await axios.get(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setUser(response.data);
      } catch (error) {
        console.error('❌ Failed to load user info:', error);
      }
    };

    fetchUser();
  }, []);

  // ✅ Logout logic
  const handleLogout = () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('userToken');
              props.navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }], // ✅ Replace stack with Login
              });
            } catch (error) {
              console.error('Logout failed:', error);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#169AF9' }}>
      {/* ===== Header Section ===== */}
      <View style={styles.header}>
        <Image
          source={require('../../assets/logo.png')} // 🟦 Local KAURta logo
          style={styles.logo}
          resizeMode="contain"
        />
        <Image
          source={{
            uri:
              user?.avatar ||
              'https://cdn-icons-png.flaticon.com/512/149/149071.png',
          }}
          style={styles.avatar}
        />
        <Text style={styles.userName}>{user?.full_name || 'Loading...'}</Text>
        <Text style={styles.userEmail}>{user?.email || 'Please wait...'}</Text>
      </View>

      {/* ===== Drawer Menu ===== */}
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.drawerScroll}
      >
        <View style={styles.drawerItems}>
          {/* 🏠 Dashboard → Replace to Home */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              props.navigation.replace('Home');
            }}
          >
            <Icon name="view-dashboard-outline" size={40} color="#169AF9" />
            <Text style={styles.menuText}>Dashboard</Text>
          </TouchableOpacity>

          {/* 📝 Loan Application */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => props.navigation.navigate('Loan Application')}
          >
            <Icon name="file-plus-outline" size={40} color="#169AF9" />
            <Text style={styles.menuText}>Loan Application</Text>
          </TouchableOpacity>

          {/* 📄 My Loan */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => props.navigation.navigate('My Loan')}
          >
            <Icon name="file-document-outline" size={40} color="#169AF9" />
            <Text style={styles.menuText}>My Loan</Text>
          </TouchableOpacity>

          {/* 🧾 Payment History */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => props.navigation.navigate('Payment History')}
          >
            <Icon name="calendar-month-outline" size={40} color="#169AF9" />
            <Text style={styles.menuText}>Payment History</Text>
          </TouchableOpacity>

          {/* ⚙️ Account Settings */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => props.navigation.navigate('Account Settings')}
          >
            <Icon name="cog-outline" size={40} color="#169AF9" />
            <Text style={styles.menuText}>Account Settings</Text>
          </TouchableOpacity>
        </View>
      </DrawerContentScrollView>

      {/* ===== Bottom Section ===== */}
      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={styles.bottomItem}
          onPress={() => props.navigation.navigate('Help Support')}
        >
          <Icon name="help-circle-outline" size={22} color="#169AF9" />
          <Text style={styles.bottomText}>Help & Support</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomItem} onPress={handleLogout}>
          <Icon name="logout" size={22} color="#FF3B30" />
          <Text style={[styles.bottomText, { color: '#FF3B30' }]}>
            Logout
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default CustomDrawer;

// (Your same styles — untouched)
const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: '#169AF9',
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
    borderColor: '#0367A6',
    marginBottom: 10,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  userEmail: {
    fontSize: 13,
    color: '#f0f0f0',
  },
  drawerScroll: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    borderRadius: 20,
    paddingVertical: 5,
    elevation: 3,
    borderWidth: 3,
    borderColor: '#169AF9',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginLeft: 5,
  },
  menuText: {
    fontSize: 17,
    fontWeight: '500',
    marginLeft: 15,
    color: '#333',
  },
  bottomSection: {
    borderTopWidth: 2,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
    alignItems: 'center',
    borderRadius: 20,
    marginBottom: 15,
    marginHorizontal: 15,
    padding: 5,
  },
  bottomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  bottomText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#169AF9',
    marginLeft: 10,
  },
});
