import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView,
  SafeAreaView, Platform, ActivityIndicator
} from 'react-native';
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { jwtDecode, JwtPayload } from 'jwt-decode';
import { RootStackParamList } from '../types/navigation';
import { getToken } from '../api/api'; // Assuming getToken retrieves the JWT token from storage

// Define UserProfile locally (this can eventually be moved to a shared types file)
interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string[]; // Role is always an array of strings
  profilePic?: string;
}

// Define a custom type that extends JwtPayload to include the 'role' property
interface CustomJwtPayload extends JwtPayload {
  role?: string[]; // Add the role property as an array of strings
}


interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
  onNavigate: (screen: keyof RootStackParamList) => void;
  activeScreen: keyof RootStackParamList;
}

const Sidebar: React.FC<SidebarProps> = ({ isVisible, onClose, onNavigate, activeScreen }) => {
  const slideAnim = useRef(new Animated.Value(-300)).current;
  // We'll store the roles array directly if needed, but for driver check, we just need to know if 'driver' is present.
  // Let's use a state specifically for whether the user is a driver.
  const [isDriver, setIsDriver] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Sidebar animation effect
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isVisible ? 0 : -300,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isVisible]);

  // Decode JWT token and determine user role(s)
  useEffect(() => {
    const fetchRoleFromToken = async () => {
      setIsLoading(true);
      const token = await getToken(); // Get the JWT token from storage
      let userRoles: string[] = [];

      if (token) {
        try {
          // Use the named export jwtDecode and specify the custom payload type
          const decoded = jwtDecode<CustomJwtPayload>(token);
          if (decoded?.role && Array.isArray(decoded.role)) {
            userRoles = decoded.role;
          }
        } catch (error: unknown) {
          if (error instanceof Error) {
            console.error('[Sidebar] Error decoding token:', error.message);
          } else {
            console.error('[Sidebar] Unknown error:', error);
          }
          userRoles = []; // Set roles to empty array on error
        }
      }

      // Check if 'driver' is included in the roles array
      setIsDriver(userRoles.includes('driver'));
      setIsLoading(false);
    };

    if (isVisible) {
      fetchRoleFromToken(); // Decode the token only when the sidebar is visible
    } else {
      // Reset state when sidebar is hidden
      setIsDriver(false);
      setIsLoading(true);
    }
  }, [isVisible]);

  // Navigation item component
  const NavItem: React.FC<{ screen: keyof RootStackParamList; label: string; icon: React.ReactNode }> = ({ screen, label, icon }) => (
    <TouchableOpacity
      style={[styles.sidebarButton, activeScreen === screen && styles.sidebarButtonActive]}
      onPress={() => { onNavigate(screen); onClose(); }}>
      {icon}
      <Text style={[styles.sidebarButtonText, activeScreen === screen && styles.sidebarButtonTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity style={styles.sidebarCloseButton} onPress={onClose}>
          <Ionicons name="close" size={30} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.sidebarHeader}>
          <Ionicons name="car-sport-outline" size={40} color="#FFFFFF" style={styles.sidebarLogoIcon} />
          <Text style={styles.sidebarTitle}>Qmarshal</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Common Navigation Items */}
          <NavItem screen="Home" label="Home" icon={<FontAwesome name="home" size={22} color="#FFFFFF" />} />
          <NavItem screen="requestRide" label="Request Ride" icon={<FontAwesome name="car" size={22} color="#FFFFFF" />} />
          <NavItem screen="ViewTaxi" label="View Taxis" icon={<MaterialIcons name="local-taxi" size={22} color="#FFFFFF" />} />
          <NavItem screen="ViewRoute" label="View Routes" icon={<MaterialIcons name="route" size={22} color="#FFFFFF" />} />
          <NavItem screen="AcceptedRequest" label="My Ride" icon={<FontAwesome name="check-circle" size={22} color="#FFFFFF" />} />
          <NavItem screen="TaxiFareCalculator" label="Fare Calculator" icon={<FontAwesome name="calculator" size={22} color="#FFFFFF" />} />
          {/* Driver-Specific Navigation Items */}
          {!isLoading && isDriver && (
            <>
              <NavItem screen="AcceptedPassenger" label="View Passenger" icon={<FontAwesome name="user" size={22} color="#FFFFFF" />} />
              <NavItem screen="ViewRequests" label="Search Rides" icon={<FontAwesome name="search" size={22} color="#FFFFFF" />} />
              <NavItem screen="TaxiManagement" label="Manage Taxi" icon={<MaterialIcons name="settings" size={22} color="#FFFFFF" />} />
            </>
          )}
          <NavItem screen="Profile" label="Profile" icon={<FontAwesome name="user-circle-o" size={22} color="#FFFFFF" />} />
          {/* Loading indicator */}
          {isLoading && isVisible && (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
};

// Sidebar styles
const styles = StyleSheet.create({
  sidebar: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    width: 300,
    backgroundColor: '#003E7E',
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    paddingTop: Platform.OS === 'ios' ? 20 : 0,
  },
  sidebarCloseButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 45 : 55,
    right: 15,
    zIndex: 1010,
    padding: 5,
  },
  sidebarHeader: {
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: 60,
  },
  sidebarLogoIcon: {
    marginBottom: 10,
  },
  sidebarTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  sidebarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 8,
    marginHorizontal: 10,
  },
  sidebarButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  sidebarButtonText: {
    fontSize: 16,
    marginLeft: 15,
    color: '#E0EFFF',
    fontWeight: '600',
  },
  sidebarButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});

export default Sidebar;