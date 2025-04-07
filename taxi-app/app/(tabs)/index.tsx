import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  Dimensions,
  ScrollView,
  Platform,
  SafeAreaView,
  ViewStyle,
  TextStyle,
  ActivityIndicator // Keep for loading indicators
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
// *** Import AsyncStorage ***
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken, fetchData } from '../api/api'; // Adjust path as needed
import { useNavigation, useFocusEffect } from '@react-navigation/native'; // Added useFocusEffect
import { StackNavigationProp } from '@react-navigation/stack';
import io from 'socket.io-client'; // Keep socket logic if used elsewhere

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const apiUrl = "https://qmarshal.onrender.com"
const ASYNC_STORAGE_MONITOR_KEY = 'monitoredTaxiId'; // Key for AsyncStorage

// --- Navigation Types ---
type RootStackParamList = {
  Home: { acceptedTaxiId?: string }; // Keep param for potential legacy triggers? Or remove.
  requestRide: undefined; ViewTaxi: undefined; ViewRequests: undefined;
  ViewRoute: undefined; LiveChat: { chatSessionId: string }; TaxiManagement: undefined;
  Profile: undefined; AcceptedRequest: undefined; AcceptedPassenger: undefined;
  Auth: undefined;
};

// type HomeScreenRouteProp = RouteProp<RootStackParamList, 'Home'>; // Not using route params anymore
type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

// --- Interfaces ---
interface TaxiInfo {
  _id: string; numberPlate: string; status: string; currentStop: string;
  currentLoad: number; routeName: string; nextStop: string; maxLoad: number;
}
interface SidebarProps { isVisible: boolean; onClose: () => void; onNavigate: (screen: keyof RootStackParamList) => void; activeScreen: keyof RootStackParamList; }
interface QuickActionProps { icon: string; iconFamily?: 'FontAwesome' | 'MaterialIcons' | 'Ionicons'; label: string; onPress: () => void; }


// --- Reusable Components (Keep as they are) ---

