import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Appearance, // Import Appearance
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getToken, fetchData } from '../api/api'; // Assuming these are correctly set up
import { Manager, Socket } from 'socket.io-client';
import { apiUrl } from '../api/apiUrl';

// --- Interfaces (Keep as is) ---
interface Message {
  _id: string;
  sender: {
    _id: string;
    name: string;
    email?: string; // Optional email
  };
  content: string;
  createdAt: string;
}

interface UserDetails {
  id: string;
}

// --- Helper Functions (Keep as is, including getUserDetails) ---
const getUserDetails = async (apiUrl: string): Promise<UserDetails | null> => {
  const token = await getToken();
  if (!token) {
    console.error('Authentication token not found.');
    return null;
  }
  try {
    const response = await fetchData(apiUrl, 'api/users/get-user', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }) as { user: UserDetails };
    if (response && response.user && response.user.id) {
      return response.user;
    } else {
      console.error('User details not found in response:', response);
      return null;
    }
  } catch (error) {
    console.error('Error fetching user details:', error);
    Alert.alert('Error', 'Could not fetch your user details. Please try again.');
    return null;
  }
};

// --- LiveChatScreen Component ---
const LiveChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { chatSessionId } = route.params as { chatSessionId: string };

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const flatListRef = useRef<FlatList<Message>>(null);
  // Optional: Add theme state if you want dynamic light/dark mode beyond initial detection
  // const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());

  // --- Effects (Keep core logic, slightly optimized cleanup) ---
  useEffect(() => {
    const initializeChat = async () => {
      setLoading(true);
      const user = await getUserDetails(apiUrl);
      if (!user) {
        Alert.alert('Authentication Error', 'Could not verify user. Please login again.');
        setLoading(false);
        navigation.goBack();
        return;
      }
      setCurrentUserId(user.id);
      await fetchChatMessages(user.id);
      setupSocket(user.id);
      setLoading(false);
    };

    initializeChat();

    // Cleanup on unmount
    return () => {
      if (socketRef.current?.connected) {
        console.log('Disconnecting socket...');
        socketRef.current.disconnect();
      }
      socketRef.current = null; // Ensure ref is cleared
    };
  }, [chatSessionId]); // Dependency array remains correct

  // Optional: Add effect to listen for theme changes
  // useEffect(() => {
  //   const subscription = Appearance.addChangeListener(({ colorScheme }) => {
  //     setColorScheme(colorScheme);
  //   });
  //   return () => subscription.remove();
  // }, []);

  // --- API and Socket Functions (Keep core logic) ---
  const fetchChatMessages = async (userId: string) => {
    // setLoading(true); // Handled in initializeChat
    const token = await getToken();
    if (!token) {
      Alert.alert('Authentication Error', 'Session expired. Please login.');
      setLoading(false); // Stop loading if token fails here
      return;
    }
    try {
      const fetchedMessages = await fetchData(apiUrl, `api/chat/${chatSessionId}/messages`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      }) as Message[];

      if (Array.isArray(fetchedMessages)) {
        setMessages(fetchedMessages.slice().reverse()); // Use slice() to avoid modifying original if needed elsewhere
      } else {
        console.error('Fetched messages is not an array:', fetchedMessages);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      Alert.alert('Error', 'An error occurred while fetching messages.');
      setMessages([]);
    }
    // setLoading(false); // Handled in initializeChat
  };

  const setupSocket = async (userId: string) => {
    const token = await getToken();
    if (!token) {
      Alert.alert('Authentication Error', 'Cannot establish real-time connection. Please login.');
      return;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    console.log('Setting up socket connection...');
    const manager = new Manager(apiUrl, {
      reconnectionAttempts: 5,
      reconnectionDelay: 2000, // Slightly increased delay
      extraHeaders: {
        Authorization: `Bearer ${token}`,
      },
      transports: ['websocket'], // Prioritize WebSocket
    });
    socketRef.current = manager.socket('/');

    socketRef.current.on('connect', () => {
      console.log(`Socket connected: ${socketRef.current?.id}`);
      socketRef.current?.emit('authenticate', userId);
      console.log(`Emitted authenticate for user ID: ${userId}`);
      socketRef.current?.emit('joinChatRoom', chatSessionId);
      console.log(`Attempted to join chat room: ${chatSessionId}`);
    });

    socketRef.current.on('receiveMessage', (message: Message) => {
      console.log('Received message via socket:', message);
      // Add new message to the start for inverted list
      setMessages((prevMessages) => [message, ...prevMessages]);
      // Consider scrollToOffset instead of scrollToEnd for inverted list
      // flatListRef.current?.scrollToOffset({ animated: true, offset: 0 });
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      // Optional: Display a subtle banner indicating disconnection
    });

    socketRef.current.on('connect_error', (err: Error) => {
      console.error('Socket connection error:', err.message);
      console.error('Full connection error object:', err);
      // Less intrusive error reporting for connection blips
      // Consider a status indicator instead of Alert for non-auth errors
       if (err.message.includes('Authentication error') || err.message.includes('Unauthorized')) {
           Alert.alert('Connection Error', 'Authentication failed for real-time updates.');
       }
    });

     socketRef.current.on('joinedRoom', (room) => {
        console.log(`Successfully joined room: ${room}`);
     });

     socketRef.current.on('joinRoomError', (error: { message?: string }) => {
        console.error(`Error joining room ${chatSessionId}:`, error);
        Alert.alert('Chat Error', `Could not join the chat room: ${error?.message || 'Unknown error'}`);
     });
  };

  const sendMessage = () => {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage) return; // Prevent sending empty spaces

    if (!socketRef.current || !socketRef.current.connected) {
      Alert.alert('Cannot Send', 'You are not connected to the chat service.');
      console.warn('Attempted to send message while socket was not ready or disconnected.');
      return;
    }

    console.log(`Sending message: "${trimmedMessage}" to chat: ${chatSessionId}`);
    socketRef.current.emit('sendMessage', {
      chatSessionId: chatSessionId,
      content: trimmedMessage,
    });

    setNewMessage('');
  };

  // --- Rendering ---
  const renderMessage = ({ item }: { item: Message }) => {
    const isCurrentUser = item.sender._id === currentUserId;

    let messageTime = '';
    try {
      if (item.createdAt && !isNaN(new Date(item.createdAt).getTime())) {
        messageTime = new Date(item.createdAt).toLocaleTimeString([], {
          hour: 'numeric', // Use 'numeric' for cleaner look (e.g., 5:30 PM)
          minute: '2-digit',
          hour12: true,
        });
      } else {
        console.warn("Invalid createdAt date received:", item.createdAt);
      }
    } catch (e) {
      console.error("Error formatting date:", item.createdAt, e);
    }

    return (
      <View style={[styles.messageRow, isCurrentUser ? styles.sentRow : styles.receivedRow]}>
        <View style={[styles.messageBubbleBase, isCurrentUser ? styles.sentBubble : styles.receivedBubble]}>
          {/* Only show sender name for received messages from others */}
          {!isCurrentUser && (
            <Text style={styles.senderName}>{item.sender?.name || 'User'}</Text>
          )}
          <Text style={[styles.messageText, isCurrentUser && styles.sentMessageText]}>
            {item.content}
          </Text>
          <Text style={[styles.messageTimestamp, isCurrentUser ? styles.sentTimestamp : styles.receivedTimestamp]}>
            {messageTime}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          {/* Keep the Nav Bar consistent during loading */}
          <View style={styles.navBar}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <FontAwesome name="arrow-left" size={22} color={AppColors.primary} />
            </TouchableOpacity>
            <View style={styles.navTitleContainer}>
              <Text style={styles.navTitle}>Live Chat</Text>
            </View>
            <View style={styles.navBarRightPlaceholder} /> {/* Balance the back button */}
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={AppColors.primary} />
            <Text style={styles.loadingText}>Loading Chat...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#FFFFFF', '#EBF2FF']} style={styles.gradient}>
       {/* Use a slightly different gradient */}
      <SafeAreaView style={styles.safeArea}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <FontAwesome name="arrow-left" size={22} color={AppColors.primary} />
          </TouchableOpacity>
          <View style={styles.navTitleContainer}>
             <Text style={styles.navTitle}>Live Chat</Text>
             {/* Optionally add subtitle or status here */}
          </View>
          <View style={styles.navBarRightPlaceholder} /> {/* Balance the back button */}
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingContainer}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 65 : 0} // Fine-tune this offset
        >
          {/* Message List */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item._id}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContentContainer}
            inverted // Keep inverted for chat UIs
            showsVerticalScrollIndicator={false} // Hide scrollbar for cleaner look
            // Optional: Add initial scroll index or maintain scroll position logic if needed
            // initialScrollIndex={messages.length > 0 ? messages.length - 1 : 0} // Might not work perfectly with inverted
            // onContentSizeChange={() => flatListRef.current?.scrollToOffset({ animated: false, offset: 0 })} // Scroll to bottom on size change
          />

          {/* Input Area */}
          <View style={styles.inputAreaContainer}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type a message..."
                placeholderTextColor={AppColors.placeholder}
                multiline
                selectionColor={AppColors.primary} // Cursor color
              />
              <TouchableOpacity
                style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
                onPress={sendMessage}
                disabled={!newMessage.trim()}
              >
                <FontAwesome name="send" size={20} color={AppColors.white} style={styles.sendIcon}/>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

