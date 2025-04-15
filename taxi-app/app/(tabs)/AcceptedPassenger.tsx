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
// API function imports (Using path from user's code)
import { getToken, fetchData } from '../api/api'; // Adjust path if necessary
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Sidebar from '../components/Sidebar'; // (ADJUST PATH if needed)
import { apiUrl } from '../api/apiUrl';

// --- Types and Interfaces (As provided by user) ---
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

// --- Navigation Types (As provided by user) ---
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

// --- Sidebar Props Interface (As provided by user) ---
interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
  onNavigate: (screen: keyof RootStackParamList) => void;
  activeScreen: keyof RootStackParamList;
}

// --- Loading Component (As provided by user) ---
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

// --- Action Button Component (As provided by user) ---
const ActionButton: React.FC<{ onPress: () => void; title: string; iconName?: any; iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome'; color?: string; textColor?: string; loading?: boolean; style?: object; disabled?: boolean }> =
    ({ onPress, title, iconName, iconFamily = 'Ionicons', color = '#003E7E', textColor = '#FFFFFF', loading = false, style = {}, disabled = false }) => {
    const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'FontAwesome' ? FontAwesome : Ionicons;
    const isDisabled = disabled || loading;
    // *** DEBUG: Log button disabled state ***
    // console.log(`Button '${title}' - Disabled: ${isDisabled}, Loading: ${loading}`);
    return (
        <TouchableOpacity
            style={[ styles.actionButtonBase, { backgroundColor: color }, style, isDisabled && styles.actionButtonDisabled ]}
            onPress={onPress} // Ensure onPress is correctly passed
            disabled={isDisabled}
            // *** DEBUG: Add activeOpacity for visual feedback on press ***
            activeOpacity={isDisabled ? 1.0 : 0.6}
        >
        {loading ? <ActivityIndicator size="small" color={textColor} /> : ( <>
            {iconName && <IconComponent name={iconName} size={18} color={textColor} style={styles.actionButtonIcon} />}
            <Text style={[styles.actionButtonText, { color: textColor }]}>{title}</Text>
            </> )}
        </TouchableOpacity>
    );
};

// --- Info Row Component (As provided by user) ---
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
  const [isCancelling, setIsCancelling] = useState<string | null>(null); // State for cancellation loading
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const navigation = useNavigation<AcceptedPassengersScreenNavigationProp>();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Fetching Logic (Using user's original endpoint)
  const fetchPassengerDetails = async (showAlerts = false) => {
     if (isInitiatingChat || isCancelling) {
         console.log("Fetch skipped: Action (chat/cancel) in progress.");
         return;
     }
    setIsLoading(true);
    const token = await getToken();
    if (!token) {
      Alert.alert('Authentication Error', 'Please login.');
      setIsLoading(false);
      return;
    }
    try {
      const response = await fetchData(apiUrl, 'api/rideRequest/acceptedPassengerDetails', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response?.passengerDetails) {
         if (Array.isArray(response.passengerDetails)) {
            setPassengerDetails(response.passengerDetails);
         } else {
            console.warn("Expected passengerDetails to be an array, received:", typeof response.passengerDetails);
            setPassengerDetails([]);
         }
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

  // Initial Fetch & Animation (As provided by user, added focus listener)
  useEffect(() => {
    fetchPassengerDetails();
    const unsubscribe = navigation.addListener('focus', () => {
        if (!isInitiatingChat && !isCancelling) {
            fetchPassengerDetails(false);
        }
    });
    return unsubscribe;
  }, [navigation]);

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


  // Chat Initiation Handler (Ensure finally block resets state)
  const handleChat = async (requestId: string) => {
    if (isInitiatingChat || isCancelling) {
        console.log(`handleChat skipped for ${requestId}. Current state: chat=${isInitiatingChat}, cancel=${isCancelling}`);
        return;
    }
    console.log(`Initiating chat for ${requestId}`);
    setIsInitiatingChat(requestId); // Set state BEFORE async call
    const token = await getToken();
    if (!token) {
      Alert.alert('Authentication Error', 'Please login.');
      setIsInitiatingChat(null); // Reset state if token fails early
      return;
    }
    try {
      const response = await fetchData(apiUrl, 'api/chat/driver-initiate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });
      if (response?.chatSessionId) {
        handleNavigate('LiveChat', { chatSessionId: response.chatSessionId });
      } else {
        throw new Error(response?.message || 'Failed to initiate chat session.');
      }
    } catch (error: any) {
      console.error('Error initiating chat:', error);
      Alert.alert('Chat Error', error.message || 'Could not start chat session.');
      // *** Ensure state is reset even on error ***
      // setIsInitiatingChat(null); // Moved to finally
    } finally {
      // *** CRITICAL: Ensure state is ALWAYS reset ***
      console.log(`Finished chat attempt for ${requestId}. Resetting isInitiatingChat.`);
      setIsInitiatingChat(null);
    }
  };

  // Cancel Ride Handler (Add detailed logging)
  const handleCancelRide = (requestId: string, passengerName: string) => {
     console.log(`[handleCancelRide] Attempting cancel for Request ID: ${requestId}`); // Log entry

     // Check if another action is already in progress
     if (isInitiatingChat || isCancelling) {
         console.log(`[handleCancelRide] Action skipped. Current state: chat=${isInitiatingChat}, cancel=${isCancelling}`);
         return; // Exit silently if already processing
     }
     console.log(`[handleCancelRide] No other action in progress. Proceeding...`);

     // Show confirmation alert
     console.log(`[handleCancelRide] Showing confirmation Alert for ${requestId}`);
     Alert.alert(
         'Confirm Cancellation',
         `Are you sure you want to cancel the ride for ${passengerName}?`,
         [
             {
                 text: 'Keep Ride',
                 style: 'cancel',
                 onPress: () => {
                     console.log(`[handleCancelRide] User chose 'Keep Ride' for ${requestId}`);
                 }
             },
             {
                 text: 'Cancel Ride',
                 style: 'destructive',
                 onPress: async () => {
                     console.log(`[handleCancelRide] User confirmed cancellation for ${requestId}. Starting API call...`);
                     setIsCancelling(requestId); // Set loading state
                     console.log(`[handleCancelRide] State isCancelling set to: ${requestId}`);
                     let token: string | null = null; // Define token variable here
                     try {
                         console.log(`[handleCancelRide] Getting token...`);
                         token = await getToken();
                         if (!token) {
                             console.error(`[handleCancelRide] Token not found!`);
                             Alert.alert('Authentication Error', 'Please login.');
                             // No need to reset isCancelling here, finally block will handle it
                             return; // Exit if no token
                         }
                         console.log(`[handleCancelRide] Token found. Calling API endpoint: api/riderequests/${requestId}/cancel/driver`);

                         const response = await fetchData(apiUrl, `api/riderequests/${requestId}/cancel/driver`, {
                             method: 'PATCH',
                             headers: { Authorization: `Bearer ${token}` },
                         });

                         console.log(`[handleCancelRide] API response received for ${requestId}:`, response);

                         if (response?.message === "Request cancelled and made pending again.") {
                              console.log(`[handleCancelRide] Cancellation successful for ${requestId}.`);
                              Alert.alert('Success', `Ride for ${passengerName} cancelled.`);
                              console.log(`[handleCancelRide] Refreshing passenger list...`);
                              fetchPassengerDetails(false); // Refresh list
                         } else {
                             console.error(`[handleCancelRide] API call failed or returned unexpected message for ${requestId}. Response:`, response);
                             throw new Error(response?.error || response?.message || 'Failed to cancel ride. Unexpected response.');
                         }
                     } catch (error: any) {
                         console.error(`[handleCancelRide] Error during cancellation API call for ${requestId}:`, error);
                         Alert.alert('Cancellation Error', `Could not cancel ride: ${error.message}`);
                         // *** Ensure state is reset even on error ***
                         // setIsCancelling(null); // Moved to finally
                     } finally {
                         // *** CRITICAL: Ensure state is ALWAYS reset ***
                         console.log(`[handleCancelRide] Finished cancellation attempt for ${requestId}. Resetting isCancelling.`);
                         setIsCancelling(null);
                     }
                 }
             }
         ],
         { cancelable: true } // Allow dismissing the alert by tapping outside on Android
     );
  };

   // Helper to style status text (As provided by user)
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

  // Render Passenger Card (Add console log inside onPress)
  const renderPassenger = ({ item }: { item: PassengerDetails }) => {
      const isAnyActionInProgress = isInitiatingChat !== null || isCancelling !== null;
      const isThisItemCancelling = isCancelling === item.requestId;
      const isThisItemChatting = isInitiatingChat === item.requestId;

      return (
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
                     // *** DEBUG: Add log inside the onPress lambda ***
                     onPress={() => {
                         console.log(`Cancel Ride button pressed for Request ID: ${item.requestId}`);
                         handleCancelRide(item.requestId, item.passengerName);
                     }}
                     iconName="close-circle-outline"
                     style={styles.actionButtonSmall}
                     color="#dc3545"
                     loading={isThisItemCancelling}
                     disabled={isAnyActionInProgress}
                 />
                 <ActionButton
                     title="Chat"
                     onPress={() => {
                         console.log(`Chat button pressed for Request ID: ${item.requestId}`);
                         handleChat(item.requestId);
                     }}
                     iconName="chatbubble-ellipses-outline"
                     style={styles.actionButtonSmall}
                     color="#007bff"
                     loading={isThisItemChatting}
                     disabled={isAnyActionInProgress}
                 />
              </View>
         </View>
      );
  }

  // Navigation Handler (As provided by user)
  const handleNavigate = (screen: keyof RootStackParamList, params?: any) => {
     setSidebarVisible(false);
     switch (screen) {
       case 'Home': navigation.navigate({ name: 'Home', params: params ?? { acceptedTaxiId: undefined }, merge: true }); break;
       case 'requestRide': navigation.navigate({ name: 'requestRide', params: params, merge: true }); break;
       case 'ViewTaxi': navigation.navigate({ name: 'ViewTaxi', params: params, merge: true }); break;
       case 'ViewRoute': navigation.navigate({ name: 'ViewRoute', params: params, merge: true }); break;
       case 'ViewRequests': navigation.navigate({ name: 'ViewRequests', params: params, merge: true }); break;
       case 'LiveChat':
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

  // --- Render Logic (As provided by user, added disabled states to header buttons) ---
  return (
    <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
          <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="AcceptedPassenger" />
        <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar} disabled={isInitiatingChat !== null || isCancelling !== null}>
                    <Ionicons name="menu" size={32} color="#003E7E" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Accepted Passengers</Text>
                <TouchableOpacity style={styles.headerButton} onPress={() => fetchPassengerDetails(true)} disabled={isLoading || isInitiatingChat !== null || isCancelling !== null}>
                    {isLoading && !isInitiatingChat && !isCancelling ? <ActivityIndicator size="small" color="#003E7E" /> : <Ionicons name="refresh" size={28} color="#003E7E" />}
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
                    refreshing={isLoading && passengerDetails.length > 0 && !isInitiatingChat && !isCancelling}
                />
            )}
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};

// --- Styles --- (As provided by user)
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
    actionButtonSmall: { paddingVertical: 10, paddingHorizontal: 15, flex: 0.48, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, // Added minHeight and centering
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  infoIcon: { marginRight: 10, width: 20, textAlign: 'center' },
  infoLabel: { fontSize: 15, color: '#555', fontWeight: '500', width: 95 },
  infoValue: { fontSize: 15, color: '#000', fontWeight: '600', flex: 1 },
   emptyListContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, marginTop: 30 },
   emptyListText: { fontSize: 18, fontWeight: '600', color: '#555', textAlign: 'center', marginTop: 15 },
   emptyListSubText: { fontSize: 14, color: '#777', textAlign: 'center', marginTop: 5 },
    actionButtonBase: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
    actionButtonIcon: { marginRight: 10 },
    actionButtonText: { fontSize: 16, fontWeight: '600', textAlign: 'center' }, // Added textAlign
    actionButtonDisabled: { backgroundColor: '#A0A0A0', elevation: 0, shadowOpacity: 0, opacity: 0.7 }, // Added opacity
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
