import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Animated,
  ViewStyle,
  TextStyle,
  ScrollView // Keep for Sidebar internal scroll
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
// *** FIX 1: Add import for API functions ***
import { getToken, fetchData } from '../api/api'; // Adjust path if necessary
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { apiUrl } from '../api/apiUrl';

// --- Types and Interfaces ---
interface PassengerDetails {
  requestId: string;
  passengerId: string;
  passengerName: string;
  passengerEmail?: string;
  passengerPhone: string;
  startingStop: string;
  destinationStop: string;
  status: string;
  route?: string;
}

// --- Navigation Types (Ensure consistent) ---
type RootStackParamList = {
  Home: { acceptedTaxiId?: string };
  requestRide: undefined;
  ViewTaxi: undefined;
  ViewRequests: undefined;
  ViewRoute: undefined;
  LiveChat: { chatSessionId: string };
  TaxiManagement: undefined;
  Profile: undefined;
  AcceptedRequest: undefined;
  AcceptedPassenger: undefined; // Current screen
  Auth: undefined;
  // Add other screens if necessary
};

type AcceptedPassengersScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AcceptedPassenger'>;

interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
  onNavigate: (screen: keyof RootStackParamList) => void;
  activeScreen: keyof RootStackParamList;
}

// --- Constants ---

// --- Reusable Components Defined Directly In This File ---

// --- Enhanced Sidebar Component (Copied from previous screens) ---
const Sidebar: React.FC<SidebarProps> = ({ isVisible, onClose, onNavigate, activeScreen }) => {
  const slideAnim = useRef(new Animated.Value(-300)).current;
  useEffect(() => { Animated.timing(slideAnim, { toValue: isVisible ? 0 : -300, duration: 300, useNativeDriver: true }).start(); }, [isVisible, slideAnim]);
  const NavItem: React.FC<{ screen: keyof RootStackParamList; label: string; icon: React.ReactNode }> = ({ screen, label, icon }) => (
    <TouchableOpacity style={[styles.sidebarButtonInternal, activeScreen === screen && styles.sidebarButtonActiveInternal]} onPress={() => { onNavigate(screen); onClose(); }}>
      {icon}<Text style={[styles.sidebarButtonTextInternal, activeScreen === screen && styles.sidebarButtonTextActiveInternal]}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <Animated.View style={[styles.sidebarInternal, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity style={styles.sidebarCloseButtonInternal} onPress={onClose}><Ionicons name="close" size={30} color="#FFFFFF" /></TouchableOpacity>
        <View style={styles.sidebarHeaderInternal}><Ionicons name="car-sport-outline" size={40} color="#FFFFFF" style={styles.sidebarLogoIconInternal} /><Text style={styles.sidebarTitleInternal}>Shesha</Text></View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <NavItem screen="Home" label="Home" icon={<FontAwesome name="home" size={22} color="#FFFFFF" />} />
          <NavItem screen="requestRide" label="Request Ride" icon={<FontAwesome name="car" size={22} color="#FFFFFF" />} />
          <NavItem screen="ViewTaxi" label="View Taxis" icon={<MaterialIcons name="local-taxi" size={22} color="#FFFFFF" />} />
          <NavItem screen="ViewRoute" label="View Routes" icon={<MaterialIcons name="route" size={22} color="#FFFFFF" />} />
          <NavItem screen="AcceptedRequest" label="My Ride" icon={<FontAwesome name="check-circle" size={22} color="#FFFFFF" />} />
          <NavItem screen="AcceptedPassenger" label="View Passenger" icon={<FontAwesome name="circle" size={22} color="#FFFFFF" />} />
          <NavItem screen="ViewRequests" label="Search Rides" icon={<FontAwesome name="search" size={22} color="#FFFFFF" />} />
          <NavItem screen="LiveChat" label="Live Chat" icon={<Ionicons name="chatbubbles-outline" size={22} color="#FFFFFF" />} />
          <NavItem screen="TaxiManagement" label="Manage Taxi" icon={<MaterialIcons name="settings" size={22} color="#FFFFFF" />} />
          <NavItem screen="Profile" label="Profile" icon={<FontAwesome name="user-circle-o" size={22} color="#FFFFFF" />} />
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
};

// --- Loading Component (Copied from previous screens) ---
const Loading: React.FC = () => {
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })).start(); }, [spinAnim]);
  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.loadingGradient}>
        <View style={styles.loadingContainerInternal}><Animated.View style={{ transform: [{ rotate: spin }] }}><Ionicons name="refresh" size={50} color="#003E7E" /></Animated.View><Text style={styles.loadingTextInternal}>Loading Passenger Details...</Text></View>
    </LinearGradient>
  );
};

// --- Action Button Component (Copied from previous screens) ---
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

// --- Info Row Component (Adapted from previous screens) ---
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


