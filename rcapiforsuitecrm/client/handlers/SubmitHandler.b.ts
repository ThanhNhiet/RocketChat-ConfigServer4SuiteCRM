// src/handlers/SubmitHandler.ts
import { IRead, IModify, IHttp, IPersistence } from '@rocket.chat/apps-engine/definition/accessors';
import { UIKitViewSubmitInteractionContext, IUIKitResponse } from '@rocket.chat/apps-engine/definition/uikit';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { RoomType } from '@rocket.chat/apps-engine/definition/rooms';
import { AppEnum } from '../constants/enum';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { createTaskModal } from '../ui/CreateTaskModal';

interface SCRMService {
    serverURL: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    id: string;
}

interface UserTokenRecord {
    id: string;
    token: string;
    userId: string;
    createdAt: Date;
}

export class SubmitHandler {
    constructor(
        private readonly read: IRead,
        private readonly http: IHttp,
        private readonly modify: IModify,
        private readonly persistence: IPersistence,
    ) {}

    private async sendNotification(user: IUser, room: IRoom | undefined, text: string): Promise<void> {
        let targetRoom = room;

        // BƯỚC 1: Xác định phòng chat (Nếu mất context thì tìm phòng DM với Bot)
        if (!targetRoom) {
            try {
                const appUser = await this.read.getUserReader().getAppUser();
                
                if (appUser && appUser.username && user.username) {
                    // Tìm phòng DM cũ
                    targetRoom = await this.read.getRoomReader().getDirectByUsernames([appUser.username, user.username]);

                    // Nếu chưa có, tạo phòng DM mới
                    if (!targetRoom) {
                        const roomBuilder = this.modify.getCreator().startRoom()
                            .setType(RoomType.DIRECT_MESSAGE)
                            .setCreator(appUser)
                            .addMemberToBeAddedByUsername(user.username);
                        
                        const roomId = await this.modify.getCreator().finish(roomBuilder);
                        targetRoom = await this.read.getRoomReader().getById(roomId) as IRoom;
                    }
                }
            } catch (error) {
                console.log('[Notification] Error getting/creating DM room:', error);
            }
        }

        // BƯỚC 2: Gửi tin nhắn thật (Persistent Message)
        if (targetRoom) {
            try {
                const appUser = await this.read.getUserReader().getAppUser();
                if (appUser) {
                    // Dùng getCreator().startMessage() với app user như bot
                    const messageBuilder = this.modify.getCreator().startMessage()
                        .setSender(appUser)
                        .setRoom(targetRoom)
                        .setText(text)
                        .setGroupable(false); // Không gom nhóm để tin nhắn nổi bật hơn

                    // Lệnh này sẽ lưu tin nhắn vào DB và bắn thông báo cho User
                    await this.modify.getCreator().finish(messageBuilder);
                    console.log('[Notification] Message sent successfully to room:', targetRoom.id);
                }
            } catch (error) {
                console.log('[Notification] Error sending message:', error);
            }
        } else {
            console.log('[Notification] Cannot send message: No room context available.');
        }
    }

