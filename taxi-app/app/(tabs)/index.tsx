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
  ViewStyle // Import ViewStyle for explicit typing if needed
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { getToken, fetchData } from '../api/api'; // Adjust path as needed
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import io from 'socket.io-client';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

// --- Navigation Types ---
// Ensure this accurately reflects your navigation setup
type RootStackParamList = {
  Home: { acceptedTaxiId?: string };
  requestRide: undefined;
  ViewTaxi: undefined;
  ViewRequests: undefined;
  LiveChat: undefined;
  TaxiManagement: undefined;
  Profile: undefined;
  AcceptedRequest: undefined;
};

type HomeScreenRouteProp = RouteProp<RootStackParamList, 'Home'>;
type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

// --- Interfaces ---
interface TaxiInfo {
  _id: string;
  numberPlate: string;
  status: string;
  currentStop: string;
  currentLoad: number;
  routeName: string;
  nextStop: string;
  maxLoad: number;
}

interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
  onNavigate: (screen: keyof RootStackParamList) => void;
  activeScreen: keyof RootStackParamList;
}

interface QuickActionProps {
  icon: string;
  iconFamily?: 'FontAwesome' | 'MaterialIcons' | 'Ionicons';
  label: string;
  onPress: () => void;
}

// --- Enhanced Sidebar Component ---
const Sidebar: React.FC<SidebarProps> = ({ isVisible, onClose, onNavigate, activeScreen }) => {
  const slideAnim = useRef(new Animated.Value(-300)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isVisible ? 0 : -300,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isVisible, slideAnim]);

  const NavItem: React.FC<{ screen: keyof RootStackParamList; label: string; icon: React.ReactNode }> = ({ screen, label, icon }) => (
    <TouchableOpacity
      style={[styles.sidebarButton, activeScreen === screen && styles.sidebarButtonActive]}
      onPress={() => { onNavigate(screen); onClose(); }}
    >
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
          <Text style={styles.sidebarTitle}>Shesha</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <NavItem screen="Home" label="Home" icon={<FontAwesome name="home" size={22} color="#FFFFFF" />} />
          <NavItem screen="requestRide" label="Request Ride" icon={<FontAwesome name="car" size={22} color="#FFFFFF" />} />
          <NavItem screen="ViewTaxi" label="View Taxis" icon={<MaterialIcons name="map" size={22} color="#FFFFFF" />} />
          <NavItem screen="AcceptedRequest" label="My Ride" icon={<FontAwesome name="check-circle" size={22} color="#FFFFFF" />} />
          {/* <View style={styles.sidebarDivider} /> */}
          <NavItem screen="ViewRequests" label="Search Rides" icon={<FontAwesome name="search" size={22} color="#FFFFFF" />} />
          <NavItem screen="LiveChat" label="Live Chat" icon={<Ionicons name="chatbubbles-outline" size={22} color="#FFFFFF" />} />
          <NavItem screen="TaxiManagement" label="Manage Taxi" icon={<MaterialIcons name="settings" size={22} color="#FFFFFF" />} />
          <NavItem screen="Profile" label="Profile" icon={<FontAwesome name="user-circle-o" size={22} color="#FFFFFF" />} />
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
};

// --- Quick Action Button Component ---
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

