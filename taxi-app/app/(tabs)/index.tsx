import React, { useState, useEffect, useRef, useCallback, FC } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Animated, Alert,
    Dimensions, ScrollView, Platform, SafeAreaView, ViewStyle,
    TextStyle, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Import jwt-decode and its payload type
import { jwtDecode, JwtPayload } from 'jwt-decode'; // ***** RBAC Change: Added import *****
import { getToken, fetchData } from '../api/api'; // fetchData might still be needed for other things like taxi data
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { apiUrl } from '../api/apiUrl';
import { Manager, Socket } from 'socket.io-client';

import { RootStackParamList } from '../types/navigation';
import Sidebar from '../components/Sidebar';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const ASYNC_STORAGE_MONITOR_KEY = 'monitoredTaxiId';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface TaxiInfo {
    _id: string; numberPlate: string; status: string; currentStop: string;
    currentLoad: number; capacity: number; routeName: string; nextStop: string;
    driverName?: string; updatedAt?: string; routeId?: string; driverId?: string;
    stops?: any[];
}

// ***** RBAC Change: Define UserProfile based on EXPECTED JWT PAYLOAD + potential extras *****
// This interface should now reflect what's available *directly* in the JWT payload
// plus any non-JWT fields that might be set later (though we are avoiding fetches for these now).
interface UserProfile {
    id: string;    // Typically 'sub' or 'id' claim in JWT for user ID
    name: string;  // Expected 'name' claim in JWT
    role: string[]; // Expected 'role' claim (array of strings) in JWT
    // These might NOT be in the JWT, make them optional or remove if never populated this way
    _id?: string;   // Often same as 'id', depends on API/JWT strategy
    email?: string;
    phone?: string;
    profilePic?: string;
}

// ***** RBAC Change: Define custom JWT Payload Type *****
// This tells jwtDecode what custom claims to expect (id, name, role)
interface CustomJwtPayload extends JwtPayload {
    id: string;    // Matches the expected claim name in YOUR JWT
    name: string;  // Matches the expected claim name in YOUR JWT
    role: string[]; // Matches the expected claim name in YOUR JWT
    // Add other claims if they exist and you need them, e.g., email
}
// ***** END RBAC Change *****


interface QuickActionProps {
    icon: string;
    iconFamily?: 'FontAwesome' | 'MaterialIcons' | 'Ionicons';
    label: string;
    onPress: () => void;
}

// --- Reusable Component Definitions (QuickActionButton, LiveStatusCard, Loading - unchanged) ---

const QuickActionButton: React.FC<QuickActionProps> = ({ icon, iconFamily = 'FontAwesome', label, onPress }) => {
    const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'Ionicons' ? Ionicons : FontAwesome;
    const iconName = icon as any;
    return (
        <TouchableOpacity style={styles.quickActionButton} onPress={onPress}>
            <View style={styles.quickActionIconContainer}>
                <IconComponent name={iconName} size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.quickActionLabel}>{label}</Text>
        </TouchableOpacity>
    );
};

