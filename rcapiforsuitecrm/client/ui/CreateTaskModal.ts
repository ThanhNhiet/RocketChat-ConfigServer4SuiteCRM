import { IModify, IHttp, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IUIKitModalViewParam } from '@rocket.chat/apps-engine/definition/uikit/UIKitInteractionResponder';
import { ButtonStyle } from '@rocket.chat/apps-engine/definition/uikit';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { AppEnum } from '../constants/enum';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';

interface SCRMService {
    serverURL: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    id: string;
}

interface ModalState {
    isLoading: boolean;
    canCreateTask: boolean;
    errorMessage: string;
    scrmService: SCRMService | null;
}

interface UserTokenRecord {
    id: string;
    token: string;
    userId: string;
    createdAt: Date;
}

// Create modal for token setup with instructions
export async function createTokenSetupModal({
    modify,
    message,
    user
}: {
    modify: IModify;
    message?: IMessage;
    user: IUser;
}): Promise<IUIKitModalViewParam> {
    const block = modify.getCreator().getBlockBuilder();

    // Instructions for token setup
    block.addSectionBlock({
        text: block.newMarkdownTextObject(
            '⚠️ **Token Required**\n\n' +
            'To create tasks in SuiteCRM, this app needs your Personal Access Token.\n\n' +
            '**How to get your token:**\n' +
            '1. Go to **My Account** > **Personal Access Tokens**\n' +
            '2. Click **Create** to generate a new token\n' +
            '3. Copy the token and paste it below\n\n' +
            '*This token will be securely stored and only used to access your account.*'
        )
    });

    // Token input field
    block.addInputBlock({
        blockId: AppEnum.BLOCK_TOKEN_INPUT,
        label: block.newPlainTextObject('Personal Access Token'),
        element: block.newPlainTextInputElement({
            actionId: AppEnum.INPUT_TOKEN,
            placeholder: block.newPlainTextObject('Enter your Rocket.Chat Personal Access Token...'),
        }),
        optional: false
    });

    return {
        id: AppEnum.TOKEN_SETUP_MODAL_ID,
        title: block.newPlainTextObject('Setup Token'),
        blocks: block.getBlocks(),
        submit: block.newButtonElement({
            text: block.newPlainTextObject('Save Token'),
        }),
    };
}

// Create main task creation modal
export async function createTaskModal({
    modify,
    message,
    user,
    http,
    persistence,
    read
}: {
    modify: IModify;
    message?: IMessage;
    user: IUser;
    http?: IHttp;
    persistence?: IPersistence;
    read?: IRead;
}): Promise<IUIKitModalViewParam> {
    const block = modify.getCreator().getBlockBuilder();

    let modalState: ModalState = {
        isLoading: true,
        canCreateTask: false,
        errorMessage: '',
        scrmService: null
    };

    // Check SCRM connection and permissions
    if (http && persistence && read) {
        modalState = await initializeSCRM(user, http, persistence, read);
    }

    // Display loading state
    if (modalState.isLoading) {
        block.addSectionBlock({
            text: block.newMarkdownTextObject('🔄 **Loading SCRM connection...**')
        });
    }
    
    // Display error messages
    if (modalState.errorMessage) {
        block.addSectionBlock({
            text: block.newMarkdownTextObject(`⚠️ **${modalState.errorMessage}**`)
        });
    }

    // Show task form if user has permissions
    if (modalState.canCreateTask || !http) {
        // Input 1: Task Name
        block.addInputBlock({
            blockId: AppEnum.BLOCK_TASK_NAME,
            label: block.newPlainTextObject('Task Name'),
            element: block.newPlainTextInputElement({
                actionId: AppEnum.INPUT_TASK_NAME,
                placeholder: block.newPlainTextObject('Enter task title...'),
                initialValue: message?.text || '',
            }),
        });

        // Input 2: Description
        block.addInputBlock({
            blockId: AppEnum.BLOCK_TASK_DESC,
            label: block.newPlainTextObject('Description'),
            element: block.newPlainTextInputElement({
                actionId: AppEnum.INPUT_TASK_DESC,
                placeholder: block.newPlainTextObject('More details...'),
                multiline: true,
            }),
        });

        // Input 3: Priority
        block.addInputBlock({
            blockId: AppEnum.BLOCK_TASK_PRIORITY,
            label: block.newPlainTextObject('Priority'),
            element: block.newStaticSelectElement({
                actionId: AppEnum.INPUT_TASK_PRIORITY,
                placeholder: block.newPlainTextObject('Select priority'),
                options: [
                    {
                        text: block.newPlainTextObject('Low'),
                        value: 'Low'
                    },
                    {
                        text: block.newPlainTextObject('Medium'),
                        value: 'Medium'
                    },
                    {
                        text: block.newPlainTextObject('High'),
                        value: 'High'
                    }
                ],
                initialValue: 'Medium'
            }),
        });
    }

    // Debug Section - always show for now since we don't have access to process.env in Deno
    if (!modalState.canCreateTask) {
        block.addSectionBlock({
            text: block.newMarkdownTextObject(
                `---\n` +
                `**Debug Info:**\n` +
                `User: ${user.username}\n` +
                `Message ID: ${message?.id || 'N/A'}\n` +
                `Can Create Task: ${modalState.canCreateTask ? '✅' : '❌'}\n` +
                `SCRM Service: ${modalState.scrmService ? '✅ Connected' : '❌ Not Connected'}`
            )
        });
    }

    // Add action buttons section for token management
    if (modalState.canCreateTask) {
        block.addActionsBlock({
            blockId: 'token_actions',
            elements: [
                block.newButtonElement({
                    text: block.newPlainTextObject('Reset Token'),
                    actionId: 'reset_token_action',
                    style: ButtonStyle.DANGER
                })
            ]
        });
    }

    // Determine submit button text and behavior
    let submitText = 'Create Task';
    if (!modalState.canCreateTask && modalState.errorMessage.includes('Token not found')) {
        submitText = 'Setup Token';
    } else if (!modalState.canCreateTask) {
        submitText = 'Reset & Setup Token';
    }

    return {
        id: AppEnum.MODAL_ID,
        title: block.newPlainTextObject('Create SuiteCRM Task'),
        blocks: block.getBlocks(),
        submit: block.newButtonElement({
            text: block.newPlainTextObject(submitText),
        }),
    };
}

