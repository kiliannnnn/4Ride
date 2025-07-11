import { createSignal, For, Show, onMount, createResource, createEffect, onCleanup } from 'solid-js';
import Icon from './Icon';
import { listFriendships, deleteFriendship, getFriendshipByUser, createFriendship, updateFriendship, getPendingInvitesSender, getPendingInvitesReceiver } from '@/lib/services/friendshipsServices';
import { listUserProfiles } from '@/lib/services/userProfileServices';
import { createConversation, getConversationsForUser } from '@/lib/services/conversationsServices';
import { createConversationParticipant, getParticipantsByConversation } from '@/lib/services/conversationParticipantsServices';
import { createMessage, getMessagesByConversation } from '@/lib/services/messagesServices';
import { supabase } from '@/lib/supabase';
import { tCommunity } from '@/lib/utils';
import type { Tables } from '@/database.types';
import type { lang } from '@/lib/utils';

interface CommunityProps {
    user?: { id: string } | null;
    lang?: string;
}

interface FriendWithProfile {
    friendship: Tables<'friendships'>;
    profile: Tables<'user_profile'>;
}

interface ConversationWithParticipants {
    conversation: Tables<'conversations'>;
    participants: Tables<'conversation_participants'>[];
    participantProfiles: Tables<'user_profile'>[];
    lastMessage?: Tables<'messages'>;
    unreadCount?: number;
}

interface MessageWithProfile {
    message: Tables<'messages'>;
    senderProfile: Tables<'user_profile'> | null;
}

interface Conversation {
    id: number;
    name?: string;
    type: 'private' | 'group';
    lastMessage?: string;
    lastMessageTime?: string;
    participants: string[];
    unreadCount?: number;
}

interface Message {
    id: number;
    content: string;
    senderId: string;
    senderName: string;
    timestamp: string;
    isOwn: boolean;
}

