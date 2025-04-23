import React, { useState, useEffect } from 'react';
import {
    TouchableOpacity, // Use TouchableOpacity for better styling
    Text,
    StyleSheet,
    ActivityIndicator,
    Alert,
    ViewStyle, // Type for style prop
    StyleProp, // Base type for style props
    TextStyle, // Type for text style prop
} from 'react-native';

// --- Required Imports (Ensure these paths are correct for your project) ---

// Assuming your api functions (fetchData, getToken) are exported from '../api/api.ts'
import { fetchData, getToken } from '../api/api';
// Assuming your base API URL is exported from '../api/apiUrl.ts'
import { apiUrl } from '../api/apiUrl';
// Assuming your CustomConfirm component is in './CustomConfirm.tsx' or '../components/CustomConfirm.tsx'
import CustomConfirm from './CustomConfirm'; // Adjust path as needed

// --- Configuration ---
const DELETE_ACCOUNT_ENDPOINT = 'api/users/delete-account';
const CANCEL_DELETE_ACCOUNT_ENDPOINT = 'api/users/cancel-delete-account';

// --- Interfaces ---
interface AccountDeletionButtonProps {
  /** The initial deletion status passed from the parent component */
  initialDeletionStatus: boolean;
  /** Optional: Callback function to notify parent of status change */
  onDeletionStatusChange?: (isPending: boolean) => void;
  /** Optional: Custom style for the TouchableOpacity button container */
  style?: StyleProp<ViewStyle>;
  /** Optional: Custom style for the button text */
  textStyle?: StyleProp<TextStyle>;
}