// --- Enhanced Sidebar Component ---
const Sidebar: React.FC<SidebarProps> = ({ isVisible, onClose, onNavigate, activeScreen }) => {
    const slideAnim = useRef(new Animated.Value(-300)).current;
    useEffect(() => { Animated.timing(slideAnim, { toValue: isVisible ? 0 : -300, duration: 300, useNativeDriver: true, }).start(); }, [isVisible, slideAnim]);
    const NavItem: React.FC<{ screen: keyof RootStackParamList; label: string; icon: React.ReactNode }> = ({ screen, label, icon }) => ( <TouchableOpacity style={[styles.sidebarButton, activeScreen === screen && styles.sidebarButtonActive]} onPress={() => { onNavigate(screen); onClose(); }}> {icon}<Text style={[styles.sidebarButtonText, activeScreen === screen && styles.sidebarButtonTextActive]}>{label}</Text> </TouchableOpacity> );
    return ( <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}> <SafeAreaView style={{ flex: 1 }}> <TouchableOpacity style={styles.sidebarCloseButton} onPress={onClose}><Ionicons name="close" size={30} color="#FFFFFF" /></TouchableOpacity> <View style={styles.sidebarHeader}><Ionicons name="car-sport-outline" size={40} color="#FFFFFF" style={styles.sidebarLogoIcon} /><Text style={styles.sidebarTitle}>Shesha</Text></View> <ScrollView showsVerticalScrollIndicator={false}> <NavItem screen="Home" label="Home" icon={<FontAwesome name="home" size={22} color="#FFFFFF" />} /> <NavItem screen="requestRide" label="Request Ride" icon={<FontAwesome name="car" size={22} color="#FFFFFF" />} /> <NavItem screen="ViewTaxi" label="View Taxis" icon={<MaterialIcons name="local-taxi" size={22} color="#FFFFFF" />} /> <NavItem screen="ViewRoute" label="View Routes" icon={<MaterialIcons name="route" size={22} color="#FFFFFF" />} /> <NavItem screen="AcceptedRequest" label="My Ride" icon={<FontAwesome name="check-circle" size={22} color="#FFFFFF" />} /> <NavItem screen="AcceptedPassenger" label="View Passenger" icon={<FontAwesome name="circle" size={22} color="#FFFFFF" />} /> <NavItem screen="ViewRequests" label="Search Rides" icon={<FontAwesome name="search" size={22} color="#FFFFFF" />} /> <NavItem screen="LiveChat" label="Live Chat" icon={<Ionicons name="chatbubbles-outline" size={22} color="#FFFFFF" />} /> <NavItem screen="TaxiManagement" label="Manage Taxi" icon={<MaterialIcons name="settings" size={22} color="#FFFFFF" />} /> <NavItem screen="Profile" label="Profile" icon={<FontAwesome name="user-circle-o" size={22} color="#FFFFFF" />} /> </ScrollView> </SafeAreaView> </Animated.View> );
};
// --- Quick Action Button Component ---
const QuickActionButton: React.FC<QuickActionProps> = ({ icon, iconFamily = 'FontAwesome', label, onPress }) => { const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'Ionicons' ? Ionicons : FontAwesome; const iconName = icon as any; return ( <TouchableOpacity style={styles.quickActionButton} onPress={onPress}> <View style={styles.quickActionIconContainer}><IconComponent name={iconName} size={28} color="#FFFFFF" /></View> <Text style={styles.quickActionLabel}>{label}</Text> </TouchableOpacity> ); };
// --- Enhanced Live Status Component ---
const LiveStatusCard: React.FC<{ monitoredTaxi: TaxiInfo | null; onEndMonitoring: () => void }> = ({ monitoredTaxi, onEndMonitoring }) => { const cardAnim = useRef(new Animated.Value(0)).current; const pulseAnim = useRef(new Animated.Value(1)).current; useEffect(() => { Animated.timing(cardAnim, { toValue: monitoredTaxi ? 1 : 0, duration: 400, useNativeDriver: false }).start(); }, [monitoredTaxi, cardAnim]); const animatedCardStyle = { height: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 260], extrapolate: 'clamp', }), opacity: cardAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1], extrapolate: 'clamp', }), marginBottom: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 25], extrapolate: 'clamp', }), }; useEffect(() => { if (monitoredTaxi) { Animated.loop(Animated.sequence([ Animated.timing(pulseAnim, { toValue: 1.03, duration: 800, useNativeDriver: true }), Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }), ])).start(); } else { pulseAnim.stopAnimation(); pulseAnim.setValue(1); } return () => pulseAnim.stopAnimation(); }, [monitoredTaxi, pulseAnim]); const getStatusStyle = (status: string): TextStyle => { switch (status?.toLowerCase()) { case 'available': return { color: '#4CAF50', fontWeight: 'bold' }; case 'full': case 'not available': return { color: '#F44336', fontWeight: 'bold' }; case 'almost full': case 'on trip': return { color: '#FF9800', fontWeight: 'bold' }; case 'waiting': case 'roaming': return { color: '#B3E5FC', fontWeight: 'bold' }; default: return { color: '#FFFFFF' }; } }; return ( <Animated.View style={[styles.liveStatusCardBase, animatedCardStyle, { transform: [{ scale: pulseAnim }] }]}> {monitoredTaxi && ( <LinearGradient colors={['#0052A2', '#003E7E']} style={styles.liveStatusGradient}> <View style={styles.statusHeader}><View style={styles.liveIndicator}><Text style={styles.liveText}>LIVE</Text></View><Text style={styles.statusTitle} numberOfLines={1}>Tracking: {monitoredTaxi.numberPlate}</Text><TouchableOpacity onPress={onEndMonitoring} style={styles.endMonitorButton}><Ionicons name="close-circle" size={26} color="#FFFFFF" /></TouchableOpacity></View> <View style={styles.taxiDetailsGrid}> <View style={styles.detailItem}><MaterialIcons name="directions-bus" size={20} color="#E0EFFF" /><Text style={styles.taxiTextLabel}>Route:</Text><Text style={styles.taxiTextValue} numberOfLines={1}>{monitoredTaxi.routeName || 'N/A'}</Text></View> <View style={styles.detailItem}><MaterialIcons name="pin-drop" size={20} color="#E0EFFF" /><Text style={styles.taxiTextLabel}>Next:</Text><Text style={styles.taxiTextValue} numberOfLines={1}>{monitoredTaxi.nextStop || 'N/A'}</Text></View> <View style={styles.detailItem}><Ionicons name="speedometer-outline" size={20} color="#E0EFFF" /><Text style={styles.taxiTextLabel}>Status:</Text><Text style={[styles.taxiTextValue, getStatusStyle(monitoredTaxi.status)]}>{monitoredTaxi.status || 'N/A'}</Text></View> <View style={styles.detailItem}><MaterialIcons name="groups" size={20} color="#E0EFFF" /><Text style={styles.taxiTextLabel}>Load:</Text><Text style={styles.taxiTextValue}>{monitoredTaxi.currentLoad ?? 'N/A'} / {monitoredTaxi.maxLoad ?? 'N/A'}</Text></View> </View> </LinearGradient> )} </Animated.View> ); };
// --- Loading Component ---
const Loading: React.FC = () => { const spinAnim = useRef(new Animated.Value(0)).current; useEffect(() => { Animated.loop( Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true, }) ).start(); }, [spinAnim]); const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'], }); return ( <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.loadingGradientWrapper}> <View style={styles.loadingContainer}><Animated.View style={{ transform: [{ rotate: spin }] }}><Ionicons name="refresh" size={50} color="#003E7E" /></Animated.View><Text style={styles.loadingText}>Loading Your Dashboard...</Text></View> </LinearGradient> ); };