const LiveStatusCard: React.FC<{ monitoredTaxi: TaxiInfo | null; onEndMonitoring: () => void }> = ({ monitoredTaxi, onEndMonitoring }) => {
    const cardAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => { Animated.timing(cardAnim, { toValue: monitoredTaxi ? 1 : 0, duration: 400, useNativeDriver: false }).start(); }, [monitoredTaxi, cardAnim]);
    const animatedCardStyle = { height: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 210], extrapolate: 'clamp' }), opacity: cardAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' }), marginBottom: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 25], extrapolate: 'clamp' }), };
    useEffect(() => { let animation: Animated.CompositeAnimation | null = null; if (monitoredTaxi) { animation = Animated.loop(Animated.sequence([ Animated.timing(pulseAnim, { toValue: 1.03, duration: 800, useNativeDriver: true }), Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }) ])); animation.start(); } else { pulseAnim.stopAnimation(); pulseAnim.setValue(1); } return () => { if (animation) { pulseAnim.stopAnimation(); pulseAnim.setValue(1); }}; }, [monitoredTaxi, pulseAnim]);
    const getStatusStyle = (status: string): TextStyle => { switch (status?.toLowerCase()) { case 'available': return { color: '#28a745', fontWeight: 'bold' }; case 'full': case 'not available': return { color: '#dc3545', fontWeight: 'bold' }; case 'almost full': case 'on trip': case 'roaming': return { color: '#ffc107', fontWeight: 'bold' }; case 'waiting': return { color: '#007bff', fontWeight: 'bold' }; default: return { color: '#FFFFFF' }; } };

    return (
        <Animated.View style={[styles.liveStatusCardBase, animatedCardStyle]}>
            <Animated.View style={monitoredTaxi ? { transform: [{ scale: pulseAnim }] } : {}}>
                {monitoredTaxi && (
                    <LinearGradient colors={['#0052A2', '#003E7E']} style={styles.liveStatusGradient}>
                        <View style={styles.statusHeader}>
                            <View style={styles.liveIndicator}><Text style={styles.liveText}>LIVE</Text></View>
                            <Text style={styles.statusTitle} numberOfLines={1}>Tracking: {monitoredTaxi.numberPlate}</Text>
                            <TouchableOpacity onPress={onEndMonitoring} style={styles.endMonitorButton}><Ionicons name="close-circle" size={26} color="#FFFFFF" /></TouchableOpacity>
                        </View>
                        <View style={styles.taxiDetailsGrid}>
                            <View style={styles.detailItem}><MaterialIcons name="directions-bus" size={20} color="#E0EFFF" /><Text style={styles.taxiTextLabel}>Route:</Text><Text style={styles.taxiTextValue} numberOfLines={1}>{monitoredTaxi.routeName || 'N/A'}</Text></View>
                            <View style={styles.detailItem}><Ionicons name="speedometer-outline" size={20} color="#E0EFFF" /><Text style={styles.taxiTextLabel}>Status:</Text><Text style={[styles.taxiTextValue, getStatusStyle(monitoredTaxi.status)]}>{monitoredTaxi.status || 'N/A'}</Text></View>
                            <View style={styles.detailItem}><MaterialIcons name="pin-drop" size={20} color="#E0EFFF" /><Text style={styles.taxiTextLabel}>At:</Text><Text style={styles.taxiTextValue} numberOfLines={1}>{monitoredTaxi.currentStop || 'N/A'}</Text></View>
                            <View style={styles.detailItem}><MaterialIcons name="groups" size={20} color="#E0EFFF" /><Text style={styles.taxiTextLabel}>Load:</Text><Text style={styles.taxiTextValue}>{monitoredTaxi.currentLoad ?? 'N/A'} / {monitoredTaxi.capacity ?? 'N/A'}</Text></View>
                            {(monitoredTaxi.nextStop && monitoredTaxi.nextStop !== "End of the route") && <View style={styles.detailItemFull}><MaterialIcons name="skip-next" size={20} color="#E0EFFF" /><Text style={styles.taxiTextLabel}>Next:</Text><Text style={styles.taxiTextValue} numberOfLines={1}>{monitoredTaxi.nextStop}</Text></View> }
                            {monitoredTaxi.driverName && <View style={styles.detailItemFull}><Ionicons name="person-circle-outline" size={20} color="#E0EFFF" /><Text style={styles.taxiTextLabel}>Driver:</Text><Text style={styles.taxiTextValue} numberOfLines={1}>{monitoredTaxi.driverName}</Text></View> }
                        </View>
                    </LinearGradient>
                )}
            </Animated.View>
        </Animated.View>
    );
};

const Loading: React.FC = () => {
    const spinAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => { Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })).start(); }, [spinAnim]);
    const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    return (
        <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.loadingGradientWrapper}>
            <View style={styles.loadingContainer}>
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Ionicons name="refresh" size={50} color="#003E7E" />
                </Animated.View>
                <Text style={styles.loadingText}>Loading Dashboard...</Text>
            </View>
        </LinearGradient>
    );
};