    public async run(context: UIKitViewSubmitInteractionContext): Promise<IUIKitResponse> {
        const data = context.getInteractionData();
        const { view, user } = data;

        console.log('[SCRM] Submit handler called for view ID:', view.id);
        console.log('[SCRM] Expected token setup modal ID:', AppEnum.TOKEN_SETUP_MODAL_ID);
        console.log('[SCRM] Expected task modal ID:', AppEnum.MODAL_ID);

        // Handle token setup modal
        if (view.id === AppEnum.TOKEN_SETUP_MODAL_ID) {
            console.log('[SCRM] Processing token setup modal');
            console.log('[SCRM] Expected BLOCK_ID:', AppEnum.BLOCK_TOKEN_INPUT);
            console.log('[SCRM] Expected INPUT_ID:', AppEnum.INPUT_TOKEN);
            const state = view.state as any;
            
            console.log('[SCRM] Full form state:', JSON.stringify(state, null, 2));
            
            // Try different ways to get the token value
            let token = state?.[AppEnum.BLOCK_TOKEN_INPUT]?.[AppEnum.INPUT_TOKEN]?.value;
            
            // If that doesn't work, try alternative access patterns
            if (!token) {
                token = state?.[AppEnum.BLOCK_TOKEN_INPUT]?.[AppEnum.INPUT_TOKEN];
                console.log('[SCRM] Trying alternative access pattern 1:', !!token);
            }
            
            if (!token) {
                // Sometimes the value is directly under the input key
                const blockState = state?.[AppEnum.BLOCK_TOKEN_INPUT];
                if (blockState) {
                    console.log('[SCRM] Block state structure:', JSON.stringify(blockState, null, 2));
                    token = blockState[AppEnum.INPUT_TOKEN]?.value || blockState[AppEnum.INPUT_TOKEN];
                }
            }

            console.log('[SCRM] Token setup - received token:', !!token, 'length:', token?.length || 0);
            console.log('[SCRM] Token preview:', token ? token.substring(0, 10) + '...' : 'null/undefined');

            if (!token || !token.trim()) {
                console.log('[SCRM] Token setup failed - empty token');
                return context.getInteractionResponder().errorResponse();
            }

            try {
                // Save token to persistence
                const association = new RocketChatAssociationRecord(
                    RocketChatAssociationModel.USER,
                    user.id
                );
                
                // Create token record with proper structure
                const tokenRecord = {
                    id: `${AppEnum.PERSISTENCE_USER_TOKEN_PREFIX}${user.id}`,
                    token: token.trim(),
                    userId: user.id,
                    createdAt: new Date().toISOString()
                };
                
                console.log('[SCRM] Saving token record:', { id: tokenRecord.id, userId: user.id });
                
                await this.persistence.createWithAssociation(
                    tokenRecord,
                    association
                );

                console.log('[SCRM] Token saved successfully');

                // Send token success notification
                try {
                    console.log('[SCRM] Attempting to send token success notification...');
                    console.log('[SCRM] Token setup context data:', JSON.stringify({
                        hasTriggerId: !!data.triggerId,
                        triggerId: data.triggerId,
                        hasRoom: !!data.room,
                        roomId: data.room?.id,
                        userId: user.id,
                        userName: user.username
                    }, null, 2));
                    
                    let room: IRoom | undefined;
                    
                    console.log('[SCRM] Attempting to get room for token success notification...');
                    
                    // Try triggerId as message ID to get message then room
                    if (data.triggerId) {
                        try {
                            const message = await this.read.getMessageReader().getById(data.triggerId);
                            if (message?.room) {
                                room = message.room;
                                console.log('[SCRM] Got room from message via triggerId for token success');
                            }
                        } catch (e: any) {
                            console.log('[SCRM] Could not get message from triggerId for token success:', e.message);
                        }
                    }
                    
                    // Fallback to direct message  
                    if (!room) {
                        try {
                            room = await this.read.getRoomReader().getDirectByUsernames([user.username]);
                            if (room) {
                                console.log('[SCRM] Using direct room for token success');
                            }
                        } catch (e: any) {
                            console.log('[SCRM] Could not get direct room for token success:', e.message);
                        }
                    }
                    
                    if (room) {
                        const messageBuilder = this.modify.getCreator().startMessage()
                            .setSender(user)
                            .setRoom(room)
                            .setText(`✅ **Token Saved Successfully!**\n\n` +
                                    `Your Personal Access Token has been saved and you can now create tasks.`);
                        
                        await this.modify.getCreator().finish(messageBuilder);
                        console.log('[SCRM] Token success message sent to room');
                    } else {
                        console.log('[SCRM] No room available for token success notification');
                    }
                } catch (msgError) {
                    console.error('[SCRM] Error sending token success message:', msgError);
                }

                // After saving token, open task creation modal
                const taskModal = await createTaskModal({ 
                    modify: this.modify, 
                    message: undefined, // No message context from token setup
                    user,
                    http: this.http,
                    persistence: this.persistence,
                    read: this.read
                });

                return context.getInteractionResponder().updateModalViewResponse(taskModal);

            } catch (error) {
                console.error('Error saving token:', error);
                return context.getInteractionResponder().errorResponse();
            }
        }

        // Handle task creation modal
        if (view.id === AppEnum.MODAL_ID) {
            console.log('[SCRM Task Creation] Debug context data:', JSON.stringify({
                hasTriggerId: !!data.triggerId,
                triggerId: data.triggerId,
                hasRoom: !!data.room,
                roomId: data.room?.id,
                roomType: data.room?.type,
                userId: user.id,
                userName: user.username
            }, null, 2));
            
            const state = view.state as any;

            console.log('[SCRM Task Creation] Full form state structure:', JSON.stringify(state, null, 2));
            console.log('[SCRM Task Creation] Looking for block IDs:', {
                BLOCK_TASK_NAME: AppEnum.BLOCK_TASK_NAME,
                BLOCK_TASK_DESC: AppEnum.BLOCK_TASK_DESC,
                BLOCK_TASK_PRIORITY: AppEnum.BLOCK_TASK_PRIORITY
            });
            console.log('[SCRM Task Creation] Looking for input IDs:', {
                INPUT_TASK_NAME: AppEnum.INPUT_TASK_NAME,
                INPUT_TASK_DESC: AppEnum.INPUT_TASK_DESC,
                INPUT_TASK_PRIORITY: AppEnum.INPUT_TASK_PRIORITY
            });

            // Lấy dữ liệu từ State dựa trên các ID đã định nghĩa trong enum
            const taskName = state?.[AppEnum.BLOCK_TASK_NAME]?.[AppEnum.INPUT_TASK_NAME];
            const taskDesc = state?.[AppEnum.BLOCK_TASK_DESC]?.[AppEnum.INPUT_TASK_DESC];
            const taskPriority = state?.[AppEnum.BLOCK_TASK_PRIORITY]?.[AppEnum.INPUT_TASK_PRIORITY] || 'Medium';

            console.log('[SCRM Task Creation] Processing task creation with data:', {
                taskName: taskName,
                taskDesc: taskDesc?.substring(0, 50) + '...',
                taskPriority: taskPriority
            });

            if (!taskName?.trim()) {
                console.log('[SCRM Task Creation] Failed - empty task name');
                return context.getInteractionResponder().errorResponse();
            }

            try {
                // Get user token
                const association = new RocketChatAssociationRecord(
                    RocketChatAssociationModel.USER,
                    user.id
                );
                
                console.log('[SCRM Task Creation] Checking for saved token for user:', user.id);
                
                const records = await this.read.getPersistenceReader().readByAssociation(association);
                
                console.log('[SCRM Task Creation] Found records:', records?.length || 0);
                
                const userTokenRecord = records?.find((record: any) => {
                    console.log('[SCRM Task Creation] Checking record:', record.id, 'looking for:', `${AppEnum.PERSISTENCE_USER_TOKEN_PREFIX}${user.id}`);
                    return record.id === `${AppEnum.PERSISTENCE_USER_TOKEN_PREFIX}${user.id}`;
                }) as UserTokenRecord | undefined;
                
                console.log('[SCRM Task Creation] Token found:', !!userTokenRecord?.token);

                if (!userTokenRecord?.token) {
                    console.log('[SCRM Task Creation] No token found');
                    return context.getInteractionResponder().errorResponse();
                }

                // Get Rocket.Chat server URL from app settings
                let serverUrl: string;
                try {
                    const settings = this.read.getEnvironmentReader().getSettings();
                    serverUrl = await settings.getValueById('server_url');
                    console.log('[SCRM Task Creation] Server URL from settings:', serverUrl);
                } catch (error) {
                    console.error('[SCRM Task Creation] Error getting server URL from settings:', error);
                    // Fallback to default or hardcoded value if needed
                    serverUrl = 'http://localhost:3000'; // You might want to configure this
                }

                // Get SCRM service info
                console.log('[SCRM Task Creation] Getting SCRM service...');
                const scrmService = await this.getSCRMService(userTokenRecord.token, serverUrl, user.id);
                
                if (!scrmService) {
                    console.log('[SCRM Task Creation] Failed to get SCRM service');
                    return context.getInteractionResponder().errorResponse();
                }
                
                console.log('[SCRM Task Creation] SCRM service obtained successfully');

                // Check task permissions
                console.log('[SCRM Task Creation] Checking task permissions...');
                const hasPermission = await this.checkTaskPermissions(scrmService);
                console.log('[SCRM Task Creation] Permission check result:', hasPermission);
                
                if (!hasPermission) {
                    console.log('[SCRM Task Creation] Permission denied');
                    return context.getInteractionResponder().errorResponse();
                }

                // Create task in SuiteCRM
                console.log('[SCRM Task Creation] Creating task in SuiteCRM...');
                const success = await this.createTaskInSuiteCRM(scrmService, {
                    name: taskName,
                    description: taskDesc,
                    priority: taskPriority
                });
                
                console.log('[SCRM Task Creation] Task creation result:', success);

                if (success) {
                    console.log('[SCRM Task Creation] Task created successfully!');
                    console.log(`[SCRM Task Creation] Task details - Name: ${taskName}, Priority: ${taskPriority}, Description: ${taskDesc || 'No description'}`);
                    
                    // Send success notification using app bot
                    await this.sendNotification(
                        user, 
                        data.room, // Try room from context first
                        `🎉 **Task Created Successfully!**\n\n` +
                        `**Task Name:** ${taskName}\n` +
                        `**Priority:** ${taskPriority}\n` +
                        `**Description:** ${taskDesc || 'No description'}\n\n` +
                        `✅ Task has been created in SuiteCRM`
                    );
                    
                    return context.getInteractionResponder().successResponse();
                } else {
                    console.log('[SCRM Task Creation] Task creation failed');
                    
                    // Send error notification using app bot
                    await this.sendNotification(
                        user, 
                        data.room,
                        `❌ **Failed to Create Task**\n\n` +
                        `There was an error creating the task in SuiteCRM. Please try again.`
                    );
                    
                    return context.getInteractionResponder().errorResponse();
                }

            } catch (error) {
                console.error('Error creating task:', error);
                return context.getInteractionResponder().errorResponse();
            }
        }

        return context.getInteractionResponder().successResponse();
    }

