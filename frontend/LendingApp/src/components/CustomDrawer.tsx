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

const API_BASE = 'http://192.168.1.222:5001/api';

const CustomDrawer = (props: any) => {
  const [user, setUser] = useState<any>(null);
  const [hasActiveLoan, setHasActiveLoan] = useState<boolean>(false);
  const [hasPendingLoan, setHasPendingLoan] = useState<boolean>(false);
  const [hasAnyLoan, setHasAnyLoan] = useState<boolean>(false);

  const loadDrawerData = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        props.navigation.replace('Login');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      // Fetch user
      const userRes = await axios.get(`${API_BASE}/auth/me`, { headers });
      setUser(userRes.data);

      // Fetch active loan
      const activeRes = await axios.get(`${API_BASE}/loans/my-active`, {
        headers,
      });
      const activeLoan = activeRes.data;

      setHasActiveLoan(!!activeLoan?.id && activeLoan.status === 'active');

      // Fetch latest loan (to detect pending)
      const latestRes = await axios.get(`${API_BASE}/loans/my-latest`, {
        headers,
      });
      const latestLoan = latestRes.data?.latestLoan;

      setHasPendingLoan(latestLoan?.status === 'pending');

      // Fetch all loans (to show My Loan button)
      const allRes = await axios.get(`${API_BASE}/loans/my-loans`, {
        headers,
      });
      setHasAnyLoan(allRes.data.length > 0);

    } catch (error) {
      console.error('❌ Failed to load drawer data:', error);
    }
  };

  useEffect(() => {
    loadDrawerData();

    // Refresh drawer whenever it is opened
    const unsubscribe = props.navigation.addListener('focus', () => {
      loadDrawerData();
    });

    return unsubscribe;
  }, []);

  // Logout
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
                routes: [{ name: 'Login' }],
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
      
      {/* HEADER */}
      <View style={styles.header}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} />

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

      {/* MENU */}
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.drawerScroll}
      >
        <View style={styles.drawerItems}>

          {/* Dashboard */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              props.navigation.navigate('Dashboard');
              props.navigation.closeDrawer();
            }}
          >
            <Icon name="view-dashboard-outline" size={40} color="#169AF9" />
            <Text style={styles.menuText}>Dashboard</Text>
          </TouchableOpacity>

          {/* Loan Application — HIDE if pending OR active */}
          {!hasActiveLoan && !hasPendingLoan && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                props.navigation.navigate('Loan Application');
                props.navigation.closeDrawer();
              }}
            >
              <Icon name="file-plus-outline" size={40} color="#169AF9" />
              <Text style={styles.menuText}>Loan Application</Text>
            </TouchableOpacity>
          )}

          {/* My Loan — show if ANY loan exists */}
          {hasAnyLoan && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => props.navigation.navigate('My Loan')}
            >
              <Icon name="file-document-outline" size={40} color="#169AF9" />
              <Text style={styles.menuText}>My Loan</Text>
            </TouchableOpacity>
          )}

          {/* Payment History */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => props.navigation.navigate('Payment History')}
          >
            <Icon name="calendar-month-outline" size={40} color="#169AF9" />
            <Text style={styles.menuText}>Payment History</Text>
          </TouchableOpacity>

          {/* Settings */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => props.navigation.navigate('Account Settings')}
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

/* styles unchanged */
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
  userName: { fontSize: 18, fontWeight: '700', color: '#fff' },
  userEmail: { fontSize: 13, color: '#f0f0f0' },
  drawerScroll: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    borderRadius: 20,
    paddingVertical: 5,
    elevation: 3,
    borderWidth: 3,
    borderColor: '#169AF9',
  },
  drawerItems: {},
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