// --- Enhanced Live Status Component ---
const LiveStatusCard: React.FC<{ monitoredTaxi: TaxiInfo | null; onEndMonitoring: () => void }> = ({ monitoredTaxi, onEndMonitoring }) => {
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(cardAnim, {
      toValue: monitoredTaxi ? 1 : 0,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [monitoredTaxi, cardAnim]);

  const animatedCardStyle = {
    height: cardAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 260],
        extrapolate: 'clamp',
    }),
    opacity: cardAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, 0, 1],
        extrapolate: 'clamp',
    }),
    marginBottom: cardAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 25],
        extrapolate: 'clamp',
    }),
  };

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (monitoredTaxi) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.03, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
    return () => pulseAnim.stopAnimation();
  }, [monitoredTaxi, pulseAnim]);

  return (
    <Animated.View style={[styles.liveStatusCardBase, animatedCardStyle, { transform: [{ scale: pulseAnim }] }]}>
      {monitoredTaxi && (
        <LinearGradient colors={['#0052A2', '#003E7E']} style={styles.liveStatusGradient}>
          <View style={styles.statusHeader}>
            <View style={styles.liveIndicator}>
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <Text style={styles.statusTitle} numberOfLines={1}>Tracking: {monitoredTaxi.numberPlate}</Text>
            <TouchableOpacity onPress={onEndMonitoring} style={styles.endMonitorButton}>
              <Ionicons name="close-circle" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.taxiDetailsGrid}>
            <View style={styles.detailItem}>
              <MaterialIcons name="directions-bus" size={20} color="#E0EFFF" />
              <Text style={styles.taxiTextLabel}>Route:</Text>
              <Text style={styles.taxiTextValue} numberOfLines={1}>{monitoredTaxi.routeName || 'N/A'}</Text>
            </View>
            <View style={styles.detailItem}>
              <MaterialIcons name="pin-drop" size={20} color="#E0EFFF" />
              <Text style={styles.taxiTextLabel}>Next:</Text>
              <Text style={styles.taxiTextValue} numberOfLines={1}>{monitoredTaxi.nextStop || 'N/A'}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="speedometer-outline" size={20} color="#E0EFFF" />
              <Text style={styles.taxiTextLabel}>Status:</Text>
              <Text style={styles.taxiTextValue}>{monitoredTaxi.status || 'N/A'}</Text>
            </View>
            <View style={styles.detailItem}>
              <MaterialIcons name="groups" size={20} color="#E0EFFF" />
              <Text style={styles.taxiTextLabel}>Load:</Text>
              <Text style={styles.taxiTextValue}>{monitoredTaxi.currentLoad ?? 'N/A'} / {monitoredTaxi.maxLoad ?? 'N/A'}</Text>
            </View>
          </View>
        </LinearGradient>
      )}
    </Animated.View>
  );
};

// --- Loading Component ---
const Loading: React.FC = () => {
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.loadingContainer}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Ionicons name="refresh" size={50} color="#003E7E" />
      </Animated.View>
      <Text style={styles.loadingText}>Loading Your Dashboard...</Text>
    </View>
  );
};