// --- Main HomeScreen Component ---
const HomeScreen = () => {
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Combined loading state
  const [monitoredTaxi, setMonitoredTaxi] = useState<TaxiInfo | null>(null); // Local state for taxi data
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true); // Ref to track mounted state

  const navigation = useNavigation<HomeScreenNavigationProp>();
  // Socket connection can be kept if needed for other features
  // const socketRef = useRef<any>(null);
  // useEffect(() => { /* ... socket setup ... */ }, [apiUrl]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // --- Core Logic ---

  // Function for Initial/Polling Fetch of Monitored Taxi
  const fetchAndUpdateMonitoredTaxi = async (taxiId: string, isInitialFetch = false) => {
    if (!isMountedRef.current) return; // Prevent updates if unmounted

    console.log(`${isInitialFetch ? 'Initial Fetch' : 'Polling Update'} for taxi ID: ${taxiId}`);
    if (isInitialFetch) {
      setIsLoading(true); // Show loading only for the very first fetch attempt
    }

    const token = await getToken();
    if (!token) {
      if (isInitialFetch) Alert.alert('Authentication Error', 'Please log in.');
      else console.warn('Polling: No token, stopping.');
      await handleEndMonitoring(); // Stop monitoring if auth fails
      setIsLoading(false);
      return;
    }

    try {
      const endpoint = `api/taxis/${taxiId}/monitor`;
      const response = await fetchData(apiUrl, endpoint, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });

      if (!isMountedRef.current) return; // Check again after await

      if (response?.taxiInfo) {
        console.log(`Workspace Success for ${taxiId}:`, response.taxiInfo);
        // Use functional update to safely update state
        setMonitoredTaxi(prevState => {
          // Update only if ID still matches (important for polling)
          // Or if it's the initial fetch for this ID
          if (isInitialFetch || (prevState && prevState._id === taxiId)) {
             // Always include the _id we are tracking
            return { ...response.taxiInfo, _id: taxiId };
          }
          return prevState; // ID changed during fetch, ignore
        });
      } else {
        console.warn(`No taxiInfo received for ID ${taxiId}. Stopping monitoring.`);
        await handleEndMonitoring(); // Stop monitoring if taxi details disappear
      }
    } catch (error: any) {
      console.error(`Workspace/Polling Error for taxi ID ${taxiId}:`, error.message);
      if (error.status === 404 || error.status === 401 || error.status === 403) {
        console.warn(`Critical error (${error.status}). Stopping monitoring for ${taxiId}.`);
        if (isInitialFetch) Alert.alert('Error', 'Could not find or access taxi details.');
        await handleEndMonitoring(); // Stop on critical errors
      }
      // Don't stop polling on temporary network errors unless desired
    } finally {
      // Only set loading false after the initial fetch completes
      if (isInitialFetch && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Function to Stop Monitoring (clears state and storage)
  const handleEndMonitoring = async () => {
    console.log('User or system ended monitoring.');
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('Cleared polling interval.');
    }
    setMonitoredTaxi(null); // Clear local state
    try {
      await AsyncStorage.removeItem(ASYNC_STORAGE_MONITOR_KEY);
      console.log('Cleared monitoredTaxiId from AsyncStorage.');
    } catch (e) {
      console.error("Failed to clear monitoredTaxiId from AsyncStorage", e);
    }
    // Optionally clear navigation params if they were ever used
    // if (navigation.isFocused()) { // Check if screen is focused before setting params
    //   navigation.setParams({ acceptedTaxiId: undefined });
    // }
  };

   // Effect for Polling Interval Setup/Cleanup
   useEffect(() => {
     if (monitoredTaxi?._id) {
       const taxiId = monitoredTaxi._id;
       console.log(`Setting up polling interval for ${taxiId}`);
       // Clear previous interval just in case
       if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
       // Start new interval
       pollingIntervalRef.current = setInterval(() => {
         fetchAndUpdateMonitoredTaxi(taxiId, false); // false indicates it's a poll, not initial fetch
       }, 10000); // 10 seconds

       // Cleanup interval on unmount or when monitoredTaxi._id changes
       return () => {
         if (pollingIntervalRef.current) {
           console.log(`Clearing polling interval for ${taxiId} due to effect cleanup.`);
           clearInterval(pollingIntervalRef.current);
           pollingIntervalRef.current = null;
         }
       };
     } else {
       // Ensure interval is cleared if monitoredTaxi becomes null
       if (pollingIntervalRef.current) {
         console.log('Clearing polling interval because monitoredTaxi is null.');
         clearInterval(pollingIntervalRef.current);
         pollingIntervalRef.current = null;
       }
     }
   }, [monitoredTaxi?._id]); // Depend only on the ID presence


  // Effect for Initial Load (User Data + Check AsyncStorage) & Animation
  useEffect(() => {
    isMountedRef.current = true; // Track mount state
    setIsLoading(true); // Start loading

    let userDataFetched = false;
    let monitoringChecked = false;

    // Helper to potentially stop loading indicator
    const maybeStopLoading = () => {
        if (userDataFetched && monitoringChecked && isMountedRef.current) {
            setIsLoading(false);
            console.log("Initial loading complete.");
             // Start animation after initial loading logic is done
             const animationTimer = setTimeout(() => {
                if (isMountedRef.current) {
                    Animated.parallel([
                        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                        Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
                    ]).start();
                }
            }, 100);
             // Store timer to clear it - tricky if unmount happens before timer fires
             // It's generally okay to let it run if short
             // return () => clearTimeout(animationTimer); // Cannot return cleanup from here
        }
    };

    // 1. Fetch User Data
    const fetchUserData = async () => {
      console.log('Fetching user data...');
      const token = await getToken();
      if (token) { try { const r = await fetchData(apiUrl, 'api/users/get-user', { method: 'GET', headers: { Authorization: `Bearer ${token}` } }); if (isMountedRef.current) setUserName(r?.user?.name ?? null); } catch (e) { console.error("User fetch error:", e); if (isMountedRef.current) setUserName(null); } }
      else { if (isMountedRef.current) setUserName(null); }
      userDataFetched = true;
      maybeStopLoading();
    };

    // 2. Check Async Storage for Monitoring Status
    const checkMonitoringStatus = async () => {
        console.log("Checking AsyncStorage for monitored taxi...");
        try {
            const storedTaxiId = await AsyncStorage.getItem(ASYNC_STORAGE_MONITOR_KEY);
            console.log("Stored Taxi ID:", storedTaxiId);
            if (storedTaxiId && isMountedRef.current) {
                 // Found ID, initiate fetch (which handles its own loading part for the card)
                 // Don't await this, let loading finish based on flags
                 fetchAndUpdateMonitoredTaxi(storedTaxiId, true);
            } else {
                // No ID found, ensure local state is clear
                if (isMountedRef.current) setMonitoredTaxi(null);
            }
        } catch (e) {
            console.error("Failed to read monitoredTaxiId from AsyncStorage", e);
             if (isMountedRef.current) setMonitoredTaxi(null); // Clear state on error
        } finally {
            monitoringChecked = true;
             maybeStopLoading(); // Check if loading can stop
        }
    };

    // Run both async operations
    fetchUserData();
    checkMonitoringStatus();

    // Component Will Unmount cleanup
    return () => {
        console.log("HomeScreen unmounting...");
        isMountedRef.current = false; // Set unmounted flag
        // Interval cleanup is handled by the polling useEffect
    };
  }, []); // Run only once on mount


  // Navigation Handler
  const handleNavigate = (screen: keyof RootStackParamList) => {
    setSidebarVisible(false);
     switch (screen) {
        case 'Home': break; // Maybe refresh data or do nothing?
        case 'requestRide': navigation.navigate('requestRide'); break;
        case 'ViewTaxi': navigation.navigate('ViewTaxi'); break;
        case 'ViewRoute': navigation.navigate('ViewRoute'); break;
        case 'ViewRequests': navigation.navigate('ViewRequests'); break;
        case 'LiveChat': navigation.navigate('LiveChat', { chatSessionId: 'requires_id_or_logic' }); break;
        case 'TaxiManagement': navigation.navigate('TaxiManagement'); break;
        case 'Profile': navigation.navigate('Profile'); break;
        case 'AcceptedRequest': navigation.navigate('AcceptedRequest'); break;
        case 'AcceptedPassenger': navigation.navigate('AcceptedPassenger'); break;
        case 'Auth': navigation.navigate('Auth'); break;
        default: console.warn(`HomeScreen: Navigating to unhandled screen: ${screen}`); break;
     }
  };

  const toggleSidebar = () => { setSidebarVisible(!sidebarVisible); };

  // --- Render Logic ---
  if (isLoading) { return <Loading />; } // Show loading while checking user & storage

  return (
    <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="Home" />
        <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}><Ionicons name="menu" size={32} color="#003E7E" /></TouchableOpacity>
                <Text style={styles.headerTitle}>Dashboard</Text>
                <TouchableOpacity style={styles.headerButton} onPress={() => handleNavigate('Profile')}><FontAwesome name="user-circle-o" size={28} color="#003E7E" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" >
                <Text style={styles.greetingText}>{userName ? `Welcome back, ${userName}!` : 'Welcome to Shesha!'}</Text>
                <Text style={styles.subtitleText}>Ready for your next ride?</Text>

                {/* LiveStatusCard uses local monitoredTaxi state */}
                <LiveStatusCard monitoredTaxi={monitoredTaxi} onEndMonitoring={handleEndMonitoring} />

                {/* Quick Actions hidden if local monitoredTaxi state is set */}
                {!monitoredTaxi && (
                    <View style={styles.quickActionsContainer}>
                        <Text style={styles.sectionTitle}>Quick Actions</Text>
                        <View style={styles.quickActionsGrid}>
                            <QuickActionButton icon="car" label="Request Ride" onPress={() => handleNavigate('requestRide')} iconFamily='FontAwesome'/>
                            <QuickActionButton icon="taxi" label="View Taxis" onPress={() => handleNavigate('ViewTaxi')} iconFamily='FontAwesome'/>
                            <QuickActionButton icon="search" label="Find Ride" onPress={() => handleNavigate('ViewRequests')} iconFamily='FontAwesome'/>
                            <QuickActionButton icon="road" label="Check Available Routes" onPress={() => handleNavigate('ViewRoute')} iconFamily='FontAwesome'/>
                        </View>
                    </View>
                )}
            </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};

