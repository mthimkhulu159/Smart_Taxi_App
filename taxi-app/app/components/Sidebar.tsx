// src/components/Sidebar.tsx

import React, { useEffect, useRef, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView,
    SafeAreaView, Platform, ActivityIndicator // <-- ADDED ActivityIndicator import
} from 'react-native';
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
// Assuming RootStackParamList IS in ../types/navigation
import { RootStackParamList } from '../types/navigation'; // <-- REMOVED UserProfile import from here
import { fetchData, getToken } from '../api/api';
import { apiUrl } from '../api/apiUrl';

// --- Constants ---

// --- Define UserProfile locally (like in ProfileScreen.tsx) ---
// Consider moving this to a shared types file (e.g., ../types/user.ts or ../types/index.ts) later
interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string[];
  profilePic?: string;
}
// -----------------------------------------------------------

interface SidebarProps {
    isVisible: boolean;
    onClose: () => void;
    onNavigate: (screen: keyof RootStackParamList) => void;
    activeScreen: keyof RootStackParamList;
}

const Sidebar: React.FC<SidebarProps> = ({
    isVisible,
    onClose,
    onNavigate,
    activeScreen,
}) => {
    const slideAnim = useRef(new Animated.Value(-300)).current;
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isLoadingUser, setIsLoadingUser] = useState(true);

    // Effect to animate sidebar slide
    useEffect(() => {
        Animated.timing(slideAnim, {
            toValue: isVisible ? 0 : -300,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, [isVisible, slideAnim]);

    // Effect to fetch user data
    useEffect(() => {
        if (isVisible && !user) {
             const fetchSidebarUser = async () => {
                setIsLoadingUser(true);
                const token = await getToken();
                if (token) {
                    try {
                        const response = await fetchData(apiUrl, 'api/users/get-user', {
                            method: 'GET',
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        if (response?.user) {
                            setUser(response.user);
                        } else {
                           console.error('[Sidebar] User data not found in response.');
                           setUser(null);
                        }
                    } catch (error: any) {
                        console.error('[Sidebar] Error fetching user profile:', error.message);
                        setUser(null);
                    } finally {
                         setIsLoadingUser(false);
                    }
                } else {
                     console.error('[Sidebar] No token found, cannot fetch user.');
                     setIsLoadingUser(false);
                     setUser(null);
                }
            };
            fetchSidebarUser();
        } else if (!isVisible) {
            // Optional: Clear user data when sidebar closes
            // setUser(null);
            // setIsLoadingUser(true);
        }
    }, [isVisible, user]);


    const NavItem: React.FC<{ screen: keyof RootStackParamList; label: string; icon: React.ReactNode }> = ({ screen, label, icon }) => (
        <TouchableOpacity
            style={[styles.sidebarButton, activeScreen === screen && styles.sidebarButtonActive]}
            onPress={() => { onNavigate(screen); onClose(); }}>
            {icon}
            <Text style={[styles.sidebarButtonText, activeScreen === screen && styles.sidebarButtonTextActive]}>{label}</Text>
        </TouchableOpacity>
    );

    // Check role using the LOCAL user state, only if NOT loading
    const isDriver = !isLoadingUser && user?.role?.includes('driver');

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
                    
                    {/* <NavItem screen="LiveChat" label="Live Chat" icon={<Ionicons name="chatbubbles-outline" size={22} color="#FFFFFF" />} /> */}
                    <NavItem screen="Profile" label="Profile" icon={<FontAwesome name="user-circle-o" size={22} color="#FFFFFF" />} />

                    {/* Driver-Specific Navigation Items */}
                    {!isLoadingUser && isDriver && (
                        <>
                            <NavItem screen="AcceptedPassenger" label="View Passenger" icon={<FontAwesome name="user" size={22} color="#FFFFFF" />} />
                            <NavItem screen="ViewRequests" label="Search Rides" icon={<FontAwesome name="search" size={22} color="#FFFFFF" />} />
                            <NavItem screen="TaxiManagement" label="Manage Taxi" icon={<MaterialIcons name="settings" size={22} color="#FFFFFF" />} />
                        </>
                    )}
                     {/* Loading indicator */}
                     {isLoadingUser && isVisible && (
                         <View style={{padding: 20, alignItems: 'center'}}>
                             <ActivityIndicator color="#FFFFFF" />
                         </View>
                     )}
                </ScrollView>
            </SafeAreaView>
        </Animated.View>
    );
};

// Styles remain the same
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
        paddingTop: Platform.OS === 'ios' ? 20 : 0
    },
    sidebarCloseButton: {
        position: 'absolute',
        top: Platform.OS === 'android' ? 45 : 55,
        right: 15,
        zIndex: 1010,
        padding: 5
    },
    sidebarHeader: {
        alignItems: 'center',
        marginBottom: 30,
        paddingTop: 60
    },
    sidebarLogoIcon: {
        marginBottom: 10
    },
    sidebarTitle: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center'
    },
    sidebarButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginBottom: 8,
        marginHorizontal: 10
    },
    sidebarButtonActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)'
    },
    sidebarButtonText: {
        fontSize: 16,
        marginLeft: 15,
        color: '#E0EFFF',
        fontWeight: '600'
    },
    sidebarButtonTextActive: {
        color: '#FFFFFF',
        fontWeight: 'bold'
    }
});

export default Sidebar;