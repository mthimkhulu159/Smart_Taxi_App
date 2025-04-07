import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator, // Still needed for inline ActionButton loading
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  ScrollView, // Keep for main layout
  SafeAreaView, // Added
  Platform,      // Added
  ViewStyle,     // Added
  TextStyle      // Added
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchData, getToken } from '../api/api'; // Assuming correct path
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons'; // Added Ionicons
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

// --- Types and Interfaces ---
interface RideRequest {
  _id: string;
  passenger: string; // Ideally, backend sends passenger name or object with name
  passengerName?: string; // Add if backend can provide it
  startingStop: string;
  destinationStop: string;
  requestType: 'ride' | 'pickup'; // Use specific types
  status: string; // e.g., 'pending', 'accepted'
}

// --- Navigation Types (Ensure consistent) ---
type RootStackParamList = {
  Home: { acceptedTaxiId?: string };
  requestRide: undefined;
  ViewTaxi: undefined;
  ViewRequests: undefined; // Current screen
  LiveChat: undefined;
  TaxiManagement: undefined;
  Profile: undefined;
  AcceptedRequest: undefined;
  AcceptedPassenger: undefined;
  ViewRoute: undefined;
  Auth: undefined;
  // Add other screens if necessary
};

type ViewRequestsNavigationProp = StackNavigationProp<RootStackParamList, 'ViewRequests'>;

interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
  onNavigate: (screen: keyof RootStackParamList) => void;
  activeScreen: keyof RootStackParamList;
}

// --- Constants ---
const apiUrl = "https://qmarshal.onrender.com"


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
        <View style={styles.loadingContainerInternal}><Animated.View style={{ transform: [{ rotate: spin }] }}><Ionicons name="refresh" size={50} color="#003E7E" /></Animated.View><Text style={styles.loadingTextInternal}>Loading...</Text></View>
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