// --- Styles --- (Keep styles the same)
const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  loadingGradientWrapper: { flex: 1 }, // Wrapper for Loading component
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 15, fontSize: 16, color: '#003E7E', fontWeight: '500' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 15 : 10, paddingBottom: 10, width: '100%' },
  headerButton: { padding: 8 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#000000' },
  sidebar: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 300, backgroundColor: '#003E7E', zIndex: 1000, elevation: 10, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.3, shadowRadius: 5, paddingTop: Platform.OS === 'ios' ? 20 : 0 },
  sidebarCloseButton: { position: 'absolute', top: Platform.OS === 'android' ? 45 : 55, right: 15, zIndex: 1010, padding: 5 },
  sidebarHeader: { alignItems: 'center', marginBottom: 30, paddingTop: 60 },
  sidebarLogoIcon: { marginBottom: 10 },
  sidebarTitle: { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center' },
  sidebarButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 8, marginBottom: 8, marginHorizontal: 10 },
  sidebarButtonActive: { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
  sidebarButtonText: { fontSize: 16, marginLeft: 15, color: '#E0EFFF', fontWeight: '600' },
  sidebarButtonTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
  mainContainer: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 },
  greetingText: { fontSize: 28, fontWeight: 'bold', color: '#000000', marginBottom: 5 },
  subtitleText: { fontSize: 16, color: '#555555', marginBottom: 25 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#000000', marginBottom: 15, marginTop: 10 },
  liveStatusCardBase: { borderRadius: 15, borderWidth: 1, borderColor: 'rgba(0, 62, 126, 0.2)', elevation: 4, shadowColor: '#003E7E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 4, overflow: 'hidden' },
  liveStatusGradient: { flex: 1, padding: 18, borderRadius: 14 },
  statusHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  liveIndicator: { backgroundColor: '#FFFFFF', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, marginRight: 8 },
  liveText: { color: '#003E7E', fontWeight: 'bold', fontSize: 12 },
  statusTitle: { fontSize: 17, fontWeight: 'bold', color: '#FFFFFF', flex: 1, marginRight: 10 },
  endMonitorButton: { padding: 5 },
  taxiDetailsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  detailItem: { flexDirection: 'row', alignItems: 'center', width: '48%', marginBottom: 12 },
  taxiTextLabel: { fontSize: 14, color: '#E0EFFF', marginLeft: 6, marginRight: 4 },
  taxiTextValue: { fontSize: 14, color: '#FFFFFF', fontWeight: '600', flexShrink: 1 },
  quickActionsContainer: { marginTop: 5, marginBottom: 20 },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around' },
  quickActionButton: { alignItems: 'center', width: (windowWidth - 70) / 2, marginBottom: 20, paddingVertical: 15, paddingHorizontal: 10, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0', elevation: 3, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
  quickActionIconContainer: { backgroundColor: '#003E7E', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  quickActionLabel: { fontSize: 14, color: '#000000', fontWeight: '500', textAlign: 'center' },
  // Remove duplicate/empty style blocks if needed
  sidebarInternal: {}, sidebarCloseButtonInternal: {}, sidebarHeaderInternal: {}, sidebarLogoIconInternal: {}, sidebarTitleInternal: {}, sidebarButtonInternal: {}, sidebarButtonActiveInternal: {}, sidebarButtonTextInternal: {}, sidebarButtonTextActiveInternal: {}, loadingContainerInternal: {}, loadingTextInternal: {}, actionButtonBase: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 }, actionButtonIcon: { marginRight: 10 }, actionButtonText: { fontSize: 16, fontWeight: '600', textAlign: 'center' }, actionButtonDisabled: { backgroundColor: '#A0A0A0', elevation: 0, shadowOpacity: 0 },
});

// --- IMPORTANT ---
// Screens that START monitoring (e.g., ViewTaxi) must now be modified:
// 1. Import AsyncStorage: import AsyncStorage from '@react-native-async-storage/async-storage';
// 2. Update the 'Monitor' button's onPress handler:
//    onPress={async () => {
//      try {
//        await AsyncStorage.setItem('monitoredTaxiId', item._id); // Use YOUR storage key
//        navigation.navigate('Home'); // Navigate after saving
//      } catch (e) {
//        Alert.alert("Error", "Could not start monitoring.");
//      }
//    }}

export default HomeScreen;