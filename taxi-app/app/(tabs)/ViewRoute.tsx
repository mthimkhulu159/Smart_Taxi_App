import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  ActivityIndicator, // Keep for inline button loading if needed
  Modal,
  ScrollView,
  SafeAreaView, // Added
  Platform,      // Added
  Animated,      // Added
  ViewStyle,     // Added
  TextStyle      // Added
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { getToken, fetchData } from "../api/api"; // Assuming correct path
import { FontAwesome, MaterialIcons, Ionicons } from "@expo/vector-icons"; // Added Icons
import { useNavigation } from '@react-navigation/native'; // Added
import { StackNavigationProp } from '@react-navigation/stack'; // Added
import Sidebar from '../components/Sidebar'; // (ADJUST PATH if needed)
import { RootStackParamList } from '../types/navigation';
import { apiUrl } from '../api/apiUrl';
// --- Types and Interfaces ---
interface RouteStop {
    _id: string; // Assuming backend provides _id for stops
    name: string;
    order: number;
}

interface Route {
  _id: string;
  routeName: string;
  startLocation: string;
  endLocation: string;
  estimatedTime: string;
  stops: RouteStop[]; // Use the detailed stop interface
};

type ViewRouteNavigationProp = StackNavigationProp<RootStackParamList, 'ViewRoute'>;

interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
  onNavigate: (screen: keyof RootStackParamList) => void;
  activeScreen: keyof RootStackParamList;
}

// --- Constants ---
const { width: windowWidth } = Dimensions.get("window"); // Use if needed

// --- Loading Component (Copied from previous screens) ---
const Loading: React.FC = () => {
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })).start(); }, [spinAnim]);
  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.loadingGradient}>
        <View style={styles.loadingContainerInternal}><Animated.View style={{ transform: [{ rotate: spin }] }}><Ionicons name="refresh" size={50} color="#003E7E" /></Animated.View><Text style={styles.loadingTextInternal}>Loading Routes...</Text></View>
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

// --- Info Row Component (Example, can adapt from Profile) ---
const InfoRow: React.FC<{ label: string; value: string | undefined; iconName: any; iconFamily?: 'Ionicons' | 'MaterialIcons' | 'FontAwesome' }> =
    ({ label, value, iconName, iconFamily = 'Ionicons' }) => {
    const IconComponent = iconFamily === 'MaterialIcons' ? MaterialIcons : iconFamily === 'FontAwesome' ? FontAwesome : Ionicons;
    return (
        <View style={styles.infoRow}>
            <IconComponent name={iconName} size={18} color="#555" style={styles.infoIcon} />
            <Text style={styles.infoLabel}>{label}:</Text>
            <Text style={styles.infoValue}>{value || 'N/A'}</Text>
        </View>
    );
};