// Initialize SCRM connection and check permissions
async function initializeSCRM(user: IUser, http: IHttp, persistence: IPersistence, read: IRead): Promise<ModalState> {
    try {
        // Retrieve user's saved token
        const association = new RocketChatAssociationRecord(
            RocketChatAssociationModel.USER,
            user.id
        );
        
        const records = await read.getPersistenceReader().readByAssociation(association);
        
        const userTokenRecord = records?.find((record: any) => {
            return record.id === `${AppEnum.PERSISTENCE_USER_TOKEN_PREFIX}${user.id}`;
        }) as UserTokenRecord | undefined;

        if (!userTokenRecord?.token) {
            return {
                isLoading: false,
                canCreateTask: false,
                errorMessage: 'Token not found. Please setup your token first.',
                scrmService: null
            };
        }

        // Get server URL configuration
        let serverUrl: string;
        try {
            const settings = read.getEnvironmentReader().getSettings();
            serverUrl = await settings.getValueById('server_url');
        } catch (error) {
            // Fallback to default
            serverUrl = 'http://localhost:3000';
        }

        if (!serverUrl) {
            return {
                isLoading: false,
                canCreateTask: false,
                errorMessage: 'Server URL not configured.',
                scrmService: null
            };
        }

        // Get SCRM service connection
        const scrmService = await getSCRMService(userTokenRecord.token, serverUrl, user.id, http);
        
        if (!scrmService) {
            return {
                isLoading: false,
                canCreateTask: false,
                errorMessage: 'Please sign in to SuiteCRM first',
                scrmService: null
            };
        }

        // Verify task creation permissions
        const hasPermission = await checkTaskPermissions(scrmService, http);
        
        return {
            isLoading: false,
            canCreateTask: hasPermission,
            errorMessage: hasPermission ? '' : "You don't have permission to create tasks",
            scrmService
        };
    } catch (error) {
        return {
            isLoading: false,
            canCreateTask: false,
            errorMessage: 'Connection error. Please check your SuiteCRM configuration',
            scrmService: null
        };
    }
}

async function getSCRMService(rcToken: string, serverUrl: string, userId: string, http: IHttp): Promise<SCRMService | null> {
    try {
        const response = await http.get(`${serverUrl}/api/v1/me.scrmservice`, {
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

        // Check if token needs refresh
        const now = Date.now();
        if (now >= service.expiresAt) {
            const refreshedService = await refreshAccessToken(service, serverUrl, rcToken, userId, http);
            if (!refreshedService) {
                // Continue with existing token if refresh fails
                return service;
            }
            return refreshedService;
        }

        return service;
    } catch (error) {
        return null;
    }
}

async function refreshAccessToken(service: SCRMService, rcServerUrl: string, rcToken: string, userId: string, http: IHttp): Promise<SCRMService | null> {
    try {
        // Get client credentials
        const secretResponse = await http.get(`${service.serverURL}/custom/public/api/get_secret_oauth.php`);
        if (secretResponse.statusCode !== 200) {
            throw new Error('Failed to get client credentials');
        }
        
        const { client_id, client_secret } = secretResponse.data as any;

        // Refresh token
        const tokenResponse = await http.post(`${service.serverURL}/Api/access_token`, {
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
        const updateResponse = await http.put(`${rcServerUrl}/api/v1/me.scrmservice`, {
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
        return null;
    }
}

async function checkTaskPermissions(service: SCRMService, http: IHttp): Promise<boolean> {
    try {
        const response = await http.get(`${service.serverURL}/Api/V8/custom/user/${service.id}/roles-task`, {
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
        return false;
    }
}