// --- Main ViewRequestScreen Component ---
const ViewRequestScreen: React.FC = () => {
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true); // For initial fetch
  const [isAccepting, setIsAccepting] = useState<string | null>(null); // Store ID of request being accepted
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const navigation = useNavigation<ViewRequestsNavigationProp>();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Fetching Logic
  const fetchNearbyRequests = async (showAlerts = false) => {
    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) { throw new Error('Authentication token not found.'); }
      const data = await fetchData(apiUrl, 'api/rideRequest/driver/nearby', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests(data.rideRequests || []);
      if (showAlerts && (!data.rideRequests || data.rideRequests.length === 0)) {
        Alert.alert('No Requests', 'No new nearby requests found at this time.');
      }
    } catch (err: any) {
      console.error('Error fetching nearby requests:', err);
      // Show error only if manually refreshing or initial load fails hard
      if(showAlerts || requests.length === 0){ // Show alert on refresh fail or if list was already empty
         Alert.alert('Fetch Error', err.message || 'Failed to fetch nearby requests. Please try again.');
      }
      setRequests([]); // Clear requests on error
    } finally {
      setIsLoading(false);
    }
  };

  // Initial Fetch and Animation
  useEffect(() => {
    fetchNearbyRequests();
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


  // Accept Request Handler
  const handleAccept = async (requestId: string) => {
    setIsAccepting(requestId); // Show loading indicator on the specific button
    try {
      const token = await getToken();
      if (!token) { throw new Error('Authentication token not found.'); }

      await fetchData(apiUrl, `api/rideRequest/accept/${requestId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });

      Alert.alert('Success', 'Request accepted! You can view details under "Accepted Passenger".',
        [{ text: 'OK', onPress: () => navigation.navigate('AcceptedPassenger') }] // Navigate after success
      );
      // Remove the accepted request from the list
      setRequests((prev) => prev.filter((req) => req._id !== requestId));

    } catch (err: any) {
      console.error('Error accepting request:', err);
      Alert.alert('Error Accepting Request', err.message || 'Failed to accept the request. It might have been accepted by another driver or cancelled.');
      // Optional: Re-fetch list if accept fails to see if it was taken by someone else
      fetchNearbyRequests();
    } finally {
      setIsAccepting(null); // Hide loading indicator
    }
  };


  // Render Request Card Item
  const renderItem = ({ item }: { item: RideRequest }) => (
    <View style={styles.requestCard}>
        <View style={styles.requestCardHeader}>
             <Ionicons name={item.requestType === 'ride' ? "car-sport-outline" : "location-outline"} size={22} color="#003E7E" />
            <Text style={styles.requestCardTitle}>{item.requestType === 'ride' ? 'Ride Request' : 'Pickup Request'}</Text>
             <Text style={[styles.requestStatus, getStatusStyle(item.status)]}>{item.status}</Text>
        </View>
        <View style={styles.requestCardBody}>
            <View style={styles.requestInfoRow}>
                <Ionicons name="person-outline" size={18} color="#555" style={styles.requestInfoIcon}/>
                <Text style={styles.requestInfoLabel}>Passenger:</Text>
                {/* Display name if available, otherwise ID */}
                <Text style={styles.requestInfoValue}>{item.passengerName || item.passenger || 'N/A'}</Text>
            </View>
             <View style={styles.requestInfoRow}>
                <Ionicons name="navigate-circle-outline" size={18} color="#555" style={styles.requestInfoIcon}/>
                <Text style={styles.requestInfoLabel}>From:</Text>
                <Text style={styles.requestInfoValue}>{item.startingStop}</Text>
            </View>
             {item.requestType === 'ride' && item.destinationStop && ( // Only show destination for 'ride' type
                 <View style={styles.requestInfoRow}>
                    <Ionicons name="flag-outline" size={18} color="#555" style={styles.requestInfoIcon}/>
                    <Text style={styles.requestInfoLabel}>To:</Text>
                    <Text style={styles.requestInfoValue}>{item.destinationStop}</Text>
                </View>
             )}
        </View>
         <View style={styles.requestCardFooter}>
            <ActionButton
                title="Accept Request"
                onPress={() => handleAccept(item._id)}
                iconName="checkmark-circle-outline"
                style={styles.acceptButton}
                color="#28a745" // Green color for accept
                loading={isAccepting === item._id} // Show loading only for this button
                disabled={isAccepting !== null} // Disable all accept buttons while one is processing
            />
         </View>
    </View>
  );

 // Helper to style status text (can be reused/imported)
 const getStatusStyle = (status: string): TextStyle => {
    switch (status?.toLowerCase()) {
        case 'pending': return { color: 'orange', fontWeight: 'bold' };
        case 'accepted': return { color: 'green', fontWeight: 'bold' };
        case 'cancelled': return { color: 'red', fontWeight: 'bold' };
        default: return { color: '#555' };
    }
 };


  // Navigation Handler
   const handleNavigate = (screen: keyof RootStackParamList) => {
     setSidebarVisible(false);
     // Navigation logic using switch... (same as previous examples)
      switch (screen) {
        case 'Home': navigation.navigate({ name: 'Home', params: { acceptedTaxiId: undefined }, merge: true }); break;
        case 'requestRide': navigation.navigate({ name: 'requestRide', params: undefined, merge: true }); break;
        case 'ViewTaxi': navigation.navigate({ name: 'ViewTaxi', params: undefined, merge: true }); break;
        case 'ViewRoute': navigation.navigate({ name: 'ViewRoute', params: undefined, merge: true }); break;
        case 'ViewRequests': break; // Already here
        case 'LiveChat': navigation.navigate({ name: 'LiveChat', params: undefined, merge: true }); break;
        case 'TaxiManagement': navigation.navigate({ name: 'TaxiManagement', params: undefined, merge: true }); break;
        case 'Profile': navigation.navigate({ name: 'Profile', params: undefined, merge: true }); break;
        case 'AcceptedRequest': navigation.navigate({ name: 'AcceptedRequest', params: undefined, merge: true }); break;
        case 'AcceptedPassenger': navigation.navigate({ name: 'AcceptedPassenger', params: undefined, merge: true }); break;
        case 'Auth': navigation.navigate({ name: 'Auth', params: undefined, merge: true }); break;
        default: console.warn(`Attempted to navigate to unhandled screen: ${screen}`); break;
     }
   };

  const toggleSidebar = () => { setSidebarVisible(!sidebarVisible); };

  // --- Render Logic ---
  return (
    <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
         {/* Sidebar */}
         <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="ViewRequests" />

        <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
           {/* Header */}
           <View style={styles.header}>
                <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}><Ionicons name="menu" size={32} color="#003E7E" /></TouchableOpacity>
                <Text style={styles.headerTitle}>Nearby Requests</Text>
                {/* Right Header Button: Refresh */}
                 <TouchableOpacity style={styles.headerButton} onPress={() => fetchNearbyRequests(true)} disabled={isLoading}>
                    {isLoading ? <ActivityIndicator size="small" color="#003E7E" /> : <Ionicons name="refresh" size={28} color="#003E7E" />}
                 </TouchableOpacity>
           </View>

          {/* Main Content Area */}
          {isLoading && requests.length === 0 ? ( // Show loading only on initial load when list is empty
            <Loading />
          ) : (
            <FlatList
                data={requests}
                keyExtractor={(item) => item._id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContentContainer}
                ListEmptyComponent={ // Styled empty state
                    <View style={styles.emptyListContainer}>
                        <Ionicons name="search-circle-outline" size={50} color="#888" />
                        <Text style={styles.emptyListText}>No nearby requests found.</Text>
                        <Text style={styles.emptyListSubText}>Pull down to refresh or tap the refresh icon above.</Text>
                    </View>
                }
                // Optional: Add pull-to-refresh
                onRefresh={() => fetchNearbyRequests(true)}
                refreshing={isLoading && requests.length > 0} // Show refresh indicator only when refreshing existing list
            />
          )}
          {/* Removed separate Refresh button, added to header */}
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  // Common Styles (gradient, safeArea, mainContainer, header, etc.)
  gradient: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  mainContainer: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 15 : 10, paddingBottom: 10, width: '100%' },
  headerButton: { padding: 8, minWidth: 40, alignItems: 'center', justifyContent: 'center' }, // Centered icon
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#000000' },

  // List Styles
  listContentContainer: {
      paddingHorizontal: 15,
      paddingVertical: 10, // Add vertical padding
      flexGrow: 1, // Ensure empty component takes space
  },
  requestCard: { // Using sectionCard style as base
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      marginBottom: 15,
      elevation: 3,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      borderWidth: 1,
      borderColor: '#E0E0E0',
      overflow: 'hidden',
  },
  requestCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between', // Space out title and status
      backgroundColor: '#E8F0FE',
      paddingHorizontal: 15,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#D0D8E8',
  },
  requestCardTitle: {
      fontSize: 16, // Slightly smaller title
      fontWeight: 'bold',
      color: '#003E7E',
      marginLeft: 8, // Space after icon
      flex: 1, // Allow title to take space
  },
   requestStatus: {
        fontSize: 14,
        fontWeight: 'bold', // Handled by getStatusStyle
        marginLeft: 10, // Space before status
   },
  requestCardBody: {
      paddingHorizontal: 15,
      paddingVertical: 10,
  },
  requestInfoRow: { // Similar to taxiInfoRow
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 7, // Slightly more space
  },
  requestInfoIcon: {
      marginRight: 10,
      width: 20,
      textAlign: 'center',
  },
  requestInfoLabel: {
      fontSize: 15,
      color: '#555',
      fontWeight: '500',
      width: 90, // Adjusted width
  },
  requestInfoValue: {
      fontSize: 15,
      color: '#000',
      fontWeight: '600',
      flex: 1,
  },
   requestCardFooter: {
       paddingHorizontal: 15,
       paddingVertical: 10,
       paddingTop: 5, // Less top padding
       alignItems: 'center', // Center button
       borderTopWidth: 1,
       borderTopColor: '#EEEEEE',
       marginTop: 5,
   },
   acceptButton: {
       paddingVertical: 10, // Adjust button size
       paddingHorizontal: 20,
       width: '80%', // Make button wider
       maxWidth: 300,
   },

   // Empty List Styles (from TaxiManagement)
   emptyListContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
        marginTop: 30, // Adjusted margin
   },
   emptyListText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#555',
        textAlign: 'center',
        marginTop: 15,
   },
    emptyListSubText: {
        fontSize: 14,
        color: '#777',
        textAlign: 'center',
        marginTop: 5,
   },

    // Removed old error style, using Alert now
    // Removed old refreshButton styles

  // Action Button Styles (Copied from previous screens)
    actionButtonBase: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
    actionButtonIcon: { marginRight: 10 },
    actionButtonText: { fontSize: 16, fontWeight: '600' },
    actionButtonDisabled: { backgroundColor: '#A0A0A0', elevation: 0, shadowOpacity: 0 },

  // --- Sidebar Styles (Copied from previous screens) ---
    sidebarInternal: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 300, backgroundColor: '#003E7E', zIndex: 1000, elevation: Platform.OS === 'android' ? 10: 0, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.3, shadowRadius: 5, paddingTop: Platform.OS === 'ios' ? 20 : 0 },
    sidebarCloseButtonInternal: { position: 'absolute', top: Platform.OS === 'android' ? 45 : 55, right: 15, zIndex: 1010, padding: 5 },
    sidebarHeaderInternal: { alignItems: 'center', marginBottom: 30, paddingTop: 60 },
    sidebarLogoIconInternal: { marginBottom: 10 },
    sidebarTitleInternal: { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center' },
    sidebarButtonInternal: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 8, marginBottom: 8, marginHorizontal: 10 },
    sidebarButtonActiveInternal: { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
    sidebarButtonTextInternal: { fontSize: 16, marginLeft: 15, color: '#E0EFFF', fontWeight: '600' },
    sidebarButtonTextActiveInternal: { color: '#FFFFFF', fontWeight: 'bold' },

  // --- Loading Styles (Copied from previous screens) ---
   loadingGradient: { flex: 1 },
   loadingContainerInternal: { flex: 1, justifyContent: 'center', alignItems: 'center' },
   loadingTextInternal: { marginTop: 15, fontSize: 16, color: '#003E7E', fontWeight: '500' },

    // Removed old requestItem, requestText, acceptButton (old), acceptButtonText (old), emptyText styles
});

export default ViewRequestScreen;