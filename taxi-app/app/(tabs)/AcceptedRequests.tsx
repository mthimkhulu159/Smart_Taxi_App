import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView, // Keep ScrollView as likely only one request shown
  Alert,
  TouchableOpacity,
  ActivityIndicator, // Keep for inline button loading
  SafeAreaView,      // Added
  Platform,         // Added
  Animated,         // Added
  ViewStyle,        // Added
  TextStyle         // Added
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
// *** Import AsyncStorage ***
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken, fetchData } from '../api/api'; // Adjust path if necessary
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons'; // Added Icons
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack'; // Using generic Stack
import Sidebar from '../components/Sidebar'; // (ADJUST PATH if needed)
import { apiUrl } from '../api/apiUrl';
// --- Types and Interfaces ---
interface TaxiDetails {
  taxiId: string; // Use this ID for monitoring
  numberPlate: string;
  driverName: string;
  route?: string;
  currentStop: string;
  capacity?: number;
  currentLoad?: number;
  status: string;
  requestId: string;
}

// --- Navigation Types ---
type RootStackParamList = {
  Home: { acceptedTaxiId?: string }; // Keep param in type for clarity, but won't use to pass ID
  requestRide: undefined;
  ViewTaxi: undefined;
  ViewRequests: undefined;
  ViewRoute: undefined;
  LiveChat: { chatSessionId: string };
  TaxiManagement: undefined;
  Profile: undefined;
  AcceptedRequest: undefined; // Current screen
  AcceptedPassenger: undefined;
  Auth: undefined;
};

type AcceptedRequestScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AcceptedRequest'>;

interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
  onNavigate: (screen: keyof RootStackParamList) => void;
  activeScreen: keyof RootStackParamList;
}

// --- Constants ---

// *** Define AsyncStorage Key (Ensure it matches HomeScreen) ***
const ASYNC_STORAGE_MONITOR_KEY = 'monitoredTaxiId';


// --- Loading Component ---
const Loading: React.FC = () => {
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })).start(); }, [spinAnim]);
  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.loadingGradient}>
        <View style={styles.loadingContainerInternal}><Animated.View style={{ transform: [{ rotate: spin }] }}><Ionicons name="refresh" size={50} color="#003E7E" /></Animated.View><Text style={styles.loadingTextInternal}>Loading Ride Details...</Text></View>
    </LinearGradient>
  );
};

