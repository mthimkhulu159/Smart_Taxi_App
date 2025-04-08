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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome } from '@expo/vector-icons'; // Using FontAwesome for icons
import { useNavigation, useRoute } from '@react-navigation/native';
import { getToken, fetchData } from '../api/api'; // Assuming these are correctly set up
import { Manager, Socket } from 'socket.io-client';

// Interface for the message structure
interface Message {
  _id: string;
  sender: {
    _id: string;
    name: string;
    email: string; // Keep email if needed, otherwise can remove
  };
  content: string;
  createdAt: string; // ISO string format expected
}

// Interface for user details fetched from the API
interface UserDetails {
  id: string;
  // Add other relevant user details if needed
}

// Function to fetch current user details
const getUserDetails = async (apiUrl: string): Promise<UserDetails | null> => {
  const token = await getToken();
  if (!token) {
    console.error('Authentication token not found.');
    return null;
  }

  try {
    // Corrected: Removed generic type argument, added 'as' assertion
    const response = await fetchData(apiUrl, 'api/users/get-user', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }) as { user: UserDetails }; // Assert the expected shape

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

const LiveChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { chatSessionId } = route.params as { chatSessionId: string };

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); // Store current user ID
  const socketRef = useRef<Socket | null>(null); // Use specific Socket type
  const flatListRef = useRef<FlatList<Message>>(null); // Ref for FlatList

  // Define API URL (consider moving to a config file)