// --- Main HomeScreen Component ---
const HomeScreen = () => {
  const apiUrl = "https://qmarshal.onrender.com"
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [monitoredTaxi, setMonitoredTaxi] = useState<TaxiInfo | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const socketRef = useRef<any>(null);

  const route = useRoute<HomeScreenRouteProp>();
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const acceptedTaxiId = route.params?.acceptedTaxiId;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    console.log('Attempting socket connection to:', apiUrl);
    const socket = io(apiUrl, {
        transports: ['websocket'],
        reconnectionAttempts: 5,
        timeout: 10000,
    });
    socketRef.current = socket;
    socket.on('connect', () => console.log('Socket connected:', socket.id));
    socket.on('disconnect', (reason: string) => console.log('Socket disconnected:', reason));
    socket.on('connect_error', (err: Error) => console.log('Socket connection error:', err.message, err.stack));
    return () => {
      if (socketRef.current) {
        console.log('Cleaning up socket connection.');
        socketRef.current.close();
      }
    };
  }, [apiUrl]);

  useEffect(() => {
    let isMounted = true;
    const fetchUserData = async () => {
      console.log('Fetching user data...');
      const token = await getToken();
      if (token) {
        try {
          const response = await fetchData(apiUrl, 'api/users/get-user', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (isMounted) {
             if (response?.user) {
               setUserName(response.user.name);
             } else {
               setUserName(null);
             }
          }
        } catch (error: any) {
          console.error('Error fetching user data:', error.message);
           if (isMounted) {
               Alert.alert('Error', 'Could not load your profile.');
               setUserName(null);
           }
        }
      } else {
         if (isMounted) setUserName(null);
      }
      if (isMounted) setIsLoading(false);
    };
    fetchUserData();
    const animationTimer = setTimeout(() => {
         Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
          ]).start();
    }, 100);
    return () => { isMounted = false; clearTimeout(animationTimer); };
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    if (socketRef.current && monitoredTaxi?._id) {
      const socket = socketRef.current;
      const taxiIdToMonitor = monitoredTaxi._id;
      const handleTaxiUpdate = (updatedTaxi: TaxiInfo) => {
        if (updatedTaxi && updatedTaxi._id === taxiIdToMonitor) {
           setMonitoredTaxi(prevTaxi => prevTaxi && prevTaxi._id === taxiIdToMonitor ? { ...prevTaxi, ...updatedTaxi } : prevTaxi);
        }
      };
      const eventName = 'taxiUpdateForPassenger';
      socket.on(eventName, handleTaxiUpdate);
      socket.emit('subscribeToTaxiUpdates', { taxiId: taxiIdToMonitor });
      return () => {
        if (socket) {
          socket.off(eventName, handleTaxiUpdate);
          socket.emit('unsubscribeFromTaxiUpdates', { taxiId: taxiIdToMonitor });
        }
      };
    }
  }, [monitoredTaxi?._id]);

  useEffect(() => {
    let isMounted = true;
    if (acceptedTaxiId) {
      if (monitoredTaxi?._id !== acceptedTaxiId) {
           fetchMonitoredTaxi(acceptedTaxiId, isMounted);
      } else {
           if (isLoading && isMounted) setIsLoading(false);
      }
    } else {
       if(monitoredTaxi) {
           if(isMounted) setMonitoredTaxi(null);
       }
        if(isLoading && isMounted) setIsLoading(false);
    }
     return () => { isMounted = false; };
  }, [acceptedTaxiId, isLoading]); // Ensure fetchMonitoredTaxi isn't a dependency

  const fetchMonitoredTaxi = async (taxiId: string, isMountedCheck: boolean) => {
    console.log(`Workspaceing details for taxi ID: ${taxiId}`);
    const token = await getToken();
    if (!token) {
      if (isMountedCheck) Alert.alert('Authentication Error', 'Please log in.');
      if (isMountedCheck) setIsLoading(false);
      return;
    }
     if(isMountedCheck && !isLoading) setIsLoading(true);
    try {
      const endpoint = `api/taxis/${taxiId}/monitor`;
      const response = await fetchData(apiUrl, endpoint, { method: 'GET', headers: { Authorization: `Bearer ${token}` }});
       if (!isMountedCheck) return;
      if (response?.taxiInfo?._id) {
        setMonitoredTaxi(response.taxiInfo);
      } else {
         setMonitoredTaxi(null);
         navigation.setParams({ acceptedTaxiId: undefined });
         Alert.alert('Error', 'Could not find details for the assigned taxi.');
      }
    } catch (error: any) {
      console.error('Error fetching monitored taxi:', error.message);
       if (isMountedCheck) {
           setMonitoredTaxi(null);
           navigation.setParams({ acceptedTaxiId: undefined });
           Alert.alert('Error', 'Failed to load taxi details.');
       }
    } finally {
        if (isMountedCheck) setIsLoading(false);
    }
  };

  const handleEndMonitoring = () => {
    setMonitoredTaxi(null);
    navigation.setParams({ acceptedTaxiId: undefined });
  };

  // --- Navigation Handler ---
  // FIX APPLIED HERE: Using Switch statement for type safety
  const handleNavigate = (screen: keyof RootStackParamList) => {
      setSidebarVisible(false); // Close sidebar on navigation

      // Use a switch statement for type safety with navigate overloads
      switch (screen) {
          case 'Home':
              navigation.navigate({ name: 'Home', params: { acceptedTaxiId: undefined }, merge: true });
              break;
          case 'requestRide':
              navigation.navigate({ name: 'requestRide', params: undefined, merge: true });
              break;
          case 'ViewTaxi':
              navigation.navigate({ name: 'ViewTaxi', params: undefined, merge: true });
              break;
          case 'ViewRequests':
              navigation.navigate({ name: 'ViewRequests', params: undefined, merge: true });
              break;
          case 'LiveChat':
              navigation.navigate({ name: 'LiveChat', params: undefined, merge: true });
              break;
          case 'TaxiManagement':
              navigation.navigate({ name: 'TaxiManagement', params: undefined, merge: true });
              break;
          case 'Profile':
              navigation.navigate({ name: 'Profile', params: undefined, merge: true });
              break;
          case 'AcceptedRequest':
              navigation.navigate({ name: 'AcceptedRequest', params: undefined, merge: true });
              break;
          default:
              console.warn(`Attempted to navigate to unhandled screen: ${screen}`);
              // Fallback or do nothing
              break;
      }
  };


  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  if (isLoading && userName === null && !acceptedTaxiId) {
    return <Loading />;
  }

  return (
    <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <Sidebar isVisible={sidebarVisible} onClose={toggleSidebar} onNavigate={handleNavigate} activeScreen="Home" />
        <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.header}>
                 <TouchableOpacity style={styles.headerButton} onPress={toggleSidebar}>
                    <Ionicons name="menu" size={32} color="#003E7E" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Dashboard</Text>
                 <TouchableOpacity style={styles.headerButton} onPress={() => handleNavigate('Profile')}>
                    <FontAwesome name="user-circle-o" size={28} color="#003E7E" />
                </TouchableOpacity>
            </View>
             <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled" >
                <Text style={styles.greetingText}>
                    {userName ? `Welcome back, ${userName}!` : 'Welcome to Shesha!'}
                </Text>
                <Text style={styles.subtitleText}>Ready for your next ride?</Text>
                <LiveStatusCard monitoredTaxi={monitoredTaxi} onEndMonitoring={handleEndMonitoring} />
                 {!monitoredTaxi && (
                     <View style={styles.quickActionsContainer}>
                        <Text style={styles.sectionTitle}>Quick Actions</Text>
                        <View style={styles.quickActionsGrid}>
                            <QuickActionButton icon="car" label="Request Ride" onPress={() => handleNavigate('requestRide')} iconFamily='FontAwesome'/>
                            <QuickActionButton icon="map-outline" label="View Taxis" onPress={() => handleNavigate('ViewTaxi')} iconFamily='Ionicons'/>
                             <QuickActionButton icon="search" label="Find Ride" onPress={() => handleNavigate('ViewRequests')} iconFamily='FontAwesome'/>
                             <QuickActionButton icon="chatbubbles-outline" label="Support Chat" onPress={() => handleNavigate('LiveChat')} iconFamily='Ionicons'/>
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
  gradient: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  loadingText: { marginTop: 15, fontSize: 16, color: '#003E7E', fontWeight: '500' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'android' ? 15 : 10, paddingBottom: 10, width: '100%' },
  headerButton: { padding: 8 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#000000' },
  sidebar: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 300, backgroundColor: '#003E7E', zIndex: 1000, elevation: 10, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.3, shadowRadius: 5, paddingTop: Platform.OS === 'ios' ? 20 : 0 },
  sidebarCloseButton: { position: 'absolute', top: Platform.OS === 'android' ? 45 : 55, right: 15, zIndex: 1010 },
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
  liveStatusCardBase: { borderRadius: 15, borderWidth: 1, borderColor: 'rgba(0, 62, 126, 0.2)', elevation: 4, shadowColor: '#003E7E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 4, overflow: 'hidden' }, // Added overflow here
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
});

export default HomeScreen;