// --- Main AcceptedPassengersScreen Component ---
const AcceptedPassengersScreen = () => {
  const [passengerDetails, setPassengerDetails] = useState<PassengerDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitiatingChat, setIsInitiatingChat] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const navigation = useNavigation<AcceptedPassengersScreenNavigationProp>();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Fetching Logic
  const fetchPassengerDetails = async (showAlerts = false) => {
    setIsLoading(true);
    const token = await getToken(); // Using imported function
    if (!token) {
      Alert.alert('Authentication Error', 'Please login.');
      setIsLoading(false);
      return;
    }
    try {
      const response = await fetchData(apiUrl, 'api/rideRequest/acceptedPassengerDetails', { // Using imported function
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response?.passengerDetails) {
        setPassengerDetails(response.passengerDetails);
         if (showAlerts && response.passengerDetails.length === 0) {
             Alert.alert('No Passengers', 'You have no currently accepted passengers.');
         }
      } else {
          setPassengerDetails([]);
          if(showAlerts) Alert.alert('Info', 'No accepted passenger details found.');
      }
    } catch (error: any) {
      console.error('Error fetching passenger details:', error);
      setPassengerDetails([]);
      if(showAlerts || passengerDetails.length === 0){
           Alert.alert('Fetch Error', `Failed to fetch passenger details: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Initial Fetch & Animation
  useEffect(() => {
    fetchPassengerDetails();
  }, []);

  useEffect(() => {
      if (!isLoading) {
          const animationTimer = setTimeout(() => {
              Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
              ]).start();
          }, 100);
          return () => clearTimeout(animationTimer);
      }
  }, [isLoading, fadeAnim, slideAnim]);


  // Chat Initiation Handler
  const handleChat = async (requestId: string) => {
    setIsInitiatingChat(requestId);
    const token = await getToken(); // Using imported function
    if (!token) {
      Alert.alert('Authentication Error', 'Please login.');
      setIsInitiatingChat(null);
      return;
    }
    try {
      const response = await fetchData(apiUrl, 'api/chat/driver-initiate', { // Using imported function
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });
      if (response?.chatSessionId) {
        // Use the corrected handleNavigate which uses the switch internally
        handleNavigate('LiveChat', { chatSessionId: response.chatSessionId });
      } else {
        throw new Error(response?.message || 'Failed to initiate chat session.');
      }
    } catch (error: any) {
      console.error('Error initiating chat:', error);
      Alert.alert('Chat Error', error.message || 'Could not start chat session.');
    } finally {
      setIsInitiatingChat(null);
    }
  };

  // Cancel Ride Handler (Placeholder)
  const handleCancelRide = (requestId: string, passengerName: string) => {
      Alert.alert( 'Confirm Cancellation', `Are you sure you want to cancel the ride for ${passengerName}?`,
          [ { text: 'Keep Ride', style: 'cancel' },
            { text: 'Cancel Ride', style: 'destructive',
              onPress: async () => { Alert.alert('Not Implemented', 'Ride cancellation is not yet available.'); /* Add backend call here */ }
            }
          ]
      );
  };

   // Helper to style status text
   const getStatusStyle = (status: string): TextStyle => {
      switch (status?.toLowerCase()) {
          case 'accepted': return { color: 'green', fontWeight: 'bold' };
          case 'pending': return { color: 'orange', fontWeight: 'bold' };
          case 'picked_up': return { color: '#0052A2', fontWeight: 'bold' };
          case 'dropped_off': return { color: '#555', fontWeight: 'bold' };
          case 'cancelled': return { color: 'red', fontWeight: 'bold' };
          default: return { color: '#333' };
      }
   };

  // Render Passenger Card
  const renderPassenger = ({ item }: { item: PassengerDetails }) => (
     <View style={styles.passengerCard}>
         <View style={styles.passengerCardHeader}>
             <Ionicons name="person-circle-outline" size={24} color="#003E7E" />
            <Text style={styles.passengerCardTitle}>{item.passengerName}</Text>
             <Text style={[styles.passengerStatus, getStatusStyle(item.status)]}>{item.status}</Text>
        </View>
         <View style={styles.passengerCardBody}>
            <InfoRow label="Phone" value={item.passengerPhone} iconName="call-outline" />
             <InfoRow label="From" value={item.startingStop} iconName="navigate-circle-outline"/>
            <InfoRow label="To" value={item.destinationStop} iconName="flag-outline"/>
             {item.route && <InfoRow label="Route" value={item.route} iconName="map-outline"/>}
            <InfoRow label="Request ID" value={item.requestId} iconName="document-text-outline"/>
        </View>
        <View style={styles.passengerCardFooter}>
             <ActionButton
                title="Cancel Ride"
                 onPress={() => handleCancelRide(item.requestId, item.passengerName)}
                 iconName="close-circle-outline"
                 style={styles.actionButtonSmall}
                 color="#dc3545"
                 disabled={isInitiatingChat !== null}
             />
             <ActionButton
                title="Chat" // Shortened title
                onPress={() => handleChat(item.requestId)}
                iconName="chatbubble-ellipses-outline"
                style={styles.actionButtonSmall}
                color="#007bff"
                loading={isInitiatingChat === item.requestId}
                disabled={isInitiatingChat !== null && isInitiatingChat !== item.requestId}
            />
         </View>
     </View>
  );

  // *** FIX 2: Use type-safe navigation handler ***
  const handleNavigate = (screen: keyof RootStackParamList, params?: any) => {
     setSidebarVisible(false);
     // Use the switch statement for type safety and correct param handling
      switch (screen) {
        case 'Home': navigation.navigate({ name: 'Home', params: params ?? { acceptedTaxiId: undefined }, merge: true }); break;
        case 'requestRide': navigation.navigate({ name: 'requestRide', params: params, merge: true }); break;
        case 'ViewTaxi': navigation.navigate({ name: 'ViewTaxi', params: params, merge: true }); break;
        case 'ViewRoute': navigation.navigate({ name: 'ViewRoute', params: params, merge: true }); break;
        case 'ViewRequests': navigation.navigate({ name: 'ViewRequests', params: params, merge: true }); break;
        case 'LiveChat':
             // Ensure params contains chatSessionId before navigating
             if (params?.chatSessionId) {
                navigation.navigate('LiveChat', { chatSessionId: params.chatSessionId });
             } else { console.warn("Missing chatSessionId for LiveChat navigation."); }
             break;
        case 'TaxiManagement': navigation.navigate({ name: 'TaxiManagement', params: params, merge: true }); break;
        case 'Profile': navigation.navigate({ name: 'Profile', params: params, merge: true }); break;
        case 'AcceptedRequest': navigation.navigate({ name: 'AcceptedRequest', params: params, merge: true }); break;
        case 'AcceptedPassenger': break; // Already here
        case 'Auth': navigation.navigate({ name: 'Auth', params: params, merge: true }); break;
        default: console.warn(`Attempted to navigate to unhandled screen: ${screen}`); break;
     }
   };

  const toggleSidebar = () => { setSidebarVisible(!sidebarVisible); };

  // --- Render Logic ---
  return (
    <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
         <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="AcceptedPassenger" />
        <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}><Ionicons name="menu" size={32} color="#003E7E" /></TouchableOpacity>
                <Text style={styles.headerTitle}>Accepted Passenger</Text>
                 <TouchableOpacity style={styles.headerButton} onPress={() => fetchPassengerDetails(true)} disabled={isLoading && passengerDetails.length === 0}>
                    {/* Show indicator only on initial load or manual refresh */}
                    {isLoading && passengerDetails.length === 0 ? <ActivityIndicator size="small" color="#003E7E" /> : <Ionicons name="refresh" size={28} color="#003E7E" />}
                 </TouchableOpacity>
            </View>
             {isLoading && passengerDetails.length === 0 ? <Loading /> : (
                <FlatList
                    data={passengerDetails} keyExtractor={(item) => item.requestId} renderItem={renderPassenger}
                    contentContainerStyle={styles.listContentContainer}
                    ListEmptyComponent={
                        <View style={styles.emptyListContainer}>
                            <Ionicons name="person-remove-outline" size={50} color="#888" />
                            <Text style={styles.emptyListText}>No accepted passengers found.</Text>
                            <Text style={styles.emptyListSubText}>Accept requests from the 'Nearby Requests' screen.</Text>
                            <ActionButton title="Find Requests" onPress={() => handleNavigate('ViewRequests')} style={{marginTop: 20}}/>
                        </View>
                    }
                     onRefresh={() => fetchPassengerDetails(true)}
                     refreshing={isLoading && passengerDetails.length > 0}
                />
             )}
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};

// --- Styles --- (Copied and adjusted styles)
const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  mainContainer: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 15 : 10, paddingBottom: 10, width: '100%' },
  headerButton: { padding: 8, minWidth: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#000000' },
  listContentContainer: { paddingHorizontal: 15, paddingVertical: 10, flexGrow: 1 },
  passengerCard: { backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 15, elevation: 3, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1, borderColor: '#E0E0E0', overflow: 'hidden', },
  passengerCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E8F0FE', paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#D0D8E8', },
  passengerCardTitle: { fontSize: 18, fontWeight: 'bold', color: '#003E7E', marginLeft: 10, flex: 1, },
   passengerStatus: { fontSize: 14, fontWeight: 'bold', marginLeft: 10, textAlign: 'right', },
  passengerCardBody: { paddingHorizontal: 15, paddingTop: 5, paddingBottom: 10, },
   passengerCardFooter: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, paddingHorizontal: 15, borderTopWidth: 1, borderTopColor: '#EEEEEE', marginTop: 5, },
    actionButtonSmall: { paddingVertical: 10, paddingHorizontal: 15, flex: 0.48, },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  infoIcon: { marginRight: 10, width: 20, textAlign: 'center' },
  infoLabel: { fontSize: 15, color: '#555', fontWeight: '500', width: 95 },
  infoValue: { fontSize: 15, color: '#000', fontWeight: '600', flex: 1 },
   emptyListContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, marginTop: 30 },
   emptyListText: { fontSize: 18, fontWeight: '600', color: '#555', textAlign: 'center', marginTop: 15 },
   emptyListSubText: { fontSize: 14, color: '#777', textAlign: 'center', marginTop: 5 },
    actionButtonBase: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
    actionButtonIcon: { marginRight: 10 },
    actionButtonText: { fontSize: 16, fontWeight: '600' },
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

export default AcceptedPassengersScreen;