const apiUrl = "https://qmarshal.onrender.com"
 
  // --- Effects ---

  // Initial setup: Fetch user details, messages, and set up socket
  useEffect(() => {
    const initializeChat = async () => {
      setLoading(true);
      const user = await getUserDetails(apiUrl);
      if (!user) {
        Alert.alert('Authentication Error', 'Could not verify user. Please login again.');
        setLoading(false);
        navigation.goBack(); // Go back if user details fail
        return;
      }
      setCurrentUserId(user.id); // Set current user ID state

      await fetchChatMessages(user.id); // Fetch initial messages
      setupSocket(user.id); // Setup socket connection *after* getting user ID

      setLoading(false);
    };

    initializeChat();

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        console.log('Disconnecting socket...');
        socketRef.current.disconnect();
        socketRef.current = null; // Clear the ref
      }
    };
  }, [chatSessionId]); // Rerun if chatSessionId changes

  // --- API and Socket Functions ---

  // Fetch historical chat messages
  const fetchChatMessages = async (userId: string) => {
    // No need to set loading here, handled in initializeChat
    const token = await getToken();
    if (!token) {
      Alert.alert('Authentication Error', 'Session expired. Please login.');
      // Handle re-authentication or redirect
      return;
    }

    try {
       // Corrected: Removed generic type argument, added 'as' assertion
      const fetchedMessages = await fetchData(apiUrl, `api/chat/${chatSessionId}/messages`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      }) as Message[]; // Assert the expected shape (array of Message)

      if (fetchedMessages) {
        // Reverse messages for inverted FlatList display (newest at the bottom)
        // Ensure fetchedMessages is actually an array before reversing
        if (Array.isArray(fetchedMessages)) {
            setMessages(fetchedMessages.reverse());
        } else {
            console.error('Fetched messages is not an array:', fetchedMessages);
            setMessages([]); // Set to empty array if data is invalid
        }
      } else {
        Alert.alert('Error', 'Failed to fetch chat messages.');
        setMessages([]); // Set to empty array on failure
      }
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      Alert.alert('Error', 'An error occurred while fetching messages.');
      setMessages([]); // Set to empty array on error
    }
    // No finally setLoading(false) here, handled in initializeChat
  };

  // Setup Socket.IO connection
  const setupSocket = async (userId: string) => {
    const token = await getToken(); // Get token again for socket connection
    if (!token) {
      Alert.alert('Authentication Error', 'Cannot establish real-time connection. Please login.');
      return;
    }

    // Disconnect existing socket if any before creating a new one
    if (socketRef.current) {
        socketRef.current.disconnect();
    }

    console.log('Setting up socket connection...');
    const manager = new Manager(apiUrl, {
      reconnectionAttempts: 5, // Optional: Limit reconnection attempts
      reconnectionDelay: 1000, // Optional: Delay between attempts
      extraHeaders: {
        Authorization: `Bearer ${token}`, // Send token for initial connection auth if backend needs it
      },
    });

    socketRef.current = manager.socket('/'); // Connect to the default namespace

    socketRef.current.on('connect', () => {
      console.log(`Socket connected with ID: ${socketRef.current?.id}`);
      // Emit authentication event with user ID *after* connection is established
      // Ensure your backend expects 'authenticate' with the user ID
      socketRef.current?.emit('authenticate', userId);
      console.log(`Emitted authenticate for user ID: ${userId}`);

      // Join the specific chat room
      socketRef.current?.emit('joinChatRoom', chatSessionId);
      console.log(`Attempted to join chat room: ${chatSessionId}`);
    });

    // Listen for new messages
    socketRef.current.on('receiveMessage', (message: Message) => {
      console.log('Received message via socket:', message);
      // Add new message to the beginning of the array for inverted FlatList
      setMessages((prevMessages) => [message, ...prevMessages]);
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      // Optionally handle reconnection logic or inform user
    });

    // Corrected: Handle connect_error safely
    socketRef.current.on('connect_error', (err: Error) => { // Explicitly type err as Error
        console.error('Socket connection error:', err.message); // Log the guaranteed message
        console.error('Full connection error object:', err); // Log the full object to see its structure if needed
        // Alert only on critical errors, e.g., auth failure indicated by message
        if (err.message.includes('Authentication error') || err.message.includes('Unauthorized')) { // Check message content
           Alert.alert('Connection Error', 'Authentication failed for real-time updates.');
        } else {
           // Maybe implement a subtle indicator for connection issues
        }
    });

    // Optional: Listen for successful room join confirmation from backend
    socketRef.current.on('joinedRoom', (room) => {
        console.log(`Successfully joined room: ${room}`);
    });

    // Optional: Handle errors related to joining the room
    socketRef.current.on('joinRoomError', (error: { message?: string }) => { // Type error minimally
        console.error(`Error joining room ${chatSessionId}:`, error);
        Alert.alert('Chat Error', `Could not join the chat room: ${error?.message || 'Unknown error'}`);
    });
  };

  // Send a new message
  const sendMessage = () => {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || !socketRef.current || !socketRef.current.connected) {
        if (!trimmedMessage) return; // Don't send empty messages
        Alert.alert('Cannot Send', 'You are not connected to the chat service.');
        console.warn('Attempted to send message while socket was not ready or disconnected.');
      return;
    }

    // Optimistic UI update (optional but improves perceived speed)
    // Note: Requires a temporary ID and potentially a 'sending' status
    // For simplicity, we'll rely on the 'receiveMessage' event from the server

    console.log(`Sending message: "${trimmedMessage}" to chat: ${chatSessionId}`);
    socketRef.current.emit('sendMessage', {
      chatSessionId: chatSessionId,
      content: trimmedMessage,
      // Sender info is usually added by the backend based on the authenticated socket
    });

    setNewMessage(''); // Clear the input field
  };


  // --- Rendering ---

  // Render individual message item
  const renderMessage = ({ item }: { item: Message }) => {
    // Determine if the message is from the current logged-in user
    const isCurrentUser = item.sender._id === currentUserId;

    // Format timestamp (example: 10:30 AM)
    let messageTime = '';
    try {
        // Check if createdAt is a valid date string before formatting
        if(item.createdAt && !isNaN(new Date(item.createdAt).getTime())){
           messageTime = new Date(item.createdAt).toLocaleTimeString([], {
               hour: '2-digit',
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
      <View
        style={[
          styles.messageRow,
          isCurrentUser ? styles.sentRow : styles.receivedRow,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isCurrentUser ? styles.sentBubble : styles.receivedBubble,
          ]}
        >
          {/* Show sender name only for received messages */}
          {!isCurrentUser && (
            <Text style={styles.senderName}>{item.sender?.name || 'User'}</Text>
          )}
          {/* Apply white text color for sent messages */}
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

  // Show loading indicator while fetching initial data
  if (loading) {
    return (
      <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          {/* Keep the Nav Bar consistent */}
          <View style={styles.navBar}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <FontAwesome name="arrow-left" size={20} color="#003E7E" />
            </TouchableOpacity>
            <Text style={styles.navTitle}>Live Chat</Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#003E7E" />
            <Text style={styles.loadingText}>Loading Chat...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Main chat screen UI
  return (
    <LinearGradient colors={['#FFFFFF', '#E8F0FE']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <FontAwesome name="arrow-left" size={20} color="#003E7E" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Live Chat</Text>
          {/* Add more icons or info here if needed */}
        </View>

        {/* Keyboard Avoiding View wraps the list and input */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingContainer}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0} // Adjust offset as needed
        >
          {/* Message List */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item._id}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContentContainer}
            inverted // Crucial for chat layout (new messages at the bottom)
            // Optional: Keep scroll position stable when new messages arrive (if not using inverted)
            // onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            // onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />

          {/* Input Area */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type your message..."
              placeholderTextColor="#999"
              multiline // Allow multiline input
            />
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={!newMessage.trim()}>
              <FontAwesome name="send" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

// --- Styles ---

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF', // Slightly different background for nav
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0', // Softer border color
    height: 60, // Standard nav bar height (adjust as needed for different devices/OS)
  },
  backButton: {
    padding: 5, // Easier to tap
    marginRight: 15,
  },
  navTitle: {
    fontSize: 18, // Slightly smaller title
    fontWeight: '600', // Semi-bold
    color: '#003E7E',
  },
  keyboardAvoidingContainer: {
    flex: 1, // Takes remaining space
  },
  messagesContainer: {
    flex: 1, // Takes up available space above input
    paddingHorizontal: 10, // Padding on the sides of the list
  },
  messagesContentContainer: {
     paddingTop: 10, // Add some padding at the top (which is visually the bottom in inverted)
     paddingBottom: 5, // Padding at the bottom (visually the top)
  },
  messageRow: {
    flexDirection: 'row', // Align bubble container within the row
    marginVertical: 5, // Space between message rows
  },
  sentRow: {
    justifyContent: 'flex-end', // Pushes bubble to the right
    marginLeft: 50, // Ensure sent messages don't take full width
  },
  receivedRow: {
    justifyContent: 'flex-start', // Pushes bubble to the left
    marginRight: 50, // Ensure received messages don't take full width
  },
  messageBubble: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18, // More rounded corners
    maxWidth: '100%', // Max width relative to the row container
  },
  sentBubble: {
    backgroundColor: '#007AFF', // Classic blue for sent messages
     // Make bottom-right corner less rounded for a 'tail' effect (optional)
     borderBottomRightRadius: 5,
  },
  receivedBubble: {
    backgroundColor: '#E5E5EA', // Light grey for received messages
    // Make bottom-left corner less rounded
    borderBottomLeftRadius: 5,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666', // Darker grey for name
    marginBottom: 3, // Space between name and message
  },
  messageText: {
    fontSize: 16,
    color: '#000000', // Default black for received text
  },
  // Specific text color for sent messages for contrast
  sentMessageText: {
    color: '#FFFFFF',
  },
   messageTimestamp: {
      fontSize: 10,
      color: '#888', // Grey timestamp
      marginTop: 4, // Space above timestamp
      alignSelf: 'flex-end', // Timestamp to the right within the bubble
   },
   sentTimestamp: {
      color: '#E0E0E0', // Lighter timestamp for dark background
   },
   receivedTimestamp: {
      color: '#666666', // Darker timestamp for light background
   },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center', // Align items vertically, esp. for multiline input
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF', // Input area background
  },
  input: {
    flex: 1,
    minHeight: 40, // Minimum height
    maxHeight: 120, // Max height for multiline
    backgroundColor: '#F0F0F0', // Input field background
    borderRadius: 20, // Rounded input field
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'ios' ? 10 : 8, // Adjust padding top for different platforms
    paddingBottom: Platform.OS === 'ios' ? 10 : 8, // Adjust padding bottom
    fontSize: 16,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20, // Make button circular or oval
    width: 40, // Fixed width
    height: 40, // Fixed height
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3, // Slight adjustment for send icon centering
  },
  // sendButtonText is removed as we are using an Icon
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#003E7E',
  },
});

// Remember to export the component
export default LiveChatScreen;

// --- Placeholder for ../api/api.ts content ---
/*
// Example structure for api.ts (ensure yours exports these functions)

// Function to get the authentication token (e.g., from AsyncStorage)
export const getToken = async (): Promise<string | null> => {
  // Replace with your actual token retrieval logic
  // import AsyncStorage from '@react-native-async-storage/async-storage';
  // return await AsyncStorage.getItem('userToken');
  console.log('getToken() called - returning placeholder token'); // Development log
  return 'dummy-auth-token-123'; // Replace with actual token logic
};

// Function to fetch data from the API
// IMPORTANT: This version is NOT generic, as per the user's error messages.
// It likely returns 'any' or 'unknown' implicitly or explicitly.
export const fetchData = async (apiUrl: string, endpoint: string, options: RequestInit = {}) => {
  try {
    const response = await fetch(`${apiUrl}/${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers, // Allows overriding Content-Type and adding others like Authorization
      },
    });

    // Basic check for response status
    if (!response.ok) {
        const errorBody = await response.text(); // Read error body as text
        console.error(`HTTP error! Status: ${response.status} on ${endpoint}`, errorBody);
         // Specific handling for common errors
         if (response.status === 401 || response.status === 403) {
             Alert.alert('Authentication Error', 'Your session may have expired or access is denied. Please log in again.');
             // TODO: Add logic to navigate to login screen or refresh token
         } else {
             Alert.alert('Error', `Failed to fetch data: ${response.status}`);
         }
        // Throwing an error might be better for upstream try/catch blocks
        // throw new Error(`HTTP error ${response.status}: ${errorBody}`);
        return null; // Return null to indicate failure gracefully within the function callers
    }

    // Check if response has content before parsing JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
       const data = await response.json();
       return data; // Return the parsed JSON data (implicitly 'any' or 'unknown')
    } else {
        // Handle non-JSON responses if necessary (e.g., plain text or empty 204 response)
        console.log(`Received non-JSON response from ${endpoint} (Content-Type: ${contentType})`);
        // For empty responses (like 204 No Content), returning null might be appropriate
        if (response.status === 204) {
            return null;
        }
        // Otherwise, return the text content or handle as needed
        return await response.text();
    }
  } catch (error) {
    console.error('Network or fetch error:', error);
    // Handle network errors (e.g., no internet, DNS issues)
    Alert.alert('Network Error', 'Could not connect to the server. Please check your internet connection.');
    // throw error; // Re-throwing allows upstream components to handle it
    return null; // Return null to indicate failure gracefully
  }
};
*/