export default function Community(props: CommunityProps) {
    const userId = props.user?.id || "current-user";
    
    // Make lang reactive to prop changes
    const lang = () => (['fr', 'es', 'jp'].includes(props.lang as string) ? props.lang as lang : 'en');
    
    // State management
    const [activeTab, setActiveTab] = createSignal<'conversations' | 'friends'>('conversations');
    const [selectedConversation, setSelectedConversation] = createSignal<number | null>(null);
    const [newMessage, setNewMessage] = createSignal('');
    const [searchQuery, setSearchQuery] = createSignal('');
    const [mounted, setMounted] = createSignal(false);
    const [friendsWithProfiles, setFriendsWithProfiles] = createSignal<FriendWithProfile[]>([]);
    const [sentInvites, setSentInvites] = createSignal<FriendWithProfile[]>([]);
    const [receivedInvites, setReceivedInvites] = createSignal<FriendWithProfile[]>([]);
    const [loadingFriends, setLoadingFriends] = createSignal(true);
    const [userSearchQuery, setUserSearchQuery] = createSignal('');
    const [searchResults, setSearchResults] = createSignal<Tables<'user_profile'>[]>([]);
    const [loadingSearch, setLoadingSearch] = createSignal(false);
    
    // Real conversation state
    const [conversationsData, setConversationsData] = createSignal<ConversationWithParticipants[]>([]);
    const [loadingConversations, setLoadingConversations] = createSignal(true);
    const [selectedMessages, setSelectedMessages] = createSignal<MessageWithProfile[]>([]);
    const [loadingMessages, setLoadingMessages] = createSignal(false);
    const [sendingMessage, setSendingMessage] = createSignal(false);
    
    // Conversation creation state
    const [conversationName, setConversationName] = createSignal('');
    const [selectedParticipants, setSelectedParticipants] = createSignal<FriendWithProfile[]>([]);
    const [participantSearchQuery, setParticipantSearchQuery] = createSignal('');
    const [creatingConversation, setCreatingConversation] = createSignal(false);

    // Real-time subscription state
    let messagesSubscription: any = null;
    
    // New conversation state for messaging friends
    const [newConversationWithUserId, setNewConversationWithUserId] = createSignal<string | null>(null);

    // Fetch friends data
    const fetchFriendsData = async () => {
        try {
            setLoadingFriends(true);
            const [friendships, pendingInvitesSent, pendingInvitesReceived, userProfiles] = await Promise.all([
                getFriendshipByUser(userId),
                getPendingInvitesSender(userId),
                getPendingInvitesReceiver(userId),
                listUserProfiles()
            ]);            

            // Helper function to create FriendWithProfile
            const createFriendWithProfile = (friendship: Tables<'friendships'>): FriendWithProfile | null => {
                const friendUserId = friendship.user_1_id === userId ? friendship.user_2_id : friendship.user_1_id;
                const friendProfile = userProfiles.find(profile => profile.user_id === friendUserId);
                
                return friendProfile ? { friendship, profile: friendProfile } : null;
            };

            // Process accepted friendships
            const friendsData: FriendWithProfile[] = [];
            for (const friendship of friendships) {
                const friendData = createFriendWithProfile(friendship);
                if (friendData) friendsData.push(friendData);
            }

            // Process sent invites
            const sentInvitesData: FriendWithProfile[] = [];
            for (const invite of pendingInvitesSent) {
                const friendData = createFriendWithProfile(invite);
                if (friendData) sentInvitesData.push(friendData);
            }

            // Process received invites
            const receivedInvitesData: FriendWithProfile[] = [];
            for (const invite of pendingInvitesReceived) {
                const friendData = createFriendWithProfile(invite);
                if (friendData) receivedInvitesData.push(friendData);
            }

            setFriendsWithProfiles(friendsData);
            setSentInvites(sentInvitesData);
            setReceivedInvites(receivedInvitesData);
        } catch (error) {
            console.error('❌ fetchFriendsData: Error fetching friends data:', error);
        } finally {
            setLoadingFriends(false);
        }
    };

    // Fetch conversations data
    const fetchConversationsData = async () => {
        try {
            setLoadingConversations(true);
            const [userConversations, userProfiles] = await Promise.all([
                getConversationsForUser(userId),
                listUserProfiles()
            ]);

            const conversationsWithDetails: ConversationWithParticipants[] = [];

            // Process conversations in parallel for better performance
            const conversationPromises = userConversations.map(async (conversation) => {
                try {
                    const [participants, messages] = await Promise.all([
                        getParticipantsByConversation(conversation.id),
                        getMessagesByConversation(conversation.id)
                    ]);
                    
                    // Get participant profiles
                    const participantProfiles = participants
                        .map(p => userProfiles.find(profile => profile.user_id === p.user_id))
                        .filter(Boolean) as Tables<'user_profile'>[];

                    const lastMessage = messages[messages.length - 1];

                    return {
                        conversation,
                        participants,
                        participantProfiles,
                        lastMessage,
                        unreadCount: 0 // TODO: Implement unread count logic
                    };
                } catch (error) {
                    console.error(`❌ Error processing conversation ${conversation.id}:`, error);
                    return null;
                }
            });

            const results = await Promise.all(conversationPromises);
            const validConversations = results.filter(Boolean) as ConversationWithParticipants[];

            // Sort by last message time (most recent first)
            validConversations.sort((a, b) => {
                const timeA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
                const timeB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
                return timeB - timeA;
            });

            setConversationsData(validConversations);
        } catch (error) {
            console.error('❌ fetchConversationsData: Error fetching conversations data:', error);
        } finally {
            setLoadingConversations(false);
        }
    };

    // Fetch messages for selected conversation
    const fetchMessages = async (conversationId: number) => {
        try {
            setLoadingMessages(true);
            const [messages, userProfiles] = await Promise.all([
                getMessagesByConversation(conversationId),
                listUserProfiles()
            ]);

            const messagesWithProfiles: MessageWithProfile[] = messages.map(message => ({
                message,
                senderProfile: userProfiles.find(profile => profile.user_id === message.sender_id) || null
            }));

            setSelectedMessages(messagesWithProfiles);
        } catch (error) {
            console.error('❌ fetchMessages: Error fetching messages:', error);
        } finally {
            setLoadingMessages(false);
        }
    };

    // Get conversation IDs that the user is part of
    const getUserConversationIds = async (): Promise<number[]> => {
        try {
            const { data: participants, error } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .eq('user_id', userId);

            if (error) {
                console.error('Error fetching user conversations:', error);
                return [];
            }

            return participants?.map(p => p.conversation_id) || [];
        } catch (error) {
            console.error('Error in getUserConversationIds:', error);
            return [];
        }
    };

    // Setup real-time message subscriptions
    const setupMessageSubscriptions = async () => {
        try {
            // Cleanup existing subscription
            if (messagesSubscription) {
                await messagesSubscription.unsubscribe();
                messagesSubscription = null;
            }

            // Get conversation IDs the user is part of
            const conversationIds = await getUserConversationIds();
            
            if (conversationIds.length === 0) {
                console.log('No conversations to subscribe to');
                return;
            }

            console.log('Subscribing to conversations:', conversationIds);

            // Create filter for conversation IDs
            const conversationFilter = conversationIds.length === 1 
                ? `conversation_id=eq.${conversationIds[0]}`
                : `conversation_id=in.(${conversationIds.join(',')})`;

            // Subscribe to message changes
            messagesSubscription = supabase
                .channel('messages-changes')
                .on(
                    'postgres_changes',
                    { 
                        event: '*', 
                        schema: 'public', 
                        table: 'messages', 
                        filter: conversationFilter 
                    },
                    async (payload) => {
                        console.log('Message change received:', payload);
                        
                        // If it's a new message in the currently selected conversation
                        const currentConversationId = selectedConversation();
                        if (payload.eventType === 'INSERT' && payload.new?.conversation_id === currentConversationId && currentConversationId !== null) {
                            // Refresh messages for the current conversation
                            await fetchMessages(currentConversationId);
                        }
                        
                        // Always refresh conversations list to update last message
                        await fetchConversationsData();
                    }
                )
                .subscribe((status) => {
                    console.log('Subscription status:', status);
                });

        } catch (error) {
            console.error('Error setting up message subscriptions:', error);
        }
    };

    onMount(async () => {
        setMounted(true);
        await Promise.all([
            fetchFriendsData(),
            fetchConversationsData()
        ]);
        // Setup real-time subscriptions after initial data load
        await setupMessageSubscriptions();
    });

    // Effect to load messages when conversation is selected
    createEffect(() => {
        const conversationId = selectedConversation();
        if (conversationId) {
            fetchMessages(conversationId);
        } else {
            setSelectedMessages([]);
        }
    });

    // Debounced search effect - only run when add friend modal might be open
    let searchTimeoutId: ReturnType<typeof setTimeout> | undefined;
    
    createEffect(() => {
        const query = userSearchQuery();
        const currentTab = activeTab();
        
        // Clear previous timeout
        if (searchTimeoutId) {
            clearTimeout(searchTimeoutId);
            searchTimeoutId = undefined;
        }
        
        // Only proceed if we're on the friends tab - this prevents unnecessary searches
        if (currentTab !== 'friends') {
            return;
        }
        
        // Clear results immediately if query is empty
        if (!query.trim()) {
            setSearchResults([]);
            setLoadingSearch(false);
            return;
        }
        
        // Set loading state for immediate feedback
        setLoadingSearch(true);
        
        // Set timeout for debounced search
        searchTimeoutId = setTimeout(async () => {
            try {
                await handleSearchUsers();
            } catch (error) {
                console.error('❌ Debounced search error:', error);
                setLoadingSearch(false);
            }
        }, 500); // 500ms delay
    });

    // Cleanup timeout on component unmount
    onCleanup(async () => {
        if (searchTimeoutId) {
            clearTimeout(searchTimeoutId);
        }
        // Cleanup message subscription
        if (messagesSubscription) {
            await messagesSubscription.unsubscribe();
            messagesSubscription = null;
        }
    });

    const handleSendMessage = async () => {
        const messageContent = newMessage().trim();
        let conversationId = selectedConversation();
        const newConvUserId = newConversationWithUserId();
        
        if (!messageContent) return;

        try {
            setSendingMessage(true);
            
            // If this is a new conversation (conversationId === -1), create it first
            if (conversationId === -1 && newConvUserId) {
                console.log('Creating new private conversation with user:', newConvUserId);
                
                // Create new private conversation
                const newConversation = await createConversation({
                    type: 'private',
                    name: null, // Private conversations don't need names
                    description: null
                });

                if (!newConversation?.id) {
                    throw new Error('Failed to create conversation');
                }

                conversationId = newConversation.id;

                // Add both participants to the conversation
                await Promise.all([
                    createConversationParticipant({
                        conversation_id: conversationId,
                        user_id: userId
                    }),
                    createConversationParticipant({
                        conversation_id: conversationId,
                        user_id: newConvUserId
                    })
                ]);

                // Update state to reflect the new conversation
                setSelectedConversation(conversationId);
                setNewConversationWithUserId(null);
                
                console.log('✅ Private conversation created with ID:', conversationId);
            }

            if (!conversationId || conversationId === -1) return;
            
            // Create the message
            await createMessage({
                content: messageContent,
                conversation_id: conversationId,
                sender_id: userId
            });

            // Clear the input
            setNewMessage('');
            
            // Refresh messages
            await fetchMessages(conversationId);
            
            // Refresh conversations to update list and include new conversation
            await fetchConversationsData();
            
            // Refresh subscriptions to include the new conversation
            if (newConvUserId) {
                await setupMessageSubscriptions();
            }
            
            console.log('✅ Message sent successfully');
        } catch (error) {
            console.error('❌ handleSendMessage: Error sending message:', error);
            alert(tCommunity(lang(), 'errorSendMessage'));
        } finally {
            setSendingMessage(false);
        }
    };

    const handleKeyPress = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleMessageFriend = async (friendUserId: string) => {
        try {
            // Look for existing private conversation between the two users
            const existingConversation = conversationsData().find(convData => {
                const conv = convData.conversation;
                if (conv.type !== 'private') return false;
                
                // Check if this conversation has exactly these two participants
                const participantIds = convData.participantProfiles.map(p => p.user_id);
                return participantIds.length === 2 && 
                       participantIds.includes(userId) && 
                       participantIds.includes(friendUserId);
            });

            if (existingConversation) {
                setSelectedConversation(existingConversation.conversation.id);
            } else {
                setSelectedConversation(-1); // Special ID for new conversation
                setNewConversationWithUserId(friendUserId);
                setSelectedMessages([]); // Clear messages as this is a new conversation
            }
        } catch (error) {
            console.error('Error in handleMessageFriend:', error);
        }
    };

    const handleDeleteFriend = async (friendshipId: number) => {
        try {
            await deleteFriendship(friendshipId);
            // Refresh friends list
            await fetchFriendsData();
        } catch (error) {
            console.error('❌ handleDeleteFriend: Error deleting friendship:', error);
        }
    };

    const handleAcceptFriendRequest = async (friendshipId: number) => {
        try {
            await updateFriendship(friendshipId, { status: 'accepted' });
            console.log('✅ Friend request accepted');
            // Refresh friends list
            await fetchFriendsData();
        } catch (error) {
            console.error('❌ Error accepting friend request:', error);
        }
    };

    const handleDeclineFriendRequest = async (friendshipId: number) => {
        try {
            await updateFriendship(friendshipId, { status: 'rejected' });
            console.log('✅ Friend request declined');
            // Refresh friends list
            await fetchFriendsData();
        } catch (error) {
            console.error('❌ Error declining friend request:', error);
        }
    };

    const handleBlockFriendRequest = async (friendshipId: number) => {
        try {
            await updateFriendship(friendshipId, { status: 'blocked' });
            console.log('✅ Friend request blocked');
            // Refresh friends list
            await fetchFriendsData();
        } catch (error) {
            console.error('❌ Error blocking friend request:', error);
        }
    };

    const handleCancelFriendRequest = async (friendshipId: number) => {
        try {
            await deleteFriendship(friendshipId);
            console.log('✅ Friend request cancelled');
            // Refresh friends list
            await fetchFriendsData();
        } catch (error) {
            console.error('❌ Error cancelling friend request:', error);
        }
    };

    const handleSearchUsers = async () => {
        const query = userSearchQuery().trim();
        if (!query) {
            setSearchResults([]);
            return;
        }

        try {
            setLoadingSearch(true);
            const allUsers = await listUserProfiles();
            
            // Filter users by username
            const filteredUsers = allUsers.filter(user => 
                user.user_id !== userId && // Exclude current user
                user.username.toLowerCase().includes(query.toLowerCase())
            );

            // Get all existing friend/invite user IDs to exclude them
            const currentFriends = friendsWithProfiles().map(friend => 
                friend.friendship.user_1_id === userId ? friend.friendship.user_2_id : friend.friendship.user_1_id
            );
            const sentInviteUsers = sentInvites().map(invite => 
                invite.friendship.user_1_id === userId ? invite.friendship.user_2_id : invite.friendship.user_1_id
            );
            const receivedInviteUsers = receivedInvites().map(invite => 
                invite.friendship.user_1_id === userId ? invite.friendship.user_2_id : invite.friendship.user_1_id
            );
            
            const excludedUsers = [...currentFriends, ...sentInviteUsers, ...receivedInviteUsers];
            
            const availableUsers = filteredUsers.filter(user => 
                !excludedUsers.includes(user.user_id || '')
            );

            setSearchResults(availableUsers);
        } catch (error) {
            console.error('❌ handleSearchUsers: Error searching users:', error);
        } finally {
            setLoadingSearch(false);
        }
    };

    const handleAddFriend = async (targetUserId: string) => {
        try {
            await createFriendship({
                user_1_id: userId,
                user_2_id: targetUserId,
                status: 'pending'
            });
            
            console.log('✅ Friend request sent');
            // Remove user from search results
            setSearchResults(prev => prev.filter(user => user.user_id !== targetUserId));
            // Refresh friends data to show new sent invite
            await fetchFriendsData();
        } catch (error) {
            console.error('❌ handleAddFriend: Error sending friend request:', error);
        }
    };

    const handleCreateConversation = async () => {
        try {
            setCreatingConversation(true);
            
            const participants = selectedParticipants();
            const name = conversationName().trim();
            
            // Validate input
            if (participants.length === 0) {
                console.error('❌ No participants selected');
                alert(tCommunity(lang(), 'errorSelectParticipants'));
                return;
            }
            
            // Determine conversation type: private if only 1 participant (+ current user), group otherwise
            const conversationType: 'private' | 'group' = participants.length === 1 ? 'private' : 'group';
            
            // For private conversations, name is optional (can be derived from participants)
            // For group conversations, name is required
            if (conversationType === 'group' && !name) {
                console.error('❌ Group conversation name is required');
                alert(tCommunity(lang(), 'errorConversationName'));
                return;
            }
            
            // Create the conversation
            const conversation = await createConversation({
                name: conversationType === 'group' ? name : null,
                type: conversationType,
                description: null
            });
            
            if (!conversation) {
                throw new Error('Failed to create conversation');
            }
            
            // Add all participants to the conversation
            const participantPromises = [];
            
            // Add current user as participant
            participantPromises.push(
                createConversationParticipant({
                    conversation_id: conversation.id,
                    user_id: userId
                })
            );
            
            // Add selected participants
            for (const participant of participants) {
                const participantUserId = participant.friendship.user_1_id === userId 
                    ? participant.friendship.user_2_id 
                    : participant.friendship.user_1_id;
                    
                participantPromises.push(
                    createConversationParticipant({
                        conversation_id: conversation.id,
                        user_id: participantUserId
                    })
                );
            }
            
            await Promise.all(participantPromises);
            
            console.log('✅ Conversation created successfully');
            
            // Close modal
            (document.getElementById('new_conversation_modal') as HTMLDialogElement)?.close();
            
            // Reset form state
            resetConversationForm();
            
            // Refresh conversations list
            await fetchConversationsData();
            
            // Refresh subscriptions to include the new conversation
            await setupMessageSubscriptions();
            
        } catch (error) {
            console.error('❌ handleCreateConversation: Error creating conversation:', error);
            alert(tCommunity(lang(), 'errorCreateConversation'));
        } finally {
            setCreatingConversation(false);
        }
    };

    const handleAddParticipant = (friend: FriendWithProfile) => {
        const current = selectedParticipants();
        if (!current.find(p => p.friendship.id === friend.friendship.id)) {
            setSelectedParticipants([...current, friend]);
        }
    };

    const handleRemoveParticipant = (friendshipId: number) => {
        setSelectedParticipants(prev => prev.filter(p => p.friendship.id !== friendshipId));
    };

    const resetConversationForm = () => {
        setConversationName('');
        setSelectedParticipants([]);
        setParticipantSearchQuery('');
        setCreatingConversation(false);
    };

    const filteredConversations = () => {
        const query = searchQuery().toLowerCase();
        const convs = conversationsData();
        return convs.filter((convData: ConversationWithParticipants) => {
            const conversation = convData.conversation;
            const lastMessageContent = convData.lastMessage?.content || '';
            return (
                conversation.name?.toLowerCase().includes(query) || 
                lastMessageContent.toLowerCase().includes(query)
            );
        });
    };

    const filteredFriends = () => {
        const query = searchQuery().toLowerCase();
        const friends = friendsWithProfiles();
        return friends.filter((friendData: FriendWithProfile) => 
            friendData.profile.username.toLowerCase().includes(query)
        );
    };

    const filteredSentInvites = () => {
        const query = searchQuery().toLowerCase();
        const invites = sentInvites();
        return invites.filter((inviteData: FriendWithProfile) => 
            inviteData.profile.username.toLowerCase().includes(query)
        );
    };

    const filteredReceivedInvites = () => {
        const query = searchQuery().toLowerCase();
        const invites = receivedInvites();
        return invites.filter((inviteData: FriendWithProfile) => 
            inviteData.profile.username.toLowerCase().includes(query)
        );
    };

    const filteredAvailableParticipants = () => {
        const query = participantSearchQuery().toLowerCase();
        const friends = friendsWithProfiles(); // Only accepted friends can be added to conversations
        const selected = selectedParticipants();
        
        return friends.filter((friendData: FriendWithProfile) => {
            const matchesSearch = friendData.profile.username.toLowerCase().includes(query);
            const notSelected = !selected.find(p => p.friendship.id === friendData.friendship.id);
            return matchesSearch && notSelected;
        });
    };

    const getConversationTitle = (convData: ConversationWithParticipants) => {
        const conversation = convData.conversation;
        if (conversation.type === 'group') {
            return conversation.name || tCommunity(lang(), 'privateConversation');
        }
        
        // For private conversations, show the other participant's name
        const otherParticipant = convData.participantProfiles.find(p => p.user_id !== userId);
        return otherParticipant?.username || tCommunity(lang(), 'privateConversation');
    };

    const getLastMessageTime = (convData: ConversationWithParticipants) => {
        if (!convData.lastMessage) return '';
        
        const messageDate = new Date(convData.lastMessage.created_at);
        const now = new Date();
        const diffHours = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60));
        
        if (diffHours < 1) return tCommunity(lang(), 'just_now');
        if (diffHours < 24) return `${diffHours} ${tCommunity(lang(), 'hours_ago')}`;
        if (diffHours < 48) return tCommunity(lang(), 'yesterday');
        
        return messageDate.toLocaleDateString();
    };

    const selectedConversationData = () => {
        const convId = selectedConversation();
        return convId && convId !== -1 ? conversationsData().find((c: ConversationWithParticipants) => c.conversation.id === convId) : null;
    };

    const getNewConversationTitle = () => {
        const newConvUserId = newConversationWithUserId();
        if (!newConvUserId) return tCommunity(lang(), 'newConversation');
        
        // Find the friend's profile
        const friendData = friendsWithProfiles().find(f => 
            (f.friendship.user_1_id === newConvUserId && f.friendship.user_2_id === userId) ||
            (f.friendship.user_2_id === newConvUserId && f.friendship.user_1_id === userId)
        );
        
        return friendData ? friendData.profile.username : tCommunity(lang(), 'newConversation');
    };

    return (
        <Show when={mounted()} fallback={
            <div class="relative w-full overflow-hidden flex items-center justify-center min-h-screen p-2 sm:p-4 md:p-6 lg:p-8">
                <div class="loading loading-spinner loading-lg text-primary"></div>
            </div>
        }>
            <div class="relative w-full overflow-hidden flex items-center justify-center min-h-screen p-2 sm:p-4 md:p-6 lg:p-8">
                {/* Background */}
                <div class="absolute inset-0 z-0">
                    <img src="/assets/images/biker.webp" alt="Background" class="w-full h-full object-cover object-center opacity-50" />
                </div>

                {/* Main Container */}
                <div class="overflow-hidden relative z-10 w-full max-w-sm sm:max-w-6xl md:max-w-7xl lg:max-w-8xl rounded-lg sm:rounded-3xl shadow-2xl bg-base-100/90 backdrop-blur-lg flex flex-col md:flex-row items-stretch justify-center h-[600px] md:h-[700px] lg:h-[750px] overflow-y-auto" style={{ 'max-width': '1600px' }}>
                
                {/* Mobile Header */}
                <div class="md:hidden p-3 sm:p-4 border-b border-base-300">
                    <h2 class="text-lg sm:text-xl font-bold text-primary flex items-center gap-2 justify-center">
                        <Icon name="groups" class="w-5 h-5 sm:w-6 sm:h-6" />
                        {tCommunity(lang(), 'title')}
                    </h2>
                </div>

                {/* Main Content Area */}
                <div class="flex flex-col md:flex-row flex-1 min-h-0">
                
                {/* Mobile/Tablet View - Separate Sections */}
                <div class="md:hidden flex flex-col flex-1 min-h-0 p-0">
                    {/* Show chat if conversation is selected, otherwise show sections */}
                    <Show when={selectedConversation() !== null} fallback={
                        <div class="flex flex-col flex-1 overflow-y-auto">
                            {/* Conversations Section */}
                            <div class="p-3 sm:p-4 border-b border-base-300">
                                <div class="flex items-center justify-between mb-3">
                                    <h3 class="text-base sm:text-lg font-semibold flex items-center gap-2">
                                        <Icon name="chat" class="w-4 h-4 sm:w-5 sm:h-5" />
                                        {tCommunity(lang(), 'conversations')}
                                    </h3>
                                    <button 
                                        class="btn btn-primary btn-sm"
                                        onClick={() => (document.getElementById('new_conversation_modal') as HTMLDialogElement)?.showModal()}
                                    >
                                        <Icon name="add" class="w-3 h-3 sm:w-4 sm:h-4" />
                                        <span class="hidden sm:inline">{tCommunity(lang(), 'new')}</span>
                                    </button>
                                </div>
                                
                                {/* Conversations Search */}
                                <input 
                                    type="text" 
                                    placeholder={tCommunity(lang(), 'searchConversations')} 
                                    class="input input-bordered input-sm sm:input-md w-full text-xs sm:text-sm mb-3"
                                    value={searchQuery()}
                                    onInput={(e) => setSearchQuery(e.target.value)}
                                />
                                
                                {/* Conversations List */}
                                <div class="space-y-2 max-h-64 overflow-y-auto">
                                    <Show when={loadingConversations()} fallback={
                                        <Show when={filteredConversations().length > 0} fallback={
                                            <div class="text-center py-4 text-base-content/70">
                                                <Icon name="chat" class="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                <p class="text-sm">{tCommunity(lang(), 'noConversations')}</p>
                                            </div>
                                        }>
                                            <For each={filteredConversations()}>
                                                {(convData) => (
                                                    <div 
                                                        class="card bg-base-200 hover:bg-base-300 cursor-pointer transition-all"
                                                        onClick={() => {
                                                            setSelectedConversation(convData.conversation.id);
                                                            setNewConversationWithUserId(null);
                                                        }}
                                                    >
                                                        <div class="card-body p-3">
                                                            <div class="flex items-start justify-between">
                                                                <div class="flex-1 min-w-0">
                                                                    <div class="flex items-center gap-2 mb-1">
                                                                        <Icon 
                                                                            name={convData.conversation.type === 'group' ? 'groups' : 'person_outline'} 
                                                                            class="w-3 h-3 sm:w-4 sm:h-4 text-primary flex-shrink-0" 
                                                                        />
                                                                        <h4 class="font-semibold text-xs sm:text-sm truncate">
                                                                            {getConversationTitle(convData)}
                                                                        </h4>
                                                                    </div>
                                                                    <p class="text-xs text-base-content/70 truncate">
                                                                        {convData.lastMessage?.content || tCommunity(lang(), 'noMessage')}
                                                                    </p>
                                                                </div>
                                                                <span class="text-xs text-base-content/50">
                                                                    {getLastMessageTime(convData)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </For>
                                        </Show>
                                    }>
                                        <div class="flex justify-center p-4">
                                            <div class="loading loading-spinner loading-sm text-primary"></div>
                                        </div>
                                    </Show>
                                </div>
                            </div>
                            
                            {/* Friends Section */}
                            <div class="p-3 sm:p-4 flex-1">
                                <div class="flex items-center justify-between mb-3">
                                    <h3 class="text-base sm:text-lg font-semibold flex items-center gap-2">
                                        <Icon name="person_fill" class="w-4 h-4 sm:w-5 sm:h-5" />
                                        {tCommunity(lang(), 'friends')}
                                    </h3>
                                    <button 
                                        class="btn btn-primary btn-sm"
                                        onClick={() => (document.getElementById('add_friend_modal') as HTMLDialogElement)?.showModal()}
                                    >
                                        <Icon name="add" class="w-3 h-3 sm:w-4 sm:h-4" />
                                        <span class="hidden sm:inline">{tCommunity(lang(), 'add')}</span>
                                    </button>
                                </div>
                                
                                {/* Friends Search */}
                                <input 
                                    type="text" 
                                    placeholder={tCommunity(lang(), 'searchFriends')} 
                                    class="input input-bordered input-sm sm:input-md w-full text-xs sm:text-sm mb-3"
                                    value={searchQuery()}
                                    onInput={(e) => setSearchQuery(e.target.value)}
                                />
                                
                                {/* Friends Content */}
                                <div class="space-y-2 overflow-y-auto">
                                    <Show when={loadingFriends()} fallback={
                                        <div>
                                            {/* Received Friend Requests */}
                                            <Show when={filteredReceivedInvites().length > 0}>
                                                <div class="mb-3">
                                                    <h4 class="text-xs sm:text-sm font-semibold text-warning flex items-center gap-1 mb-2">
                                                        <Icon name="person_fill" class="w-3 h-3" />
                                                        {tCommunity(lang(), 'requestsReceived')} ({filteredReceivedInvites().length})
                                                    </h4>
                                                    <For each={filteredReceivedInvites()}>
                                                        {(inviteData) => (
                                                            <div class="card bg-warning/10 border border-warning/20 mb-2">
                                                                <div class="card-body p-3">
                                                                    <div class="flex items-center justify-between">
                                                                        <div class="flex items-center gap-2">
                                                                            <Icon name="helmet" class="w-4 h-4 text-base-content" />
                                                                            <div>
                                                                                <h5 class="font-semibold text-xs">{inviteData.profile.username}</h5>
                                                                                <p class="text-xs text-base-content/70">{inviteData.profile.mileage?.toLocaleString()} km</p>
                                                                            </div>
                                                                        </div>
                                                                        <div class="flex gap-1">
                                                                            <button 
                                                                                class="btn btn-success btn-xs"
                                                                                onClick={() => handleAcceptFriendRequest(inviteData.friendship.id)}
                                                                            >
                                                                                <Icon name="person_fill" class="w-3 h-3" />
                                                                            </button>
                                                                            <button 
                                                                                class="btn btn-error btn-xs"
                                                                                onClick={() => handleDeclineFriendRequest(inviteData.friendship.id)}
                                                                            >
                                                                                <Icon name="person_outline" class="w-3 h-3" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </For>
                                                </div>
                                            </Show>

                                            {/* Friends List */}
                                            <Show when={filteredFriends().length > 0}>
                                                <div class="mb-3">
                                                    <h4 class="text-xs sm:text-sm font-semibold text-success flex items-center gap-1 mb-2">
                                                        <Icon name="person_fill" class="w-3 h-3" />
                                                        {tCommunity(lang(), 'friendsCount')} ({filteredFriends().length})
                                                    </h4>
                                                    <For each={filteredFriends()}>
                                                        {(friendData) => (
                                                            <div 
                                                                class="card bg-base-200 hover:bg-base-300 cursor-pointer transition-all mb-2"
                                                                onClick={() => handleMessageFriend(friendData.friendship.user_1_id === userId ? friendData.friendship.user_2_id : friendData.friendship.user_1_id)}
                                                            >
                                                                <div class="card-body p-3">
                                                                    <div class="flex items-center justify-between">
                                                                        <div class="flex items-center gap-2">
                                                                            <Icon name="helmet" class="w-4 h-4 text-base-content" />
                                                                            <div>
                                                                                <h5 class="font-semibold text-xs">{friendData.profile.username}</h5>
                                                                                <p class="text-xs text-base-content/70">{friendData.profile.mileage?.toLocaleString()} km</p>
                                                                            </div>
                                                                        </div>
                                                                        <Icon name="chat" class="w-4 h-4 text-primary" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </For>
                                                </div>
                                            </Show>

                                            {/* No Results Message */}
                                            <Show when={filteredReceivedInvites().length === 0 && filteredFriends().length === 0}>
                                                <div class="text-center py-4 text-base-content/70">
                                                    <Icon name="person_outline" class="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                    <p class="text-sm">{tCommunity(lang(), 'noFriendsFound')}</p>
                                                </div>
                                            </Show>
                                        </div>
                                    }>
                                        <div class="flex justify-center p-4">
                                            <div class="loading loading-spinner loading-sm text-primary"></div>
                                        </div>
                                    </Show>
                                </div>
                            </div>
                        </div>
                    }>
                        {/* Mobile Chat View */}
                        <div class="flex flex-col min-h-[calc(100vh-120px)] sm:min-h-[calc(100vh-140px)] h-full">
                            {/* Chat Header */}
                            <div class="flex items-center justify-between p-3 sm:p-4 border-b border-base-300 bg-base-200">
                                <button 
                                    class="btn btn-ghost btn-sm mr-2"
                                    onClick={() => setSelectedConversation(null)}
                                >
                                    <Icon name="left-arr" class="w-4 h-4" />
                                </button>
                                
                                <div class="flex items-center gap-2 flex-1">
                                    <Icon 
                                        name={selectedConversationData()?.conversation.type === 'group' ? 'groups' : 'person_outline'} 
                                        class="w-5 h-5 text-primary" 
                                    />
                                    <div class="min-w-0 flex-1">
                                        <h3 class="font-semibold text-sm truncate">
                                            <Show 
                                                when={selectedConversationData()} 
                                                fallback={getNewConversationTitle()}
                                            >
                                                {getConversationTitle(selectedConversationData()!)}
                                            </Show>
                                        </h3>
                                    </div>
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div class="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 bg-base-100/50 min-h-0">
                                <Show when={loadingMessages()} fallback={
                                    <For each={selectedMessages()}>
                                        {(messageData) => {
                                            const isOwn = messageData.message.sender_id === userId;
                                            const senderName = isOwn ? tCommunity(lang(), 'me') : (messageData.senderProfile?.username || tCommunity(lang(), 'unknownUser'));
                                            
                                            return (
                                                <div class={`chat ${isOwn ? 'chat-end' : 'chat-start'}`}>
                                                    <div class="chat-image avatar">
                                                        <div class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary text-primary-content flex items-center justify-center">
                                                            <span class="text-xs font-bold">{senderName.charAt(0).toUpperCase()}</span>
                                                        </div>
                                                    </div>
                                                    <div class="chat-header text-xs opacity-50 mb-1">
                                                        {senderName}
                                                    </div>
                                                    <div class={`chat-bubble text-xs sm:text-sm ${isOwn ? 'chat-bubble-primary' : ''}`}>
                                                        {messageData.message.content}
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    </For>
                                }>
                                    <div class="flex justify-center items-center h-full">
                                        <div class="loading loading-spinner loading-md text-primary"></div>
                                    </div>
                                </Show>
                                
                                {/* No messages state */}
                                <Show when={!loadingMessages() && selectedMessages().length === 0}>
                                    <div class="flex justify-center items-center h-full text-center">
                                        <div class="text-base-content/50">
                                            <Icon name="chat" class="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            <p class="text-sm">{tCommunity(lang(), 'noMessage')}</p>
                                        </div>
                                    </div>
                                </Show>
                            </div>

                            {/* Message Input */}
                            <div class="p-3 sm:p-4 border-t border-base-300 bg-base-200">
                                <div class="flex gap-2 items-end">
                                    <input
                                        type="text"
                                        class="input input-bordered flex-1 input-sm sm:input-md"
                                        placeholder={tCommunity(lang(), 'typeMessage')}
                                        value={newMessage()}
                                        onInput={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={handleKeyPress}
                                        disabled={sendingMessage()}
                                    />
                                    <button 
                                        class="btn btn-primary btn-sm"
                                        onClick={handleSendMessage}
                                        disabled={!newMessage().trim() || sendingMessage()}
                                    >
                                        <Show when={sendingMessage()}>
                                            <div class="loading loading-spinner loading-sm"></div>
                                        </Show>
                                        <Show when={!sendingMessage()}>
                                            <Icon name="right-arr" class="w-4 h-4 sm:w-5 sm:h-5" />
                                        </Show>
                                    </button>
                                </div>
                            </div>

                        </div>
                    </Show>
                </div>

                {/* Desktop View - Left Column */}
                <div class="hidden md:flex w-1/3 flex-col h-full border-r border-base-300 lg:p-4">
                    {/* Desktop Header */}
                    <div class="hidden md:flex flex-col gap-4 mb-6">
                        <h2 class="text-xl lg:text-2xl font-bold text-primary flex items-center gap-2">
                            <Icon name="groups" class="w-6 h-6 lg:w-7 lg:h-7" />
                            {tCommunity(lang(), 'community')}
                        </h2>
                        
                        {/* Desktop Tabs */}
                        <div class="tabs tabs-lifted">
                            <a 
                                role="tab" 
                                class={`tab ${activeTab() === 'conversations' ? 'tab-active' : ''}`}
                                onClick={() => {
                                    setActiveTab('conversations');
                                }}
                            >
                                <Icon name="chat" class="w-4 h-4 mr-2" />
                                {tCommunity(lang(), 'conversations')}
                            </a>
                            <a 
                                role="tab" 
                                class={`tab ${activeTab() === 'friends' ? 'tab-active' : ''}`}
                                onClick={() => {
                                    setActiveTab('friends');
                                }}
                            >
                                <Icon name="person_fill" class="w-4 h-4 mr-2" />
                                {tCommunity(lang(), 'friends')}
                            </a>
                        </div>
                    </div>

                    {/* Content area - responsive search and controls */}
                    <div class="mb-3 sm:mb-4">
                        {/* Search */}
                        <div class="flex gap-1 sm:gap-2">
                            <input 
                                type="text" 
                                placeholder={tCommunity(lang(), 'search')} 
                                class="input input-bordered input-sm sm:input-md flex-1 text-xs sm:text-sm"
                                value={searchQuery()}
                                onInput={(e) => {
                                    setSearchQuery(e.target.value);
                                }}
                            />
                            <button 
                                class="btn btn-primary btn-sm"
                                onClick={() => {
                                    const modalId = activeTab() === 'conversations' ? 'new_conversation_modal' : 'add_friend_modal';
                                    (document.getElementById(modalId) as HTMLDialogElement)?.showModal();
                                }}
                            >
                                <Icon name="add" class="w-3 h-3 sm:w-4 sm:h-4" />
                                <span class="hidden sm:inline">
                                    <Show when={activeTab() === 'conversations'} fallback="Ami">
                                        Conv
                                    </Show>
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Content List */}
                    <div class="p-2 flex-1 overflow-y-auto space-y-2">
                        <Show when={activeTab() === 'conversations'}>
                            <Show when={loadingConversations()} fallback={
                                <Show when={filteredConversations().length > 0} fallback={
                                    <div class="text-center py-8 text-base-content/70">
                                        <Icon name="chat" class="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        <p class="mb-2">{tCommunity(lang(), 'noConversationsFound')}</p>
                                        <Show when={searchQuery()}>
                                            <p class="text-sm">Essayez un autre terme de recherche</p>
                                        </Show>
                                        <Show when={!searchQuery()}>
                                            <p class="text-sm">{tCommunity(lang(), 'createNewConversation')}</p>
                                        </Show>
                                    </div>
                                }>
                                    <For each={filteredConversations()}>
                                        {(convData) => (
                                            <div 
                                                class={`card bg-base-200 hover:bg-base-300 cursor-pointer transition-all ${selectedConversation() === convData.conversation.id ? 'ring-2 ring-primary' : ''}`}
                                                onClick={() => {
                                                    setSelectedConversation(convData.conversation.id);
                                                    setNewConversationWithUserId(null); // Clear new conversation state
                                                }}
                                            >
                                                <div class="card-body p-4">
                                                    <div class="flex items-start justify-between">
                                                        <div class="flex-1 min-w-0">
                                                            <div class="flex items-center gap-2 mb-1">
                                                                <Icon 
                                                                    name={convData.conversation.type === 'group' ? 'groups' : 'person_outline'} 
                                                                    class="w-4 h-4 text-primary flex-shrink-0" 
                                                                />
                                                                <h3 class="font-semibold text-sm truncate">
                                                                    {getConversationTitle(convData)}
                                                                </h3>
                                                            </div>
                                                            <p class="text-xs text-base-content/70 truncate">
                                                                {convData.lastMessage?.content || tCommunity(lang(), 'noMessage')}
                                                            </p>
                                                        </div>
                                                        <div class="flex flex-col items-end gap-1">
                                                            <span class="text-xs text-base-content/50">
                                                                {getLastMessageTime(convData)}
                                                            </span>
                                                            <Show when={convData.unreadCount && convData.unreadCount > 0}>
                                                                <div class="badge badge-primary badge-sm">
                                                                    {convData.unreadCount}
                                                                </div>
                                                            </Show>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </For>
                                </Show>
                            }>
                                <div class="flex justify-center p-4">
                                    <div class="loading loading-spinner loading-md text-primary"></div>
                                </div>
                            </Show>
                        </Show>

                        <Show when={activeTab() === 'friends'}>
                            <Show when={loadingFriends()} fallback={
                                <div>
                                    {/* Received Friend Requests */}
                                    <Show when={filteredReceivedInvites().length > 0}>
                                        <div class="mb-4">
                                            <h4 class="text-sm font-semibold text-warning flex items-center gap-2 mb-2">
                                                <Icon name="person_fill" class="w-4 h-4" />
                                                {tCommunity(lang(), 'requestsReceived')} ({filteredReceivedInvites().length})
                                            </h4>
                                            <For each={filteredReceivedInvites()}>
                                                {(inviteData) => (
                                                    <div class="card bg-warning/10 border border-warning/20 hover:bg-warning/20 mb-2">
                                                        <div class="card-body p-4">
                                                            <div class="flex items-center justify-between">
                                                                <div class="flex items-center gap-3">
                                                                    <div class="avatar">
                                                                        <div class="w-10 h-10 rounded-full flex items-center justify-center">
                                                                            <Icon name="helmet" class="w-6 h-6 text-base-content" />
                                                                        </div>
                                                                    </div>
                                                                    <div class="flex-1">
                                                                        <h3 class="font-semibold text-sm">{inviteData.profile.username}</h3>
                                                                        <div class="flex items-center gap-1 text-xs text-base-content/70">
                                                                            <Icon name="road" class="w-3 h-3" />
                                                                            {inviteData.profile.mileage?.toLocaleString()} km
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div class="flex items-center gap-2">
                                                                    <div class="flex flex-col items-end gap-1 mr-2">
                                                                        <div class="badge badge-warning badge-sm">
                                                                            Demande reçue
                                                                        </div>
                                                                        <span class="text-xs text-base-content/50">
                                                                            {new Date(inviteData.friendship.updated_at).toLocaleDateString()}
                                                                        </span>
                                                                    </div>
                                                                    
                                                                    <div class="flex items-center gap-1">
                                                                        <button 
                                                                            class="btn btn-success btn-xs"
                                                                            onClick={() => handleAcceptFriendRequest(inviteData.friendship.id)}
                                                                            title={tCommunity(lang(), 'accept')}
                                                                        >
                                                                            <Icon name="person_fill" class="w-3 h-3" />
                                                                        </button>
                                                                        <button 
                                                                            class="btn btn-error btn-xs"
                                                                            onClick={() => handleDeclineFriendRequest(inviteData.friendship.id)}
                                                                            title={tCommunity(lang(), 'decline')}
                                                                        >
                                                                            <Icon name="person_outline" class="w-3 h-3" />
                                                                        </button>
                                                                        <button 
                                                                            class="btn btn-warning btn-xs"
                                                                            onClick={() => handleBlockFriendRequest(inviteData.friendship.id)}
                                                                            title={tCommunity(lang(), 'block')}
                                                                        >
                                                                            <Icon name="shield-lock" class="w-3 h-3" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    </Show>

                                    {/* Sent Friend Requests */}
                                    <Show when={filteredSentInvites().length > 0}>
                                        <div class="mb-4">
                                            <h4 class="text-sm font-semibold text-info flex items-center gap-2 mb-2">
                                                <Icon name="history" class="w-4 h-4" />
                                                {tCommunity(lang(), 'requestsSent')} ({filteredSentInvites().length})
                                            </h4>
                                            <For each={filteredSentInvites()}>
                                                {(inviteData) => (
                                                    <div class="card bg-info/10 border border-info/20 hover:bg-info/20 mb-2">
                                                        <div class="card-body p-4">
                                                            <div class="flex items-center justify-between">
                                                                <div class="flex items-center gap-3">
                                                                    <div class="avatar">
                                                                        <div class="w-10 h-10 rounded-full flex items-center justify-center">
                                                                            <Icon name="helmet" class="w-6 h-6 text-base-content" />
                                                                        </div>
                                                                    </div>
                                                                    <div class="flex-1">
                                                                        <h3 class="font-semibold text-sm">{inviteData.profile.username}</h3>
                                                                        <div class="flex items-center gap-1 text-xs text-base-content/70">
                                                                            <Icon name="road" class="w-3 h-3" />
                                                                            {inviteData.profile.mileage?.toLocaleString()} km
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div class="flex items-center gap-2">
                                                                    <div class="flex flex-col items-end gap-1 mr-2">
                                                                        <div class="badge badge-info badge-sm">
                                                                            En attente
                                                                        </div>
                                                                        <span class="text-xs text-base-content/50">
                                                                            {new Date(inviteData.friendship.updated_at).toLocaleDateString()}
                                                                        </span>
                                                                    </div>
                                                                    <button 
                                                                        class="btn btn-error btn-xs"
                                                                        onClick={() => handleCancelFriendRequest(inviteData.friendship.id)}
                                                                        title={tCommunity(lang(), 'cancelRequest')}
                                                                    >
                                                                        <Icon name="person_outline" class="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    </Show>

                                    {/* Accepted Friends */}
                                    <Show when={filteredFriends().length > 0}>
                                        <div class="mb-4">
                                            <h4 class="text-sm font-semibold text-success flex items-center gap-2 mb-2">
                                                <Icon name="person_fill" class="w-4 h-4" />
                                                {tCommunity(lang(), 'friends')} ({filteredFriends().length})
                                            </h4>
                                            <For each={filteredFriends()}>
                                                {(friendData) => (
                                                    <div 
                                                        class="card bg-base-200 hover:bg-base-300 mb-2 cursor-pointer transition-all"
                                                        onClick={() => handleMessageFriend(friendData.friendship.user_1_id === userId ? friendData.friendship.user_2_id : friendData.friendship.user_1_id)}
                                                    >
                                                        <div class="card-body p-4">
                                                            <div class="flex items-center justify-between">
                                                                <div class="flex items-center gap-3 flex-1">
                                                                    <div class="avatar">
                                                                        <div class="w-10 h-10 rounded-full flex items-center justify-center">
                                                                            <Icon name="helmet" class="w-6 h-6 text-base-content" />
                                                                        </div>
                                                                    </div>
                                                                    <div class="flex-1">
                                                                        <h3 class="font-semibold text-sm">{friendData.profile.username}</h3>
                                                                        <div class="flex items-center gap-1 text-xs text-base-content/70">
                                                                            <Icon name="road" class="w-3 h-3" />
                                                                            {friendData.profile.mileage?.toLocaleString()} km
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div class="flex items-center gap-2">
                                                                    <div class="flex flex-col items-end gap-1 mr-2">
                                                                        <div class="badge badge-success badge-sm">
                                                                            Ami
                                                                        </div>
                                                                        <span class="text-xs text-base-content/50">
                                                                            {new Date(friendData.friendship.updated_at).toLocaleDateString()}
                                                                        </span>
                                                                    </div>
                                                                    
                                                                    <div 
                                                                        class="dropdown dropdown-end"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <span class="text-xs text-base-content/50">
                                                                            {new Date(friendData.friendship.updated_at).toLocaleDateString()}
                                                                        </span>
                                                                    </div>
                                                                    
                                                                    <div class="dropdown dropdown-end">
                                                                        <div tabindex="0" role="button" class="btn btn-ghost btn-sm">
                                                                            <Icon name="more-vert" class="w-4 h-4" />
                                                                        </div>
                                                                        <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow">
                                                                            <li>
                                                                                <button 
                                                                                    onClick={() => handleMessageFriend(friendData.friendship.user_1_id === userId ? friendData.friendship.user_2_id : friendData.friendship.user_1_id)}
                                                                                >
                                                                                    <Icon name="chat" class="w-4 h-4" />
                                                                                    {tCommunity(lang(), 'sendMessage')}
                                                                                </button>
                                                                            </li>
                                                                            <li>
                                                                                <button 
                                                                                    class="text-error"
                                                                                    onClick={() => handleDeleteFriend(friendData.friendship.id)}
                                                                                >
                                                                                    <Icon name="person_outline" class="w-4 h-4" />
                                                                                    {tCommunity(lang(), 'delete')}
                                                                                </button>
                                                                            </li>
                                                                        </ul>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    </Show>

                                    {/* No Results Message */}
                                    <Show when={filteredReceivedInvites().length === 0 && filteredSentInvites().length === 0 && filteredFriends().length === 0}>
                                        <div class="text-center py-8 text-base-content/70">
                                            <Icon name="person_outline" class="w-12 h-12 mx-auto mb-2 opacity-50" />
                                            <p class="mb-2">{tCommunity(lang(), 'noFriendsFound')}</p>
                                            <Show when={searchQuery()}>
                                                <p class="text-sm">Essayez un autre terme de recherche</p>
                                            </Show>
                                        </div>
                                    </Show>
                                </div>
                            }>
                                <div class="flex justify-center p-4">
                                    <div class="loading loading-spinner loading-md text-primary"></div>
                                </div>
                            </Show>
                        </Show>
                    </div>
                </div>

                {/* Desktop View - Right Column - Chat Area */}
                <div class="hidden md:flex flex-1 flex-col h-full min-h-0 p-0">
                    <Show 
                        when={selectedConversation()} 
                        fallback={
                            <div class="flex-1 flex items-center justify-center text-center p-4">
                                <div>
                                    <Icon name="chat" class="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-base-content/30 mb-4" />
                                    <h3 class="text-base sm:text-lg font-semibold mb-2">{tCommunity(lang(), 'selectConversation')}</h3>
                                    <p class="text-sm sm:text-base text-base-content/70">
                                        Choisissez une conversation dans la liste pour commencer à discuter
                                    </p>
                                </div>
                            </div>
                        }
                    >
                        {/* Chat Header */}
                        <div class="flex items-center justify-between p-2 sm:p-4 border-b border-base-300 bg-base-200 rounded-t-lg">
                            {/* Mobile back button */}
                            <button 
                                class="btn btn-ghost btn-sm md:hidden mr-2"
                                onClick={() => setSelectedConversation(null)}
                            >
                                <Icon name="left-arr" class="w-4 h-4" />
                            </button>
                            
                            <div class="flex items-center gap-2 sm:gap-3 flex-1">
                                <Icon 
                                    name={selectedConversationData()?.conversation.type === 'group' ? 'groups' : 'person_outline'} 
                                    class="w-5 h-5 sm:w-6 sm:h-6 text-primary" 
                                />
                                <div class="min-w-0 flex-1">
                                    <h3 class="font-semibold text-sm sm:text-base truncate">
                                        <Show 
                                            when={selectedConversationData()} 
                                            fallback={getNewConversationTitle()}
                                        >
                                            {getConversationTitle(selectedConversationData()!)}
                                        </Show>
                                    </h3>
                                    <p class="text-xs sm:text-sm text-base-content/70">
                                        <Show when={selectedConversationData()?.conversation.type === 'group'} fallback={tCommunity(lang(), 'online')}>
                                            {selectedConversationData()?.participants.length} participants
                                        </Show>
                                    </p>
                                </div>
                            </div>
                            
                            {/* Chat Options Dropdown - Only show for existing conversations */}
                            <Show when={selectedConversationData()}>
                                <div class="dropdown dropdown-end">
                                    <div tabindex="0" role="button" class="btn btn-ghost btn-sm">
                                        <Icon name="more-vert" class="w-5 h-5" />
                                    </div>
                                    <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box z-[1] w-64 p-2 shadow-lg border border-base-200">
                                        <Show when={selectedConversationData()?.conversation.type === 'group'}>
                                        {/* Group Actions */}
                                        <li class="menu-title">
                                            <span class="text-xs font-semibold flex items-center gap-2">
                                                <Icon name="groups" class="w-4 h-4" />
                                                Actions de groupe
                                            </span>
                                        </li>
                                        <li>
                                            <button 
                                                onClick={() => {
                                                    // TODO: Implement invite member functionality
                                                    console.log('Invite new member to group');
                                                }}
                                            >
                                                <Icon name="person_fill" class="w-4 h-4" />
                                                Inviter un membre
                                            </button>
                                        </li>
                                        <li>
                                            <button 
                                                class="text-error"
                                                onClick={() => {
                                                    // TODO: Implement leave group functionality
                                                    console.log('Leave group');
                                                }}
                                            >
                                                <Icon name="person_outline" class="w-4 h-4" />
                                                Quitter le groupe
                                            </button>
                                        </li>
                                        
                                        <div class="divider my-1"></div>
                                        
                                        {/* Members List */}
                                        <li class="menu-title">
                                            <span class="text-xs font-semibold flex items-center gap-2">
                                                <Icon name="person_fill" class="w-4 h-4" />
                                                Membres ({selectedConversationData()?.participants.length})
                                            </span>
                                        </li>
                                        <div class="max-h-48 overflow-y-auto">
                                            <For each={selectedConversationData()?.participantProfiles}>
                                                {(participant) => (
                                                    <li>
                                                        <div class="flex items-center gap-3 py-2 cursor-default hover:bg-transparent">
                                                            <div class="avatar">
                                                                <div class="w-8 h-8 rounded-full bg-primary text-primary-content flex items-center justify-center">
                                                                    <Show when={participant.user_id === userId}>
                                                                        <Icon name="helmet" class="w-4 h-4" />
                                                                    </Show>
                                                                    <Show when={participant.user_id !== userId}>
                                                                        <span class="text-xs font-semibold">
                                                                            {participant.username.charAt(0).toUpperCase()}
                                                                        </span>
                                                                    </Show>
                                                                </div>
                                                            </div>
                                                            <div class="flex-1">
                                                                <div class="font-semibold text-sm">
                                                                    {participant.user_id === userId ? tCommunity(lang(), 'me') : participant.username}
                                                                </div>
                                                                <div class="flex items-center gap-1 text-xs text-base-content/70">
                                                                    <Icon name="road" class="w-3 h-3" />
                                                                    {participant.mileage?.toLocaleString()} km
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </li>
                                                )}
                                            </For>
                                        </div>
                                    </Show>
                                    
                                    <Show when={selectedConversationData()?.conversation.type === 'private'}>
                                        {/* Private Conversation Actions */}
                                        <li class="menu-title">
                                            <span class="text-xs font-semibold flex items-center gap-2">
                                                <Icon name="person_outline" class="w-4 h-4" />
                                                Actions
                                            </span>
                                        </li>
                                        <li>
                                            <button 
                                                class="text-error"
                                                onClick={() => {
                                                    // TODO: Implement leave/delete conversation functionality
                                                    console.log('Delete private conversation');
                                                }}
                                            >
                                                <Icon name="person_outline" class="w-4 h-4" />
                                                Supprimer la conversation
                                            </button>
                                        </li>
                                        
                                        <div class="divider my-1"></div>
                                        
                                        {/* Participant Info */}
                                        <li class="menu-title">
                                            <span class="text-xs font-semibold flex items-center gap-2">
                                                <Icon name="person_fill" class="w-4 h-4" />
                                                Participant
                                            </span>
                                        </li>
                                        <Show when={selectedConversationData()?.participantProfiles.find(p => p.user_id !== userId)}>
                                            {(otherParticipant) => (
                                                <li>
                                                    <div class="flex items-center gap-3 py-2 cursor-default hover:bg-transparent">
                                                        <div class="avatar">
                                                            <div class="w-8 h-8 rounded-full bg-primary text-primary-content flex items-center justify-center">
                                                                <span class="text-xs font-semibold">
                                                                    {otherParticipant().username.charAt(0).toUpperCase()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div class="flex-1">
                                                            <div class="font-semibold text-sm">{otherParticipant().username}</div>
                                                            <div class="flex items-center gap-1 text-xs text-base-content/70">
                                                                <Icon name="road" class="w-3 h-3" />
                                                                {otherParticipant().mileage?.toLocaleString()} km
                                                            </div>
                                                        </div>
                                                    </div>
                                                </li>
                                            )}
                                        </Show>
                                    </Show>
                                </ul>
                            </div>
                            </Show>
                        </div>

                        {/* Messages Area */}
                        <div class="flex-1 overflow-y-auto p-4 space-y-4 bg-base-100/50 min-h-0">
                            <Show when={loadingMessages()} fallback={
                                <For each={selectedMessages()}>
                                    {(messageData) => {
                                        const isOwn = messageData.message.sender_id === userId;
                                        const senderName = isOwn ? tCommunity(lang(), 'me') : (messageData.senderProfile?.username || tCommunity(lang(), 'unknownUser'));
                                        const messageTime = new Date(messageData.message.created_at).toLocaleTimeString('fr-FR', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        });
                                        
                                        return (
                                            <div class={`chat ${isOwn ? 'chat-end' : 'chat-start'}`}>
                                                <div class="chat-image avatar">
                                                    <div class="w-8 h-8 rounded-full bg-primary text-primary-content flex items-center justify-center">
                                                        <Show when={isOwn}>
                                                            <Icon name="helmet" class="w-4 h-4" />
                                                        </Show>
                                                        <Show when={!isOwn}>
                                                            <span class="text-xs font-semibold">
                                                                {senderName.charAt(0).toUpperCase()}
                                                            </span>
                                                        </Show>
                                                    </div>
                                                </div>
                                                <div class="chat-header text-xs opacity-50 mb-1">
                                                    {senderName}
                                                    <time class="ml-1">{messageTime}</time>
                                                </div>
                                                <div class={`chat-bubble ${isOwn ? 'chat-bubble-primary' : ''}`}>
                                                    {messageData.message.content}
                                                </div>
                                            </div>
                                        );
                                    }}
                                </For>
                            }>
                                <div class="flex justify-center items-center h-full">
                                    <div class="loading loading-spinner loading-md text-primary"></div>
                                </div>
                            </Show>
                            
                            {/* No messages state */}
                            <Show when={!loadingMessages() && selectedMessages().length === 0}>
                                <div class="flex justify-center items-center h-full text-center">
                                    <div class="text-base-content/50">
                                        <Icon name="chat" class="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        <p>{tCommunity(lang(), 'noMessage')}</p>
                                        <p class="text-sm mt-1">{tCommunity(lang(), 'sendMessage')}!</p>
                                    </div>
                                </div>
                            </Show>
                        </div>
                            {/* Message Input */}
                            <div class="p-4 border-t border-base-300 bg-base-200 rounded-b-lg">
                                <div class="flex gap-2 items-end">
                                    <input
                                        type="text"
                                        class="input input-bordered flex-1"
                                        placeholder={tCommunity(lang(), 'typeMessage')}
                                        value={newMessage()}
                                        onInput={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={handleKeyPress}
                                        disabled={sendingMessage()}
                                    />
                                    <button 
                                        class="btn btn-primary"
                                        onClick={handleSendMessage}
                                        disabled={!newMessage().trim() || sendingMessage()}
                                    >
                                        <Show when={sendingMessage()}>
                                            <div class="loading loading-spinner loading-sm"></div>
                                        </Show>
                                        <Show when={!sendingMessage()}>
                                            <Icon name="right-arr" class="w-5 h-5" />
                                        </Show>
                                    </button>
                                </div>
                            </div>
                        </Show>
                    </div>
                </div>
            </div>

            {/* Add Friend Modal */}
            <dialog id="add_friend_modal" class="modal">
                <div class="modal-box max-w-2xl">
                    <h3 class="text-lg font-bold mb-4">{tCommunity(lang(), 'addFriend')}</h3>
                    
                    {/* Search Section */}
                    <div class="form-control mb-4">
                        <label class="label">
                            <span class="label-text">{tCommunity(lang(), 'searchUsers')}</span>
                        </label>
                        <div class="flex gap-2">
                            <input 
                                type="text" 
                                placeholder={tCommunity(lang(), 'searchUsers')} 
                                class="input input-bordered flex-1"
                                value={userSearchQuery()}
                                onInput={(e) => {
                                    setUserSearchQuery(e.target.value);
                                }}
                            />
                            <Show when={loadingSearch()}>
                                <div class="flex items-center px-3">
                                    <div class="loading loading-spinner loading-sm"></div>
                                </div>
                            </Show>
                        </div>
                    </div>

                    {/* Search Results */}
                    <Show when={searchResults().length > 0}>
                        <div class="mb-4">
                            <h4 class="font-semibold mb-2">Résultats de recherche:</h4>
                            <div class="max-h-60 overflow-y-auto space-y-2">
                                <For each={searchResults()}>
                                    {(user) => (
                                        <div class="card bg-base-200 p-3">
                                            <div class="flex items-center justify-between">
                                                <div class="flex items-center gap-3">
                                                    <div class="avatar">
                                                        <div class="w-10 h-10 rounded-full flex items-center justify-center">
                                                            <Icon name="helmet" class="w-6 h-6 text-base-content" />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h5 class="font-semibold text-sm">{user.username}</h5>
                                                        <div class="flex items-center gap-1 text-xs text-base-content/70">
                                                            <Icon name="road" class="w-3 h-3" />
                                                            {user.mileage?.toLocaleString()} km
                                                        </div>
                                                    </div>
                                                </div>
                                                <button 
                                                    class="btn btn-primary btn-sm"
                                                    onClick={() => handleAddFriend(user.user_id || '')}
                                                >
                                                    <Icon name="person_fill" class="w-4 h-4 mr-1" />
                                                    {tCommunity(lang(), 'add')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>
                    </Show>

                    {/* No Results Message */}
                    <Show when={userSearchQuery() && searchResults().length === 0 && !loadingSearch()}>
                        <div class="text-center py-4 text-base-content/70">
                            <Icon name="person_outline" class="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>Aucun utilisateur trouvé pour "{userSearchQuery()}"</p>
                        </div>
                    </Show>

                    <div class="modal-action">
                        <form method="dialog">
                            <button class="btn">{tCommunity(lang(), 'close')}</button>
                        </form>
                    </div>
                </div>
                <form method="dialog" class="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>

            {/* New Conversation Modal */}
            <dialog id="new_conversation_modal" class="modal">
                <div class="modal-box max-w-2xl">
                    <form method="dialog">
                        <button 
                            class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                            onClick={resetConversationForm}
                        >✕</button>
                    </form>
                    <h3 class="text-lg font-bold mb-4">{tCommunity(lang(), 'newConversation')}</h3>
                    
                    {/* Conversation Name */}
                    <div class="form-control mb-4">
                        <label class="label">
                            <span class="label-text">
                                {tCommunity(lang(), 'conversationName')} 
                                <Show when={selectedParticipants().length > 1} fallback="(optionnel pour conversation privée)">
                                    (obligatoire pour groupe)
                                </Show>
                            </span>
                        </label>
                        <input 
                            type="text" 
                            placeholder={tCommunity(lang(), 'conversationName')} 
                            class="input input-bordered w-full" 
                            value={conversationName()}
                            onInput={(e) => setConversationName(e.target.value)}
                        />
                    </div>

                    {/* Participants Selection */}
                    <div class="form-control mb-4">
                        <label class="label">
                            <span class="label-text">{tCommunity(lang(), 'selectParticipants')}</span>
                        </label>
                        <input 
                            type="text" 
                            placeholder={tCommunity(lang(), 'searchParticipants')} 
                            class="input input-bordered w-full mb-3" 
                            value={participantSearchQuery()}
                            onInput={(e) => setParticipantSearchQuery(e.target.value)}
                        />

                        {/* Selected Participants */}
                        <Show when={selectedParticipants().length > 0}>
                            <div class="mb-3">
                                <h5 class="text-sm font-semibold mb-2 flex items-center gap-2">
                                    <Icon name="person_fill" class="w-4 h-4" />
                                    Participants sélectionnés ({selectedParticipants().length})
                                </h5>
                                <div class="flex flex-wrap gap-2">
                                    <For each={selectedParticipants()}>
                                        {(participant) => (
                                            <div class="badge badge-primary gap-2 p-3">
                                                <Icon name="helmet" class="w-3 h-3" />
                                                {participant.profile.username}
                                                <button 
                                                    class="btn btn-ghost btn-xs p-0 min-h-0 h-4 w-4"
                                                    onClick={() => handleRemoveParticipant(participant.friendship.id)}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </div>
                        </Show>

                        {/* Available Friends */}
                        <Show when={filteredAvailableParticipants().length > 0}>
                            <div class="max-h-48 overflow-y-auto border border-base-300 rounded-lg p-2">
                                <h5 class="text-sm font-semibold mb-2 flex items-center gap-2">
                                    <Icon name="person_outline" class="w-4 h-4" />
                                    {tCommunity(lang(), 'availableFriends')}
                                </h5>
                                <For each={filteredAvailableParticipants()}>
                                    {(friend) => (
                                        <div class="card bg-base-200 hover:bg-base-300 p-2 mb-1 cursor-pointer"
                                             onClick={() => handleAddParticipant(friend)}>
                                            <div class="flex items-center justify-between">
                                                <div class="flex items-center gap-2">
                                                    <div class="avatar">
                                                        <div class="w-8 h-8 rounded-full flex items-center justify-center">
                                                            <Icon name="helmet" class="w-4 h-4 text-base-content" />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h6 class="font-semibold text-sm">{friend.profile.username}</h6>
                                                        <div class="flex items-center gap-1 text-xs text-base-content/70">
                                                            <Icon name="road" class="w-3 h-3" />
                                                            {friend.profile.mileage?.toLocaleString()} km
                                                        </div>
                                                    </div>
                                                </div>
                                                <Icon name="add" class="w-4 h-4 text-primary" />
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </Show>

                        {/* No Available Friends Message */}
                        <Show when={filteredAvailableParticipants().length === 0 && friendsWithProfiles().length > 0}>
                            <div class="text-center py-4 text-base-content/70 border border-base-300 rounded-lg">
                                <Icon name="person_outline" class="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p class="text-sm">
                                    <Show when={participantSearchQuery()} fallback="Tous vos amis sont déjà sélectionnés">
                                        {tCommunity(lang(), 'noFriendsFoundFor')} "{participantSearchQuery()}"
                                    </Show>
                                </p>
                            </div>
                        </Show>

                        {/* No Friends Message */}
                        <Show when={friendsWithProfiles().length === 0}>
                            <div class="text-center py-4 text-base-content/70 border border-base-300 rounded-lg">
                                <Icon name="person_outline" class="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p class="text-sm">{tCommunity(lang(), 'needFriends')}</p>
                            </div>
                        </Show>

                        <div class="text-sm text-base-content/70 mt-2">
                            <Show when={selectedParticipants().length === 0}>
                                {tCommunity(lang(), 'selectFriend')}
                            </Show>
                            <Show when={selectedParticipants().length === 1}>
                                Conversation privée avec {selectedParticipants()[0].profile.username}
                            </Show>
                            <Show when={selectedParticipants().length > 1}>
                                Groupe de {selectedParticipants().length + 1} participants (vous inclus)
                            </Show>
                        </div>
                    </div>

                    <div class="modal-action">
                        <button 
                            class="btn btn-primary"
                            onClick={handleCreateConversation}
                            disabled={
                                selectedParticipants().length === 0 || 
                                creatingConversation() ||
                                (selectedParticipants().length > 1 && !conversationName().trim())
                            }
                        >
                            <Show when={creatingConversation()}>
                                <div class="loading loading-spinner loading-sm mr-2"></div>
                            </Show>
                            <Icon name="chat" class="w-4 h-4 mr-2" />
                            {tCommunity(lang(), 'createConversation')}
                        </button>
                        <form method="dialog">
                            <button class="btn" disabled={creatingConversation()} onClick={resetConversationForm}>{tCommunity(lang(), 'cancel')}</button>
                        </form>
                    </div>
                </div>
                <form method="dialog" class="modal-backdrop">
                    <button onClick={resetConversationForm}>close</button>
                </form>
            </dialog>
        </div>
        </Show>
    );
}