// --- Component ---
const AccountDeletionButton: React.FC<AccountDeletionButtonProps> = ({
  initialDeletionStatus,
  onDeletionStatusChange,
  style, // Custom container style from props
  textStyle, // Custom text style from props
}) => {
  // --- State ---
  // Tracks if deletion is pending, synced with the prop
  const [isDeletionPending, setIsDeletionPending] = useState<boolean>(initialDeletionStatus);
  // Tracks if an API call is in progress
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // Controls the visibility of the custom confirmation modal
  const [isConfirmVisible, setIsConfirmVisible] = useState<boolean>(false);

  // --- Effect ---
  // Update the local state if the prop changes after the component mounts
  useEffect(() => {
    setIsDeletionPending(initialDeletionStatus);
  }, [initialDeletionStatus]);

  // --- Action Handlers ---

  /**
   * Opens the custom confirmation modal to ask before requesting deletion.
   */
  const promptForDeleteRequest = () => {
    // Prevent opening if already submitting
    if (isSubmitting) return;
    setIsConfirmVisible(true); // Show the custom confirm modal
  };

  /**
   * Executes the API call to request account deletion after user confirms.
   */
  const confirmAndDelete = async () => {
    setIsConfirmVisible(false); // Hide the modal
    setIsSubmitting(true); // Show loading indicator

    try {
      console.log(`Requesting account deletion via ${apiUrl}/${DELETE_ACCOUNT_ENDPOINT}`);
      // Ensure user is authenticated
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not found. Please log in.');
      }

      // Make the API call to request deletion
      await fetchData(apiUrl, DELETE_ACCOUNT_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log('Account deletion requested successfully.');
      // Update local state
      setIsDeletionPending(true);
      // Notify parent component if callback is provided
      if (onDeletionStatusChange) {
        onDeletionStatusChange(true);
      }

      // Show success feedback using standard Alert
      Alert.alert(
        'Account Deletion Requested',
        'Your account is scheduled for deletion in 7 days. You can cancel this process anytime within this period.',
        [{ text: 'OK' }]
      );

    } catch (err: any) {
      console.error('Error requesting account deletion:', err);
      // Show error feedback using standard Alert
      const errorMessage = err.message || 'Failed to request account deletion. Please try again.';
      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
      // Note: We don't set the component's error state, just show the alert
    } finally {
      setIsSubmitting(false); // Hide loading indicator regardless of outcome
    }
  };

  /**
   * Handles the 'Cancel' action from the custom confirmation modal.
   */
  const cancelDeletePrompt = () => {
    setIsConfirmVisible(false); // Just hide the modal
  };


  /**
   * Executes the API call to cancel a *pending* account deletion request.
   * This is triggered directly by the button when deletion is already pending.
   */
  const handleCancelPendingDeletion = async () => {
     // Prevent action if already submitting
    if (isSubmitting) return;
    setIsSubmitting(true); // Show loading indicator

    try {
      console.log(`Cancelling account deletion via ${apiUrl}/${CANCEL_DELETE_ACCOUNT_ENDPOINT}`);
       // Ensure user is authenticated
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not found. Please log in.');
      }

      // Make the API call to cancel deletion
      await fetchData(apiUrl, CANCEL_DELETE_ACCOUNT_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log('Account deletion cancelled successfully.');
       // Update local state
      setIsDeletionPending(false);
       // Notify parent component if callback is provided
      if (onDeletionStatusChange) {
        onDeletionStatusChange(false);
      }

      // Show success feedback using standard Alert
      Alert.alert(
        'Deletion Cancelled',
        'Your account deletion request has been cancelled.',
        [{ text: 'OK' }]
      );

    } catch (err: any) {
      console.error('Error cancelling account deletion:', err);
       // Show error feedback using standard Alert
      const errorMessage = err.message || 'Failed to cancel account deletion. Please try again.';
      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
       // Note: We don't set the component's error state, just show the alert
    } finally {
      setIsSubmitting(false); // Hide loading indicator regardless of outcome
    }
  };

  // --- Render Logic ---

  // Determine button text and action based on the current deletion status
  const buttonText = isDeletionPending ? 'Cancel Account Deletion' : 'Delete Account';
  const buttonAction = isDeletionPending ? handleCancelPendingDeletion : promptForDeleteRequest;

  // Determine base styles based on state
  const baseButtonStyle = isDeletionPending ? styles.cancelButtonBase : styles.deleteButtonBase;
  const baseTextStyle = styles.buttonTextBase;

  return (
    // Use React Fragment to return multiple elements without a wrapper View
    <>
      {/* The main button element */}
      <TouchableOpacity
        // Apply styles: base style, then custom style from props, then submitting style
        style={[
            styles.buttonBase, // Common base styles
            baseButtonStyle,    // State-specific base style (color)
            style,              // Custom style prop override
            isSubmitting && styles.submitting // Style when loading
        ]}
        onPress={buttonAction}
        disabled={isSubmitting} // Disable button during API calls
        activeOpacity={0.7} // Standard feedback on press
      >
        {/* Show ActivityIndicator when submitting, otherwise show Text */}
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={[baseTextStyle, textStyle]}>{buttonText}</Text> // Apply base text style, then custom text style prop
        )}
      </TouchableOpacity>

      {/* The Custom Confirmation Modal (conditionally visible) */}
      <CustomConfirm
        visible={isConfirmVisible}
        message="Are you sure you want to request account deletion? This process takes 7 days and can be cancelled during that time."
        onCancel={cancelDeletePrompt} // Action for the modal's cancel button
        onConfirm={confirmAndDelete} // Action for the modal's confirm button
      />
    </>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  // Base styles applicable to the button regardless of state (delete/cancel)
  buttonBase: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 45, // Ensures consistent button height
    elevation: 2, // Shadow for Android
    shadowColor: '#000', // Shadow for iOS
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    marginVertical: 10, // Default spacing, can be overridden by style prop
  },
  // Style specific to the 'Delete Account' state
  deleteButtonBase: {
    backgroundColor: '#ff3b30', // Red color
  },
  // Style specific to the 'Cancel Account Deletion' state
  cancelButtonBase: {
    backgroundColor: '#ffae42', // Orange color
  },
  // Base style for the text inside the button
  buttonTextBase: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Style applied to the button when an API call is in progress
  submitting: {
    backgroundColor: '#cccccc', // Greyed out
    elevation: 0, // Remove shadow
    shadowOpacity: 0,
  },
});

export default AccountDeletionButton;
