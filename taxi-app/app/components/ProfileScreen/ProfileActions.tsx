import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ActionButton from '../common/ActionButton'; // Adjust path as needed
import AccountDeletionButton from '../AccountDeletion'; // Adjust path as needed
import { colors } from '../../constants/colors'; // Adjust path as needed

interface ProfileActionsProps {
    isDriver: boolean;
    isUpgradePending: boolean;
    onUpgradeRole: () => void;
    isUpgrading: boolean;
    onManageTaxis: () => void;
    onLogout: () => void;
    onDeletionStatusChange: (isPending: boolean) => void;
    initialDeletionStatus: boolean;
}

const ProfileActions: React.FC<ProfileActionsProps> = ({
    isDriver,
    isUpgradePending,
    onUpgradeRole,
    isUpgrading,
    onManageTaxis,
    onLogout,
    onDeletionStatusChange,
    initialDeletionStatus,
}) => {
    return (
        <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Actions</Text>
            {/* Conditional Upgrade Button */}
            {!isDriver && (
                <ActionButton
                    title={isUpgradePending ? "Upgrade Request Pending" : "Upgrade to Driver"}
                    onPress={onUpgradeRole}
                    iconName="rocket-outline"
                    loading={isUpgrading}
                    style={{ marginBottom: 15 }}
                    disabled={isUpgrading || isUpgradePending}
                />
            )}
            {/* Conditional Manage Taxi Button */}
            {isDriver && (
                <ActionButton
                    title="Manage My Taxis"
                    onPress={onManageTaxis}
                    iconName="settings-outline"
                    style={{ marginBottom: 15 }}
                    color="#1E88E5"
                />
            )}
            {/* Logout Button */}
            <ActionButton title="Logout" onPress={onLogout} iconName="log-out-outline" color={colors.error} style={{ marginBottom: 10 }} />
            {/* Account Deletion Button */}
            <AccountDeletionButton
                initialDeletionStatus={initialDeletionStatus}
                onDeletionStatusChange={onDeletionStatusChange}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    sectionCard: {
        backgroundColor: colors.white,
        borderRadius: 10,
        padding: 15,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: 15,
    },
});

export default ProfileActions;