// --- Main HomeScreen Component ---
const HomeScreen = () => {
    // ***** RBAC Change: State for user profile derived from JWT *****
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    // Remove original userName and userId states as they are now within userProfile
    // const [userName, setUserName] = useState<string | null>(null);
    // const [userId, setUserId] = useState<string | null>(null);
    // ***** END RBAC Change *****
    const [isLoading, setIsLoading] = useState(true);
    const [monitoredTaxi, setMonitoredTaxi] = useState<TaxiInfo | null>(null);
    const [sidebarVisible, setSidebarVisible] = useState(false);
    const [isSocketConnected, setIsSocketConnected] = useState(false);

    const isMountedRef = useRef(true);
    const socketRef = useRef<Socket | null>(null);
    const currentMonitoredTaxiId = useRef<string | null>(null);

    const navigation = useNavigation<HomeScreenNavigationProp>();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    // ***** RBAC Change: Function to decode JWT and extract profile *****
    const decodeTokenToProfile = useCallback(async (): Promise<UserProfile | null> => {
        const token = await getToken();
        if (!token) {
            console.error('HS: Auth token not found for decoding.');
            // Potentially trigger logout or show specific error
            return null;
        }
        try {
            // Decode the token using the custom payload type
            const decoded = jwtDecode<CustomJwtPayload>(token);

            // --- IMPORTANT: Validate the expected claims ---
            if (decoded?.id && decoded.name && decoded.role && Array.isArray(decoded.role)) {
                // Construct the UserProfile object directly from the token payload
                const profile: UserProfile = {
                    id: decoded.id,         // Use 'id' from token
                    name: decoded.name,       // Use 'name' from token
                    role: decoded.role,       // Use 'role' from token
                    // _id can be set same as id if needed elsewhere, or omitted
                    _id: decoded.id,
                    // email, phone, profilePic likely NOT in token, initialize as undefined/empty
                    email: undefined,
                    phone: undefined,
                    profilePic: undefined
                };
                console.log('HS: Token decoded successfully:', profile);
                return profile;
            } else {
                // Log which fields are missing for easier debugging
                console.error('HS: Decoded token is missing required fields (id, name, or role). Decoded:', decoded);
                Alert.alert("Authentication Error", "Your session data is incomplete. Please log out and log back in.");
                // Potentially trigger logout
                return null;
            }
        } catch (error: unknown) { // Catch unknown type
             if (error instanceof Error) {
                 console.error('[HS] Error decoding token:', error.message);
             } else {
                 console.error('[HS] Unknown error during token decoding:', error);
             }
             Alert.alert("Authentication Error", "Could not read your session data. Please log out and log back in.");
             // Potentially trigger logout
             return null;
        }
    }, []); // No dependencies needed if getToken and jwtDecode are stable imports
    // ***** END RBAC Change *****

    // fetchInitialTaxiData and handleEndMonitoring remain the same as they deal with Taxi data, not user data
    const handleEndMonitoring = useCallback(async () => {
        console.log('HS: Ending monitoring...');
        const taxiIdToUnsubscribe = currentMonitoredTaxiId.current;
        if (socketRef.current?.connected && taxiIdToUnsubscribe) {
            console.log(`HS: Unsubscribing from ${taxiIdToUnsubscribe}`);
            socketRef.current.emit('passenger:unsubscribeFromTaxiUpdates', { taxiId: taxiIdToUnsubscribe });
        }
        if (isMountedRef.current) setMonitoredTaxi(null);
        currentMonitoredTaxiId.current = null;
        try { await AsyncStorage.removeItem(ASYNC_STORAGE_MONITOR_KEY); console.log('HS: Cleared AsyncStorage.'); }
        catch (e) { console.error("HS: Failed clear AsyncStorage", e); }
    }, []);

    const fetchInitialTaxiData = useCallback(async (taxiId: string): Promise<TaxiInfo | null> => {
        if (!isMountedRef.current) return null;
        console.log(`HS: Fetching initial data for taxi ${taxiId}`);
        const token = await getToken(); // Still need token for API calls
        if (!token) {
            console.log("HS: No token for initial taxi fetch.");
            await handleEndMonitoring();
            return null;
        }
        try {
            // Assuming fetchData handles adding the token header if needed
            const response = await fetchData(apiUrl, `api/taxis/${taxiId}/monitor`, { method: 'GET' });
            if (!isMountedRef.current) return null;
            if (response?.taxiInfo) {
                console.log(`HS: Initial fetch success for ${taxiId}`);
                const fetchedTaxiData = { ...response.taxiInfo, _id: taxiId };
                if (isMountedRef.current) setMonitoredTaxi(fetchedTaxiData);
                return fetchedTaxiData;
            } else {
                console.warn(`HS: No taxiInfo initially for ${taxiId}.`);
                await handleEndMonitoring();
                return null;
            }
        } catch (error: any) {
            console.error(`HS: Initial Taxi Fetch Error for ${taxiId}:`, error.message);
            if (error.status === 404 || error.status === 401 || error.status === 403) {
                 if (isMountedRef.current) Alert.alert('Error', `Could not track Taxi ${taxiId}. It might no longer be available or access is denied.`);
                 await handleEndMonitoring();
            } else if (isMountedRef.current) {
                 Alert.alert('Network Error', 'Could not fetch taxi details.');
            }
            return null;
        }
    }, [handleEndMonitoring]); // Keep dependency


    const setupSocket = useCallback(async (fetchedUserId: string) => {
        const token = await getToken(); // Token still needed for socket auth header
        if (!token) { Alert.alert('Connection Error', 'Authentication required to connect.'); return; }
        if (socketRef.current) { socketRef.current.disconnect(); }

        console.log('HS: Setting up socket connection...');
        try {
            const manager = new Manager(apiUrl, {
                reconnectionAttempts: 5,
                reconnectionDelay: 2000,
                transports: ['websocket'],
                // Send token for authentication via headers (common practice)
                extraHeaders: { Authorization: `Bearer ${token}` }
            });
            const newSocket = manager.socket('/');
            socketRef.current = newSocket;

            newSocket.on('connect', () => {
                console.log('HS: Socket connected:', newSocket.id);
                setIsSocketConnected(true);
                // Optional: Emit authentication event if your backend requires it AFTER connection
                // Make sure backend verifies the token sent in extraHeaders first
                // console.log(`HS: Authenticating socket for user ${fetchedUserId}`);
                // newSocket.emit('authenticate', { userId: fetchedUserId }); // Or just rely on header token

                // Re-subscribe if monitoring was active
                if (currentMonitoredTaxiId.current) {
                    console.log(`HS: Re-subscribing to ${currentMonitoredTaxiId.current} on connect.`);
                    newSocket.emit('passenger:subscribeToTaxiUpdates', { taxiId: currentMonitoredTaxiId.current });
                }
            });
            newSocket.on('disconnect', (reason) => { console.log('HS: Socket disconnected:', reason); setIsSocketConnected(false); });
            newSocket.on('connect_error', (error) => { console.error('HS: Socket connect error:', error.message); setIsSocketConnected(false); });
            newSocket.on('taxiUpdate', (taxiData: TaxiInfo) => { if (taxiData && taxiData._id === currentMonitoredTaxiId.current && isMountedRef.current) { console.log(`HS: Received taxi update for ${taxiData._id}`); setMonitoredTaxi(taxiData); } });
            newSocket.on('taxiError', (error) => { console.error('HS: Received taxiError:', error.message); if (isMountedRef.current) Alert.alert('Monitor Error', error.message); });
            // Handle potential authentication errors from socket server
             newSocket.on('unauthorized', (error) => {
                console.error('HS: Socket authentication failed:', error.message);
                setIsSocketConnected(false);
                if (isMountedRef.current) Alert.alert('Connection Error', 'Session invalid. Please log in again.');
                // Optional: trigger logout
             });

        } catch (error) { console.error("HS: Socket setup failed:", error); if (isMountedRef.current) Alert.alert('Error', 'Real-time connection failed.'); }
    }, []); // No dependency on userId needed if using token in header

    // --- Effect for Initial Load ---
    useEffect(() => {
        isMountedRef.current = true;
        setIsLoading(true);
        console.log("HS: Initial mount - Decoding token and checking state...");
        let isCancelled = false;

        const initialize = async () => {
            // ***** RBAC Change: Decode token to get user profile *****
            const profile = await decodeTokenToProfile();
            // ***** END RBAC Change *****

            if (isCancelled || !isMountedRef.current) return;

            if (profile?.id && profile.role) { // Crucial check: Do we have a valid profile from token?
                setUserProfile(profile); // Set the profile state

                // Now that we have the profile (including ID), proceed with other initializations
                console.log("HS: User profile obtained from token. Checking for monitored taxi...");
                let storedTaxiId: string | null = null;
                try {
                    storedTaxiId = await AsyncStorage.getItem(ASYNC_STORAGE_MONITOR_KEY);
                    console.log("HS: Stored Taxi ID from AsyncStorage:", storedTaxiId);
                    if (storedTaxiId && isMountedRef.current) {
                        currentMonitoredTaxiId.current = storedTaxiId;
                        // Fetch initial data ONLY if we found a stored ID
                        await fetchInitialTaxiData(storedTaxiId);
                    } else {
                        // No taxi being monitored
                        if (isMountedRef.current) setMonitoredTaxi(null);
                        currentMonitoredTaxiId.current = null;
                    }
                } catch (e) {
                    if (isMountedRef.current) setMonitoredTaxi(null);
                    currentMonitoredTaxiId.current = null;
                    console.error("HS: Failed to read monitored taxi ID from AsyncStorage", e);
                }

            } else {
                 // Failed to get profile from token (error already shown in decodeTokenToProfile)
                 console.error("HS: Initialization halted due to missing user profile from token.");
                 // No user ID, cannot proceed securely. Stay loading or show error state.
                 // Setting loading to false here will show an empty dashboard potentially, handle as needed.
                 // Maybe navigate to login? For now, just stop loading.
                 if (isMountedRef.current) setIsLoading(false);
                 return; // Stop initialization here
            }

            // Only finish loading and animate if initialization (including profile decoding) was successful
            if (isMountedRef.current && !isCancelled) {
                setIsLoading(false);
                console.log("HS: Initialization checks complete, animating in.");
                Animated.parallel([
                    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                    Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
                ]).start();
            }
        };

        initialize();

        return () => {
            isMountedRef.current = false;
            isCancelled = true;
            console.log("HS: Initial effect cleanup.");
        };
    // decodeTokenToProfile and fetchInitialTaxiData are wrapped in useCallback
    }, [decodeTokenToProfile, fetchInitialTaxiData]);

    // --- Effect to Setup Socket ---
     useEffect(() => {
         // Setup socket only if we have a valid user profile (meaning token was decoded successfully)
         const currentUserId = userProfile?.id;
         if (currentUserId) {
             console.log("HS: User profile available, setting up socket.");
             setupSocket(currentUserId); // Pass ID if needed for 'authenticate' event, otherwise header token might suffice
         } else {
            console.log("HS: No user profile ID, socket setup skipped.");
         }

         return () => {
             if (socketRef.current) {
                 console.log("HS: Cleaning up socket from userProfile effect");
                 socketRef.current.removeAllListeners(); // Important to remove all listeners
                 socketRef.current.disconnect();
                 socketRef.current = null;
                 setIsSocketConnected(false); // Reset connection status
             }
         };
     // Re-run this effect if the user profile changes (e.g., re-login) or setupSocket function reference changes
     }, [userProfile, setupSocket]); // Depend on the whole userProfile object


    // --- Navigation Handler ---
    const handleNavigate = (screen: keyof RootStackParamList) => {
        setSidebarVisible(false);
        navigation.navigate(screen as any);
    };

    const toggleSidebar = () => { setSidebarVisible(!sidebarVisible); };

    // --- Render Logic ---
    if (isLoading) { return <Loading />; }

    // ***** RBAC Change: Check if userProfile exists before rendering main content *****
    // If loading is false, but userProfile is still null, it means token decoding failed.
    // Show a message or potentially redirect to login.
    if (!userProfile) {
        return (
             <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
                <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
                     <Ionicons name="alert-circle-outline" size={50} color="#dc3545" />
                    <Text style={styles.errorText}>Could not load user session.</Text>
                    <Text style={styles.errorText}>Please try logging out and back in.</Text>
                    {/* Add a Logout button here if possible */}
                </SafeAreaView>
             </LinearGradient>
        );
    }
    // ***** END RBAC Change *****


    // --- Main Render when loaded and authenticated ---
    return (
        <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
            <SafeAreaView style={styles.safeArea}>
                {/* Sidebar now relies on its own JWT decoding for its content */}
                <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="Home" />

                <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}><Ionicons name="menu" size={32} color="#003E7E" /></TouchableOpacity>
                        <Text style={styles.headerTitle}>Dashboard</Text>
                        <TouchableOpacity style={styles.headerButton} onPress={() => handleNavigate('Profile')}><FontAwesome name="user-circle-o" size={28} color="#003E7E" /></TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" >
                        {/* ***** RBAC Change: Use userProfile.name directly ***** */}
                        <Text style={styles.greetingText}>{`Welcome back, ${userProfile.name}!`}</Text>
                        <Text style={styles.subtitleText}>Ready for your next ride?</Text>

                        <LiveStatusCard monitoredTaxi={monitoredTaxi} onEndMonitoring={handleEndMonitoring} />

                        {!monitoredTaxi && (
                            <View style={styles.quickActionsContainer}>
                                <Text style={styles.sectionTitle}>Quick Actions</Text>
                                <View style={styles.quickActionsGrid}>
                                    <QuickActionButton icon="car" label="Request Ride" onPress={() => handleNavigate('requestRide')} iconFamily='FontAwesome'/>
                                    <QuickActionButton icon="taxi" label="View Taxis" onPress={() => handleNavigate('ViewTaxi')} iconFamily='FontAwesome'/>

                                    {/* ***** RBAC Change: Conditional Action Button based on userProfile.role ***** */}
                                    {/* Check if userProfile and its role array exist and include 'driver' */}
                                    {userProfile?.role?.includes('driver') && (
                                        <QuickActionButton icon="briefcase" label="Taxi Management" onPress={() => handleNavigate('TaxiManagement')} iconFamily='FontAwesome'/>
                                    )}

                                    {/* Check if userProfile and its role array exist and DO NOT include 'driver' */}
                                    {/* This assumes non-drivers are passengers needing 'Accepted Requests' */}
                                    {!(userProfile?.role?.includes('driver')) && (
                                        <QuickActionButton icon="check-square-o" label="My Ride Requests" onPress={() => handleNavigate('AcceptedRequest')} iconFamily='FontAwesome'/>
                                    )}
                                    {/* ***** END RBAC Change ***** */}

                                    <QuickActionButton icon="road" label="Check Routes" onPress={() => handleNavigate('ViewRoute')} iconFamily='FontAwesome'/>
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </Animated.View>
            </SafeAreaView>
        </LinearGradient>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    // ... (Keep all existing styles: gradient, safeArea, loading, header, mainContainer, scrollContent, greeting, subtitle, liveStatusCard, quickActions, etc.)
    gradient: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    loadingGradientWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingContainer: { justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 15, fontSize: 16, color: '#003E7E', fontWeight: '500' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 15 : 10, paddingBottom: 10, width: '100%', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#DDD' },
    headerButton: { padding: 8, minWidth: 40, alignItems: 'center'},
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#003E7E' },
    mainContainer: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 },
    greetingText: { fontSize: 28, fontWeight: 'bold', color: '#000000', marginBottom: 5 },
    subtitleText: { fontSize: 16, color: '#555555', marginBottom: 25 },
    sectionTitle: { fontSize: 20, fontWeight: '600', color: '#000000', marginBottom: 15, marginTop: 10 },
    liveStatusCardBase: { borderRadius: 15, borderWidth: 1, borderColor: 'rgba(0, 62, 126, 0.2)', elevation: 4, shadowColor: '#003E7E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 4, overflow: 'hidden' },
    liveStatusGradient: { padding: 18 },
    statusHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
    liveIndicator: { backgroundColor: '#FFFFFF', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, marginRight: 8 },
    liveText: { color: '#003E7E', fontWeight: 'bold', fontSize: 12 },
    statusTitle: { fontSize: 17, fontWeight: 'bold', color: '#FFFFFF', flex: 1, marginRight: 10 },
    endMonitorButton: { padding: 5 },
    taxiDetailsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    detailItem: { flexDirection: 'row', alignItems: 'center', width: '48%', marginBottom: 12 },
    detailItemFull: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 12 },
    taxiTextLabel: { fontSize: 14, color: '#E0EFFF', marginLeft: 6, marginRight: 4 },
    taxiTextValue: { fontSize: 14, color: '#FFFFFF', fontWeight: '600', flexShrink: 1 },
    quickActionsContainer: { marginTop: 5, marginBottom: 20 },
    quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', alignItems: 'flex-start' },
    quickActionButton: {
        alignItems: 'center',
        width: (windowWidth - 80) / 2,
        marginBottom: 20,
        paddingVertical: 15,
        paddingHorizontal: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        elevation: 3,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3
    },
    quickActionIconContainer: {
        backgroundColor: '#003E7E',
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10
    },
    quickActionLabel: {
        fontSize: 14,
        color: '#000000',
        fontWeight: '500',
        textAlign: 'center'
    },
    // Error state style
    errorText: {
        fontSize: 16,
        color: '#555',
        textAlign: 'center',
        marginTop: 10,
    }
});

export default HomeScreen;