    private async getSCRMService(rcToken: string, serverUrl: string, userId: string): Promise<SCRMService | null> {
        try {
            const response = await this.http.get(`${serverUrl}/api/v1/me.scrmservice`, {
                headers: {
                    'X-Auth-Token': rcToken,
                    'X-User-Id': userId
                }
            });

            if (response.statusCode !== 200) {
                return null;
            }

            const data = response.data as any;
            
            if (!data.services || Object.keys(data.services).length === 0 || !data.services._OAuthCustom) {
                return null;
            }

            const service = {
                serverURL: data.services.serverURL,
                accessToken: data.services.accessToken,
                refreshToken: data.services.refreshToken,
                expiresAt: data.services.expiresAt,
                id: data.services.id
            };

            // Check if token is expired and refresh if needed
            const now = Date.now();
            if (now >= service.expiresAt) {
                return await this.refreshAccessToken(service, serverUrl, rcToken, userId);
            }

            return service;
        } catch (error) {
            console.error('Error getting SCRM service:', error);
            return null;
        }
    }

    private async refreshAccessToken(service: SCRMService, rcServerUrl: string, rcToken: string, userId: string): Promise<SCRMService | null> {
        try {
            // Get client credentials
            const secretResponse = await this.http.get(`${service.serverURL}/custom/public/api/get_secret_oauth.php`);
            if (secretResponse.statusCode !== 200) {
                throw new Error('Failed to get client credentials');
            }
            
            const { client_id, client_secret } = secretResponse.data as any;

            // Refresh token
            const tokenResponse = await this.http.post(`${service.serverURL}/Api/access_token`, {
                headers: {
                    'Content-Type': 'application/json'
                },
                data: {
                    grant_type: 'refresh_token',
                    client_id,
                    client_secret,
                    refresh_token: service.refreshToken
                }
            });

            if (tokenResponse.statusCode !== 200) {
                throw new Error('Failed to refresh token');
            }

            const tokenData = tokenResponse.data as any;

            // Update tokens in Rocket.Chat
            const updateResponse = await this.http.put(`${rcServerUrl}/api/v1/me.scrmservice`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Auth-Token': rcToken,
                    'X-User-Id': userId
                },
                data: tokenData
            });