// --- Enhanced Styles ---

// Define reusable colors
const AppColors = {
  primary: '#006AFF', // A vibrant blue
  secondary: '#F0F3F5', // Light grey for received bubbles/input background
  backgroundGradientStart: '#FFFFFF',
  backgroundGradientEnd: '#EBF2FF', // Softer blue gradient end
  sentBubble: '#007AFF', // Classic iOS blue for sent
  receivedBubble: '#E5E5EA', // Classic iOS grey for received
  textPrimary: '#0D0D0D', // Almost black for readability
  textSecondary: '#FFFFFF', // White text for dark bubbles
  textSubtle: '#6B7280', // Grey for timestamps, sender names
  placeholder: '#9CA3AF',
  white: '#FFFFFF',
  lightBorder: '#E1E4E8',
  shadowColor: '#000000', // For iOS shadows
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent', // Let gradient show through
  },
  // --- Nav Bar ---
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10, // Reduced horizontal padding
    paddingVertical: 8,
    backgroundColor: AppColors.white,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.lightBorder,
    height: Platform.OS === 'ios' ? 55 : 60, // Adjust height slightly
    justifyContent: 'space-between', // Use space-between for centering
  },
  backButton: {
    padding: 8, // Increase tap area
  },
  navTitleContainer: {
    flex: 1, // Allow title container to take up space
    alignItems: 'center', // Center title horizontally
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '600', // Semi-bold
    color: AppColors.textPrimary,
  },
  navBarRightPlaceholder: {
    width: 40, // Match approx width of back button for balance
    padding: 8, // Keep consistent padding
  },
  // --- Keyboard Avoiding & List ---
  keyboardAvoidingContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 12, // Consistent horizontal padding
  },
  messagesContentContainer: {
    paddingTop: 15, // Space from top (visually bottom in inverted)
    paddingBottom: 10, // Space from input area
  },
  // --- Message Bubbles ---
  messageRow: {
    flexDirection: 'row',
    marginVertical: 6, // Adjusted vertical spacing
  },
  sentRow: {
    justifyContent: 'flex-end',
    marginLeft: 60, // Keep pushing sent messages left
  },
  receivedRow: {
    justifyContent: 'flex-start',
    marginRight: 60, // Keep pushing received messages right
  },
  messageBubbleBase: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20, // Increased rounding
    maxWidth: '100%', // Ensure bubble doesn't overflow row padding
    // iOS Shadow
    shadowColor: AppColors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1.5,
    // Android Shadow
    elevation: 2,
  },
  sentBubble: {
    backgroundColor: AppColors.sentBubble,
    borderBottomRightRadius: 5, // Tail effect
  },
  receivedBubble: {
    backgroundColor: AppColors.receivedBubble,
    borderBottomLeftRadius: 5, // Tail effect
  },
  senderName: {
    fontSize: 12,
    fontWeight: '500', // Medium weight
    color: AppColors.textSubtle,
    marginBottom: 4, // Space below name
    textTransform: 'capitalize', // Optional: Capitalize sender names
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22, // Improve readability
    color: AppColors.textPrimary,
  },
  sentMessageText: {
    color: AppColors.textSecondary,
  },
  messageTimestamp: {
    fontSize: 11,
    color: AppColors.textSubtle, // Default subtle color
    marginTop: 5,
    alignSelf: 'flex-end', // Position timestamp bottom-right
  },
  sentTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)', // Lighter timestamp for dark background
  },
  receivedTimestamp: {
    color: AppColors.textSubtle, // Keep subtle grey for light background
  },
  // --- Input Area ---
  inputAreaContainer: {
    borderTopWidth: 1,
    borderTopColor: AppColors.lightBorder,
    backgroundColor: AppColors.white, // Input area background
    paddingBottom: Platform.OS === 'ios' ? 5 : 0, // Adjust padding for different platforms if needed below input
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end', // Align items to bottom, good for multiline
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 42, // Slightly taller input
    maxHeight: 110,
    backgroundColor: AppColors.secondary, // Use light grey background
    borderRadius: 21, // Match button height/2
    paddingHorizontal: 16,
    paddingVertical: 10, // Adjust vertical padding
    fontSize: 16,
    lineHeight: 20, // Adjust line height for multiline
    marginRight: 10,
    color: AppColors.textPrimary, // Ensure text color is set
  },
  sendButton: {
    backgroundColor: AppColors.primary,
    width: 42, // Circular button
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 0 : 1, // Align button nicely with input bottom
  },
  sendButtonDisabled: {
    backgroundColor: '#AABBDD', // Lighter blue when disabled
  },
  sendIcon: {
    marginLeft: 2, // Fine-tune icon position within button
  },
  // --- Loading State ---
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent', // Use gradient background
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: AppColors.primary, // Use primary color
    fontWeight: '500',
  },
});

export default LiveChatScreen;

// --- Placeholder for ../api/api.ts content (Keep your existing functions) ---
/*
export const getToken = async (): Promise<string | null> => { ... };
export const fetchData = async (apiUrl: string, endpoint: string, options: RequestInit = {}) => { ... };
*/

// --- Placeholder for ../api/apiUrl.ts content ---
/*
export const apiUrl = 'YOUR_API_BASE_URL'; // e.g., 'http://localhost:3000' or 'https://your-api.com'
*/