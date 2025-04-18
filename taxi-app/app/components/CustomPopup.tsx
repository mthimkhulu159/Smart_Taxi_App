// components/CustomPopup.tsx
import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Define valid types for the icon names (mapping custom types to Ionicons names)
type IconName = 'checkmark-circle' | 'close-circle' | 'alert-circle' | 'information-circle';

// Extend the props to accept the `type` and map it to an icon name
interface CustomPopupProps {
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    detailedMessage?: string; // Optional detailed message for error/debugging
    onClose: () => void;
    onRetry?: () => void; // Optional retry handler for server errors
}

// Map the types to valid Ionicons icon names
const typeToIconMap: Record<'success' | 'error' | 'warning' | 'info', IconName> = {
    success: 'checkmark-circle',
    error: 'close-circle',
    warning: 'alert-circle',
    info: 'information-circle',
};

const CustomPopup: React.FC<CustomPopupProps> = ({
    visible,
    message,
    type,
    detailedMessage,
    onClose,
    onRetry
}) => {
    const fadeAnim = React.useRef(new Animated.Value(0)).current; // Fade-in animation
    const translateYAnim = React.useRef(new Animated.Value(200)).current; // Slide-up animation

    // When the popup is visible, start the fade and slide animations
    React.useEffect(() => {
        if (visible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
                easing: Easing.out(Easing.ease),
            }).start();

            Animated.timing(translateYAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
                easing: Easing.out(Easing.ease),
            }).start();
        } else {
             // Reset animations when hidden
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 300, // Faster fade out
                useNativeDriver: true,
                easing: Easing.in(Easing.ease),
            }).start();

            Animated.timing(translateYAnim, {
                toValue: 200, // Slide down
                duration: 300, // Faster slide out
                useNativeDriver: true,
                easing: Easing.in(Easing.ease),
            }).start();
        }
    }, [visible, fadeAnim, translateYAnim]); // Added fadeAnim, translateYAnim to deps

    // Use the type to get the correct icon name
    const iconName = typeToIconMap[type];

    // Determine the colors, icon, and button actions based on the type
    let backgroundColor, buttonText, buttonAction;
    let iconColor = 'white'; // Default icon color

    // Adjust background color and button text based on type
    switch (type) {
        case 'success':
            backgroundColor = '#4CAF50'; // Green for success
            buttonText = 'Okay';
            buttonAction = onClose; // Success button just closes
            break;
        case 'error':
            backgroundColor = '#F44336'; // Red for error
            buttonText = onRetry ? 'Retry' : 'Close'; // Button text is Retry if onRetry is provided, otherwise Close
            buttonAction = onRetry || onClose; // Button action is onRetry if provided, otherwise onClose
            break;
        case 'warning':
            backgroundColor = '#FF9800'; // Orange for warning
            buttonText = 'Got it';
            buttonAction = onClose;
            break;
        case 'info':
            backgroundColor = '#2196F3'; // Blue for info
            buttonText = 'Dismiss';
            buttonAction = onClose;
            break;
        default: // Fallback
            backgroundColor = '#2196F3';
            buttonText = 'Dismiss';
            buttonAction = onClose;
            break;
    }

    // Determine text color for the modal content based on background brightness
    const contentTextColor = ['#F44336', '#FF9800'].includes(backgroundColor) ? '#FFFFFF' : '#333'; // White text for red/orange backgrounds, dark for others


    return (
        <Modal
            animationType="none" // Controlled by Animated.View
            transparent={true}
            visible={visible}
            onRequestClose={onClose} // Allows hardware back button to close on Android
        >
            <View style={styles.modalOverlay}>
                <Animated.View
                    style={[
                        styles.modalContent,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: translateYAnim }],
                            backgroundColor, // Apply type-based background color
                        },
                    ]}
                >
                    {/* Close Button (Always white/light for visibility on colored backgrounds) */}
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={32} color="#FFFFFF" />
                    </TouchableOpacity>

                    {/* Icon & Message */}
                    {/* Icon color is always white */}
                    <Ionicons name={iconName} size={60} color={iconColor} />
                    {/* Message text color adapts */}
                    <Text style={[styles.message, { color: contentTextColor }]}>{message}</Text>

                    {/* Detailed Message for Errors */}
                    {detailedMessage && (
                         // Detailed message text color adapts
                        <Text style={[styles.detailedMessage, { color: contentTextColor === '#333' ? '#666' : 'rgba(255,255,255,0.8)' }]}>
                            {detailedMessage}
                        </Text>
                    )}

                    {/* Action Button */}
                    <TouchableOpacity onPress={buttonAction} style={styles.actionButton}>
                        <Text style={styles.actionButtonText}>{buttonText}</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // Dimmed background with opacity
    },
    modalContent: {
        width: '85%', // Slightly wider modal
        maxWidth: 400, // Max width for larger screens
        padding: 30,
        borderRadius: 20, // Slightly less rounded
        // borderWidth: 1, // Removed border, relying on shadow/elevation
        // borderColor: '#E4E4E4',
        alignItems: 'center',
        justifyContent: 'center',
        // backgroundColor is set dynamically
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10, // For Android
    },
    closeButton: {
        position: 'absolute',
        top: 10, // Closer to the edge
        right: 10, // Closer to the edge
        padding: 8, // Smaller touch area
        backgroundColor: 'rgba(255,255,255,0.2)', // Semi-transparent white circle
        borderRadius: 18, // Make it circular
        zIndex: 1, // Ensure it's above other content
    },
    message: {
        fontSize: 18, // Slightly smaller font for main message
        fontWeight: 'bold',
        // color is set dynamically
        textAlign: 'center',
        marginVertical: 15, // Reduced vertical margin
        lineHeight: 25, // Adjusted line height
    },
    detailedMessage: {
        fontSize: 13, // Smaller font for details
        // color is set dynamically
        textAlign: 'center',
        marginTop: 8, // Reduced top margin
        paddingHorizontal: 5, // Reduced horizontal padding
        fontStyle: 'italic', // Italicize detailed message
    },
    actionButton: {
        marginTop: 25, // Increased top margin
        paddingVertical: 12, // Slightly less vertical padding
        paddingHorizontal: 30,
        backgroundColor: '#FFFFFF', // White button background
        borderRadius: 25, // More rounded button
        minWidth: 120, // Ensure minimum width
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3, // Add shadow to button
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    actionButtonText: {
        color: '#333', // Dark text for white button
        fontSize: 16,
        fontWeight: '600',
    },
});

export default CustomPopup;