            if (updateResponse.statusCode !== 200) {
                throw new Error('Failed to update tokens');
            }

            return {
                ...service,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                expiresAt: Date.now() + (tokenData.expires_in * 1000)
            };
        } catch (error) {
            console.error('Error refreshing token:', error);
            return null;
        }
    }

    private async checkTaskPermissions(service: SCRMService): Promise<boolean> {
        try {
            const response = await this.http.get(`${service.serverURL}/Api/V8/custom/user/${service.id}/roles-task`, {
                headers: {
                    'Authorization': `Bearer ${service.accessToken}`
                }
            });

            if (response.statusCode !== 200) {
                return false;
            }

            const data = response.data as any;

            // If no roles are configured (empty roles array), default is to allow all access
            if (!data.roles || data.roles.length === 0 || data.total_roles === 0) {
                return true;
            }

            // Check for access permission in configured roles
            for (const role of data.roles) {
                for (const action of role.actions || []) {
                    if (action.name === 'access' && action.category === 'Tasks') {
                        const accessOverride = action.access_override;
                        return accessOverride !== -98 && accessOverride !== -99;
                    }
                }
            }

            // If roles exist but no specific access permission found, deny access
            return false;
        } catch (error) {
            console.error('Error checking task permissions:', error);
            return false;
        }
    }

    private async createTaskInSuiteCRM(service: SCRMService, taskData: { name: string; description: string; priority: string }): Promise<boolean> {
        try {
            const response = await this.http.post(`${service.serverURL}/Api/V8/module`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${service.accessToken}`
                },
                data: {
                    data: {
                        type: 'Tasks',
                        attributes: {
                            name: taskData.name,
                            description: taskData.description,
                            priority: taskData.priority
                        }
                    }
                }
            });

            return response.statusCode === 201;
        } catch (error) {
            console.error('Error creating task in SuiteCRM:', error);
            return false;
        }
    }
}