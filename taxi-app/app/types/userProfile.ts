
export interface UserProfile {
    _id: string;
    name: string;
    email: string;
    phone: string;
    role: string[];
    profilePic?: string;
    roleUpgradeRequested: boolean;
    isDeletionRequested: boolean;
}