// --- Main ViewRoute Component ---
const ViewRoute: React.FC = () => {
  const [startLocation, setStartLocation] = useState<string>("");
  const [endLocation, setEndLocation] = useState<string>("");
  const [routes, setRoutes] = useState<Route[]>([]); // Holds all fetched routes
  const [filteredRoutes, setFilteredRoutes] = useState<Route[]>([]); // Holds currently displayed routes
  const [isLoading, setIsLoading] = useState<boolean>(true); // Initial loading state
  const [isSearching, setIsSearching] = useState<boolean>(false); // Loading state for search button
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false); // Added sidebar state

  const navigation = useNavigation<ViewRouteNavigationProp>(); // Added navigation prop

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Initial Load Effect
  useEffect(() => {
    loadRoutes();
  }, []);

   // Animation Effect
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

  // --- Functions ---
  const loadRoutes = async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) { setIsLoading(false); return; }
      const response = await fetchData(apiUrl, "api/routes/availableRoutes", {
        method: "GET", headers: { Authorization: `Bearer ${token}` },
      });
      if (response?.routes) {
        setRoutes(response.routes);
        setFilteredRoutes(response.routes); // Initially show all routes
      } else {
          setRoutes([]);
          setFilteredRoutes([]);
      }
    } catch (error: any) {
      console.error("Error fetching routes:", error);
       setRoutes([]);
       setFilteredRoutes([]);
    } finally {
      setIsLoading(false);
    }
  };

    // const debouncedSearch = useRef(
    //     debounce(() => {
    //         filterRoutesFunction(); // Call the actual filtering logic
    //     }, 500) // Adjust debounce time (e.g., 500ms)
    // ).current;

    // useEffect(() => {
    //     debouncedSearch();
    //     return () => debouncedSearch.cancel(); // Cleanup debounce on unmount
    // }, [startLocation, endLocation, routes]); // Trigger debounce when inputs or base routes change

  // Filtering Logic
  const searchRoutes = () => {
    setIsSearching(true); // Indicate search activity
    if (!startLocation.trim() && !endLocation.trim()) {
      setFilteredRoutes(routes); // Show all if inputs are empty
    } else {
      const startLower = startLocation.trim().toLowerCase();
      const endLower = endLocation.trim().toLowerCase();
      const filtered = routes.filter(route => {
        const matchStart = startLower ? route.startLocation.toLowerCase().includes(startLower) : true;
        const matchEnd = endLower ? route.endLocation.toLowerCase().includes(endLower) : true;
        // Also check if stops contain start/end locations (more advanced search)
        const matchStopStart = startLower ? route.stops.some(stop => stop.name.toLowerCase().includes(startLower)) : true;
         const matchStopEnd = endLower ? route.stops.some(stop => stop.name.toLowerCase().includes(endLower)) : true;

         // Logic: Match if (start matches startLoc OR start matches a stop) AND (end matches endLoc OR end matches a stop)
        return (matchStart || matchStopStart) && (matchEnd || matchStopEnd);
      });
      setFilteredRoutes(filtered);
    }
     // Simulate search time or remove if filtering is instant
     setTimeout(() => setIsSearching(false), 300);
  };

  // Render Route Card
  const renderRoute = ({ item }: { item: Route }) => (
    <View style={styles.routeCard}>
        <View style={styles.routeCardHeader}>
            <MaterialIcons name="route" size={22} color="#003E7E" />
            <Text style={styles.routeCardTitle} numberOfLines={1}>{item.routeName}</Text>
        </View>
        <View style={styles.routeCardBody}>
            <InfoRow label="From" value={item.startLocation} iconName="navigate-circle-outline"/>
            <InfoRow label="To" value={item.endLocation} iconName="flag-outline"/>
            <InfoRow label="Time" value={item.estimatedTime} iconName="time-outline"/>
        </View>
        <View style={styles.routeCardFooter}>
            <ActionButton
                title="View Details"
                onPress={() => openRouteDetails(item)}
                iconName="eye-outline"
                style={styles.detailsButton}
                color="#1E88E5" // Use a slightly different color for details
            />
        </View>
    </View>
  );

  const openRouteDetails = (route: Route) => {
    // Sort stops by order before displaying
    const sortedStops = [...route.stops].sort((a, b) => a.order - b.order);
    setSelectedRoute({...route, stops: sortedStops}); // Store route with sorted stops
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedRoute(null);
  };

  // Navigation Handler
  const handleNavigate = (screen: keyof RootStackParamList) => {
     setSidebarVisible(false);
     // Navigation logic using switch... (same as previous examples)
      switch (screen) {
        case 'Home': navigation.navigate({ name: 'Home', params: { acceptedTaxiId: undefined }, merge: true }); break;
        case 'requestRide': navigation.navigate({ name: 'requestRide', params: undefined, merge: true }); break;
        case 'ViewTaxi': navigation.navigate({ name: 'ViewTaxi', params: undefined, merge: true }); break;
        case 'ViewRoute': break; // Already here
        case 'ViewRequests': navigation.navigate({ name: 'ViewRequests', params: undefined, merge: true }); break;
        case 'TaxiManagement': navigation.navigate({ name: 'TaxiManagement', params: undefined, merge: true }); break;
        case 'TaxiFareCalculator': navigation.navigate({ name: 'TaxiFareCalculator', params: undefined, merge: true }); break;
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
    <LinearGradient colors={["#FFFFFF", "#E8F0FE"]} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
         {/* Sidebar */}
         <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="ViewRoute" />

        <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}><Ionicons name="menu" size={32} color="#003E7E" /></TouchableOpacity>
                <Text style={styles.headerTitle}>Available Routes</Text>
                <View style={styles.headerButton} />
                {/* Optional: Add search icon to header? */}
            </View>

            {/* Main Content */}
            {isLoading ? (
                <Loading />
            ) : (
                <FlatList
                    data={filteredRoutes}
                    keyExtractor={(item) => item._id}
                    renderItem={renderRoute}
                    ListHeaderComponent={ // Filter Section moved to ListHeader
                        <View style={styles.filterContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="Filter by Start Location or Stop"
                                placeholderTextColor="#aaa"
                                value={startLocation}
                                onChangeText={setStartLocation}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Filter by End Location or Stop"
                                placeholderTextColor="#aaa"
                                value={endLocation}
                                onChangeText={setEndLocation}
                            />
                            <ActionButton
                                title="Find Routes"
                                onPress={searchRoutes}
                                iconName="search"
                                iconFamily="FontAwesome" // Use FontAwesome for search icon
                                loading={isSearching}
                                disabled={isSearching}
                                style={styles.searchButton}
                            />
                         </View>
                    }
                    ListEmptyComponent={ // Styled empty state
                        <View style={styles.emptyListContainer}>
                            <Ionicons name="map-outline" size={50} color="#888" />
                            <Text style={styles.emptyListText}>No routes match your criteria.</Text>
                            <Text style={styles.emptyListSubText}>Try adjusting your start/end locations or view all routes.</Text>
                        </View>
                    }
                    contentContainerStyle={styles.listContentContainer}
                     // Optional: Add pull-to-refresh
                     onRefresh={loadRoutes}
                     refreshing={isLoading}
                />
            )}

             {/* Route Details Modal */}
             <Modal visible={modalVisible} transparent={true} animationType="fade" onRequestClose={closeModal}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {selectedRoute && (
                            <>
                                 <TouchableOpacity style={styles.modalCloseButton} onPress={closeModal}><Ionicons name="close-circle" size={30} color="#888" /></TouchableOpacity>
                                <Text style={styles.modalTitle}>{selectedRoute.routeName}</Text>
                                <View style={styles.modalSection}>
                                    <InfoRow label="From" value={selectedRoute.startLocation} iconName="navigate-circle-outline"/>
                                    <InfoRow label="To" value={selectedRoute.endLocation} iconName="flag-outline"/>
                                    <InfoRow label="Time" value={`${selectedRoute.estimatedTime} minutes`} iconName="time-outline"/>
                                </View>
                                <View style={styles.modalSection}>
                                    <Text style={styles.modalSectionTitle}>Stops ({selectedRoute.stops.length})</Text>
                                    <ScrollView style={styles.stopsScrollContainer}>
                                        {selectedRoute.stops.map((stop, index) => (
                                            <View key={stop._id || index} style={styles.stopItem}>
                                                 <Text style={styles.stopNumber}>{index + 1}.</Text>
                                                <Text style={styles.stopName}>{stop.name}</Text>
                                            </View>
                                        ))}
                                         {selectedRoute.stops.length === 0 && <Text style={styles.noStopsText}>No intermediate stops listed.</Text>}
                                    </ScrollView>
                                </View>
                                <ActionButton
                                    title="Close"
                                    onPress={closeModal}
                                    style={styles.modalCloseActionButton}
                                    color="#6c757d" // Gray color for close
                                    iconName="close-circle-outline"
                                />
                            </>
                        )}
                    </View>{/* modalContent */}
                </View>{/* modalOverlay */}
            </Modal>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  // Common styles (gradient, safeArea, mainContainer, header, etc.)
  gradient: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  mainContainer: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 15 : 10, paddingBottom: 10, width: '100%' },
  headerButton: { padding: 8, minWidth: 40, alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#000000' },

  // Filter Section
  filterContainer: {
      paddingHorizontal: 15, // Match list padding
      paddingTop: 15,
      paddingBottom: 10,
      marginBottom: 10,
      backgroundColor: 'rgba(255, 255, 255, 0.8)', // Slightly transparent white
      borderRadius: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#eee'
  },
  input: { // Consistent input style
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#D0D0D0',
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 12, // Reduced padding slightly
        fontSize: 15, // Slightly smaller font
        color: '#000000',
        marginBottom: 10, // Space between inputs
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
   },
    searchButton: {
        marginTop: 5,
    },

  // List Styles
  listContentContainer: {
      paddingHorizontal: 15,
      paddingBottom: 20, // Space at the bottom
      flexGrow: 1,
  },
  routeCard: { // Based on sectionCard
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
  routeCardHeader: { // Similar to taxiCardHeader
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#E8F0FE',
      paddingHorizontal: 15,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#D0D8E8',
  },
  routeCardTitle: {
      fontSize: 17, // Slightly larger route name
      fontWeight: 'bold',
      color: '#003E7E',
      marginLeft: 10,
      flex: 1, // Allow shrinking/truncating
  },
  routeCardBody: {
      paddingHorizontal: 15,
      paddingTop: 5, // Less top padding
      paddingBottom: 10,
  },
   routeCardFooter: { // Similar to taxiCardFooter
       padding: 10,
       alignItems: 'flex-end',
       borderTopWidth: 1,
       borderTopColor: '#EEEEEE',
       marginTop: 0, // Reduced margin
   },
   detailsButton: { // Similar to updateButton
       paddingVertical: 8,
       paddingHorizontal: 15,
   },

  // InfoRow Styles (Adapted from Profile)
  infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 7,
  },
  infoIcon: {
      marginRight: 10,
      width: 20,
      textAlign: 'center',
  },
  infoLabel: {
      fontSize: 15,
      color: '#555',
      fontWeight: '500',
      width: 50, // Adjusted width
  },
  infoValue: {
      fontSize: 15,
      color: '#000',
      fontWeight: '600',
      flex: 1,
  },

   // Empty List Styles (from TaxiManagement)
   emptyListContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, marginTop: 30 },
   emptyListText: { fontSize: 18, fontWeight: '600', color: '#555', textAlign: 'center', marginTop: 15 },
   emptyListSubText: { fontSize: 14, color: '#777', textAlign: 'center', marginTop: 5 },

  // Modal Styles (Refined)
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.6)" },
  modalContent: { backgroundColor: "#fff", padding: 20, paddingTop: 40, borderRadius: 15, width: windowWidth - 40, maxHeight: "85%", elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 }, // Added paddingTop
  modalCloseButton: { position: 'absolute', top: 10, right: 10, padding: 5 },
  modalTitle: { fontSize: 22, fontWeight: "bold", color: "#003E7E", marginBottom: 15, textAlign: 'center' },
  modalSection: { marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
  modalSectionTitle: { fontSize: 17, fontWeight: '600', color: '#333', marginBottom: 10 },
  stopsScrollContainer: { maxHeight: 180 }, // Limit height of stops list
  stopItem: { flexDirection: 'row', paddingVertical: 5, alignItems: 'center' },
  stopNumber: { marginRight: 8, color: '#888', fontSize: 14, width: 20, textAlign: 'right'},
  stopName: { fontSize: 15, color: '#000', flex: 1 },
  noStopsText: { color: '#888', fontStyle: 'italic', paddingVertical: 10 },
  modalCloseActionButton: { marginTop: 15 },

   // Action Button Styles (Copied)
    actionButtonBase: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
    actionButtonIcon: { marginRight: 10 },
    actionButtonText: { fontSize: 16, fontWeight: '600' },
    actionButtonDisabled: { backgroundColor: '#A0A0A0', elevation: 0, shadowOpacity: 0 },

  // --- Sidebar Styles (Copied) ---
    sidebarInternal: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 300, backgroundColor: '#003E7E', zIndex: 1000, elevation: Platform.OS === 'android' ? 10: 0, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.3, shadowRadius: 5, paddingTop: Platform.OS === 'ios' ? 20 : 0 },
    sidebarCloseButtonInternal: { position: 'absolute', top: Platform.OS === 'android' ? 45 : 55, right: 15, zIndex: 1010, padding: 5 },
    sidebarHeaderInternal: { alignItems: 'center', marginBottom: 30, paddingTop: 60 },
    sidebarLogoIconInternal: { marginBottom: 10 },
    sidebarTitleInternal: { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center' },
    sidebarButtonInternal: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 8, marginBottom: 8, marginHorizontal: 10 },
    sidebarButtonActiveInternal: { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
    sidebarButtonTextInternal: { fontSize: 16, marginLeft: 15, color: '#E0EFFF', fontWeight: '600' },
    sidebarButtonTextActiveInternal: { color: '#FFFFFF', fontWeight: 'bold' },

  // --- Loading Styles (Copied) ---
   loadingGradient: { flex: 1 },
   loadingContainerInternal: { flex: 1, justifyContent: 'center', alignItems: 'center' },
   loadingTextInternal: { marginTop: 15, fontSize: 16, color: '#003E7E', fontWeight: '500' },

    // Removed old styles: container, mainContent (partially), table styles, old button styles, etc.
});

export default ViewRoute;