// --- Action Button Component ---
const ActionButton: React.FC<{ onPress: () => void; title: string; iconName?: any; iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome'; color?: string; textColor?: string; loading?: boolean; style?: object; disabled?: boolean }> =
    ({ onPress, title, iconName, iconFamily = 'Ionicons', color = '#003E7E', textColor = '#FFFFFF', loading = false, style = {}, disabled = false }) => {
    const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'FontAwesome' ? FontAwesome : Ionicons;
    const isDisabled = disabled || loading;
    return (
        <TouchableOpacity style={[ styles.actionButtonBase, { backgroundColor: color }, style, isDisabled && styles.actionButtonDisabled ]} onPress={onPress} disabled={isDisabled}>
        {loading ? <ActivityIndicator size="small" color={textColor} /> : ( <>
            {iconName && <IconComponent name={iconName} size={18} color={textColor} style={styles.actionButtonIcon} />}
            <Text style={[styles.actionButtonText, { color: textColor }]}>{title}</Text>
           </> )}
        </TouchableOpacity>
    );
};

// --- Info Row Component ---
const InfoRow: React.FC<{ label: string; value: string | number | undefined; iconName: any; iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome'; valueStyle?: TextStyle }> =
    ({ label, value, iconName, iconFamily = 'Ionicons', valueStyle = {} }) => {
    const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'FontAwesome' ? FontAwesome : Ionicons;
    return (
        <View style={styles.infoRow}>
            <IconComponent name={iconName} size={18} color="#555" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>{label}:</Text>
            <Text style={[styles.infoValue, valueStyle]}>{value ?? 'N/A'}</Text>
        </View>
    );
};


// --- Main AcceptedRequestsScreen Component ---
const AcceptedRequestsScreen = () => {
  const [taxiDetails, setTaxiDetails] = useState<TaxiDetails | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const navigation = useNavigation<AcceptedRequestScreenNavigationProp>();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Fetching Logic
  const fetchTaxiDetails = async (showAlerts = false) => {
    setLoading(true); setTaxiDetails(null);
    const token = await getToken();
    if (!token) { Alert.alert('Authentication Error', 'Please login.'); setLoading(false); return; }
    try {
      const response = await fetchData(apiUrl, 'api/rideRequest/acceptedTaxiDetails', { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
      if (response?.taxiDetails && Object.keys(response.taxiDetails).length > 0) { setTaxiDetails(response.taxiDetails); }
      else { setTaxiDetails(null); if (showAlerts) { Alert.alert('No Active Ride', 'You do not have an active accepted ride request.'); } }
    } catch (error: any) { console.error('Error fetching taxi details:', error); setTaxiDetails(null); if (showAlerts || !taxiDetails) { Alert.alert('Fetch Error', `Failed to fetch ride details: ${error.message}`); } }
    finally { setLoading(false); }
  };

  // Initial Fetch & Animation
  useEffect(() => { fetchTaxiDetails(); }, []);
  useEffect(() => { if (!isLoading) { const t = setTimeout(() => { Animated.parallel([ Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }), Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }), ]).start(); }, 100); return () => clearTimeout(t); } }, [isLoading, fadeAnim, slideAnim]);


  // Chat Initiation Handler
  const handleChat = async () => {
    if (!taxiDetails) return;
    setIsChatLoading(true);
    const token = await getToken(); if (!token) { Alert.alert('Authentication Error', 'Please login.'); setIsChatLoading(false); return; }
    try {
      const response = await fetchData(apiUrl, 'api/chat/passenger-initiate', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: taxiDetails.requestId }), });
      if (response?.chatSessionId) { handleNavigate('LiveChat', { chatSessionId: response.chatSessionId }); }
      else { throw new Error(response?.message || 'Failed to initiate chat session.'); }
    } catch (error: any) { console.error('Error initiating chat:', error); Alert.alert('Chat Error', error.message || 'Could not start chat session.'); }
    finally { setIsChatLoading(false); }
  };

  // Cancel Ride Handler (Placeholder)
  const handleCancelRide = (requestId: string) => { Alert.alert( 'Confirm Cancellation', 'Are you sure you want to cancel this ride request?', [ { text: 'Keep Ride', style: 'cancel' }, { text: 'Cancel Ride', style: 'destructive', onPress: async () => { Alert.alert('Not Implemented', 'Ride cancellation is not yet available for passengers.'); /* Add backend call here */ } } ] ); };

   // Helper to style status text
   const getStatusStyle = (status: string): TextStyle => { switch (status?.toLowerCase()) { case 'accepted': return { color: 'green', fontWeight: 'bold' }; case 'pending': return { color: 'orange', fontWeight: 'bold' }; case 'picked_up': return { color: '#0052A2', fontWeight: 'bold' }; case 'dropped_off': return { color: '#555', fontWeight: 'bold' }; case 'cancelled': return { color: 'red', fontWeight: 'bold' }; default: return { color: '#333' }; } };

  // Navigation Handler
  const handleNavigate = (screen: keyof RootStackParamList, params?: any) => {
     setSidebarVisible(false);
     // Use the switch statement for type safety
      switch (screen) {
        case 'Home': navigation.navigate({ name: 'Home', params: params, merge: true }); break; // Pass params if needed by Home (though not for monitoring ID anymore)
        case 'requestRide': navigation.navigate({ name: 'requestRide', params: params, merge: true }); break;
        case 'ViewTaxi': navigation.navigate({ name: 'ViewTaxi', params: params, merge: true }); break;
        case 'ViewRoute': navigation.navigate({ name: 'ViewRoute', params: params, merge: true }); break;
        case 'ViewRequests': navigation.navigate({ name: 'ViewRequests', params: params, merge: true }); break;
        case 'LiveChat': if (params?.chatSessionId) { navigation.navigate('LiveChat', { chatSessionId: params.chatSessionId }); } else { console.warn("Missing chatSessionId for LiveChat navigation."); } break;
        case 'TaxiManagement': navigation.navigate({ name: 'TaxiManagement', params: params, merge: true }); break;
        case 'Profile': navigation.navigate({ name: 'Profile', params: params, merge: true }); break;
        case 'AcceptedRequest': break; // Already here
        case 'AcceptedPassenger': navigation.navigate({ name: 'AcceptedPassenger', params: params, merge: true }); break;
        case 'Auth': navigation.navigate({ name: 'Auth', params: params, merge: true }); break;
        default: console.warn(`Attempted to navigate to unhandled screen: ${screen}`); break;
     }
   };

   // *** Handler for Monitor Button ***
   const handleMonitor = async () => {
       if (!taxiDetails?.taxiId) {
           Alert.alert("Error", "Cannot monitor taxi, ID is missing.");
           return;
       }
       try {
           console.log(`Saving taxiId ${taxiDetails.taxiId} to AsyncStorage and navigating Home...`);
           await AsyncStorage.setItem(ASYNC_STORAGE_MONITOR_KEY, taxiDetails.taxiId);
           // Navigate to Home without params, HomeScreen will read from AsyncStorage
           handleNavigate('Home');
       } catch (e) {
           console.error("Failed to save monitoredTaxiId to AsyncStorage", e);
           Alert.alert("Error", "Could not start monitoring. Please try again.");
       }
   };

  const toggleSidebar = () => { setSidebarVisible(!sidebarVisible); };

  // --- Render Logic ---
  return (
    <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
         <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="AcceptedRequest" />
        <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}><Ionicons name="menu" size={32} color="#003E7E" /></TouchableOpacity>
                <Text style={styles.headerTitle}>My Ride Details</Text>
                 <TouchableOpacity style={styles.headerButton} onPress={() => fetchTaxiDetails(true)} disabled={isLoading}>
                    {isLoading ? <ActivityIndicator size="small" color="#003E7E" /> : <Ionicons name="refresh" size={28} color="#003E7E" />}
                 </TouchableOpacity>
            </View>
             {isLoading ? <Loading /> : taxiDetails ? (
                 <ScrollView contentContainerStyle={styles.scrollContent}>
                     <View style={styles.detailsCard}>
                         <View style={styles.detailsCardHeader}>
                             <MaterialIcons name="local-taxi" size={24} color="#003E7E" />
                             <Text style={styles.detailsCardTitle}>{taxiDetails.numberPlate}</Text>
                              <Text style={[styles.detailsStatus, getStatusStyle(taxiDetails.status)]}>{taxiDetails.status}</Text>
                         </View>
                         <View style={styles.detailsCardBody}>
                             <InfoRow label="Driver" value={taxiDetails.driverName} iconName="person-outline" />
                             <InfoRow label="Location" value={taxiDetails.currentStop} iconName="location-outline" />
                              {taxiDetails.route && <InfoRow label="Route" value={taxiDetails.route} iconName="map-outline"/>}
                              {taxiDetails.currentLoad !== undefined && <InfoRow label="Load" value={taxiDetails.capacity !== undefined ? `${taxiDetails.currentLoad} / ${taxiDetails.capacity}` : taxiDetails.currentLoad} iconName="people-outline"/>}
                             {/* <InfoRow label="Request ID" value={taxiDetails.requestId} iconName="document-text-outline"/> */}
                         </View>
                         <View style={styles.detailsCardFooter}>
                              <ActionButton title="Cancel Ride" onPress={() => handleCancelRide(taxiDetails.requestId)} iconName="close-circle-outline" style={styles.actionButtonSmall} color="#dc3545" disabled={isChatLoading} />
                              <ActionButton title="Chat with Driver" onPress={handleChat} iconName="chatbubble-ellipses-outline" style={styles.actionButtonSmall} color="#007bff" loading={isChatLoading} disabled={isChatLoading} />
                              {/* *** Updated Monitor Button *** */}
                              <ActionButton title="Monitor Live" onPress={handleMonitor} iconName="eye-outline" style={styles.actionButtonSmall} color="#17a2b8" disabled={isChatLoading} />
                         </View>
                     </View>
                 </ScrollView>
             ) : (
                 <View style={styles.emptyContainer}>
                    <Ionicons name="car-outline" size={60} color="#888" />
                    <Text style={styles.emptyText}>You don't have an active ride request.</Text>
                    <Text style={styles.emptySubText}>Your accepted ride details will appear here.</Text>
                    <ActionButton title="Request a Ride" onPress={() => handleNavigate('requestRide')} style={{marginTop: 20}}/>
                 </View>
             )}
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  mainContainer: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 15 : 10, paddingBottom: 10, width: '100%' },
  headerButton: { padding: 8, minWidth: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#000000' },
   scrollContent: { padding: 20, flexGrow: 1, justifyContent: 'center', },
  detailsCard: { backgroundColor: '#FFFFFF', borderRadius: 12, elevation: 4, shadowColor: '#000000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 5, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden', },
  detailsCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E8F0FE', paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#D0D8E8', },
  detailsCardTitle: { fontSize: 18, fontWeight: 'bold', color: '#003E7E', marginLeft: 10, flex: 1, },
   detailsStatus: { fontSize: 14, fontWeight: 'bold', marginLeft: 10, textAlign: 'right', },
  detailsCardBody: { paddingHorizontal: 15, paddingTop: 5, paddingBottom: 15, },
   detailsCardFooter: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: '#EEEEEE', marginTop: 10, },
   actionButtonSmall: { paddingVertical: 10, paddingHorizontal: 10, marginHorizontal: 4, flexShrink: 1, minWidth: 100, },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  infoIcon: { marginRight: 10, width: 20, textAlign: 'center' },
  infoLabel: { fontSize: 15, color: '#555', fontWeight: '500', width: 95 },
  infoValue: { fontSize: 15, color: '#000', fontWeight: '600', flex: 1 },
   emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, },
   emptyText: { fontSize: 18, fontWeight: '600', color: '#555', textAlign: 'center', marginTop: 15, },
   emptySubText: { fontSize: 14, color: '#777', textAlign: 'center', marginTop: 5, },
    actionButtonBase: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
    actionButtonIcon: { marginRight: 10 },
    actionButtonText: { fontSize: 16, fontWeight: '600', textAlign: 'center'},
    actionButtonDisabled: { backgroundColor: '#A0A0A0', elevation: 0, shadowOpacity: 0 },
    sidebarInternal: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 300, backgroundColor: '#003E7E', zIndex: 1000, elevation: Platform.OS === 'android' ? 10: 0, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.3, shadowRadius: 5, paddingTop: Platform.OS === 'ios' ? 20 : 0 },
    sidebarCloseButtonInternal: { position: 'absolute', top: Platform.OS === 'android' ? 45 : 55, right: 15, zIndex: 1010, padding: 5 },
    sidebarHeaderInternal: { alignItems: 'center', marginBottom: 30, paddingTop: 60 },
    sidebarLogoIconInternal: { marginBottom: 10 },
    sidebarTitleInternal: { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center' },
    sidebarButtonInternal: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 8, marginBottom: 8, marginHorizontal: 10 },
    sidebarButtonActiveInternal: { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
    sidebarButtonTextInternal: { fontSize: 16, marginLeft: 15, color: '#E0EFFF', fontWeight: '600' },
    sidebarButtonTextActiveInternal: { color: '#FFFFFF', fontWeight: 'bold' },
   loadingGradient: { flex: 1 },
   loadingContainerInternal: { flex: 1, justifyContent: 'center', alignItems: 'center' },
   loadingTextInternal: { marginTop: 15, fontSize: 16, color: '#003E7E', fontWeight: '500' },
});

export default AcceptedRequestsScreen;