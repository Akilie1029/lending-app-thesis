import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const CustomDrawer = (props: any) => {
  const user = {
    name: 'Keanna Mac',
    email: 'Samples@test.com',
    avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png', // Placeholder avatar
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#169AF9' }}>
      {/* ===== Header Section ===== */}
      <View style={styles.header}>
        <Image
          source={{ uri: 'https://i.imgur.com/WCkOQyX.png' }} // 🟦 Replace with your KAURta logo
          style={styles.logo}
          resizeMode="contain"
        />
        <Image source={{ uri: user.avatar }} style={styles.avatar} />
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
      </View>

      {/* ===== Drawer Menu ===== */}
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.drawerScroll}
      >
        <View style={styles.drawerItems}>
          <TouchableOpacity style={styles.menuItem} onPress={() => props.navigation.navigate('Home')}>
            <Icon name="view-dashboard-outline" size={22} color="#169AF9" />
            <Text style={styles.menuText}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => props.navigation.navigate('Loan Application')}>
            <Icon name="file-plus-outline" size={22} color="#169AF9" />
            <Text style={styles.menuText}>Loan Application</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Icon name="file-document-outline" size={22} color="#169AF9" />
            <Text style={styles.menuText}>My Loan</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Icon name="calendar-month-outline" size={22} color="#169AF9" />
            <Text style={styles.menuText}>Payment History</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Icon name="cog-outline" size={22} color="#169AF9" />
            <Text style={styles.menuText}>Account Settings</Text>
          </TouchableOpacity>
        </View>
      </DrawerContentScrollView>

      {/* ===== Bottom Section ===== */}
      <View style={styles.bottomSection}>
        <TouchableOpacity style={styles.bottomItem}>
          <Icon name="help-circle-outline" size={22} color="#169AF9" />
          <Text style={styles.bottomText}>Help & Support</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomItem}>
          <Icon name="logout" size={22} color="#169AF9" />
          <Text style={styles.bottomText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default CustomDrawer;

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: '#169AF9',
    paddingVertical: 30,
  },
  logo: {
    width: 100,
    height: 40,
    marginBottom: 15,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#fff',
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
    backgroundColor: '#f7f9fc',
  },
  drawerItems: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    borderRadius: 20,
    paddingVertical: 10,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 15,
    color: '#333',
  },
  bottomSection: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 25,
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
