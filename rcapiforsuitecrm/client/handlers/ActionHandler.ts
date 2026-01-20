// src/handlers/ActionHandler.ts
import { IRead, IModify, IHttp, IPersistence } from '@rocket.chat/apps-engine/definition/accessors';
import { UIKitActionButtonInteractionContext, IUIKitResponse } from '@rocket.chat/apps-engine/definition/uikit';
import { AppEnum } from '../constants/enum';
import { createTaskModal, createTokenSetupModal } from '../ui/CreateTaskModal';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';

interface UserTokenRecord {
    id: string;
    token: string;
    userId: string;
    createdAt: Date;
}

export class ActionHandler {
    constructor(
        private readonly read: IRead,
        private readonly http: IHttp,
        private readonly modify: IModify,
        private readonly persistence: IPersistence,
    ) {}

    public async run(context: UIKitActionButtonInteractionContext): Promise<IUIKitResponse> {
        const data = context.getInteractionData();

        // Kiểm tra xem nút bấm có phải là nút của mình không
        if (data.actionId === AppEnum.ACTION_CREATE_TASK) {
            const { message, user } = data;

            // Check if user has saved token
            const association = new RocketChatAssociationRecord(
                RocketChatAssociationModel.USER,
                user.id
            );
            
            console.log('[SCRM] Checking for saved token for user:', user.id);
            
            const records = await this.read.getPersistenceReader().readByAssociation(association);
            
            console.log('[SCRM] Found records:', records?.length || 0);
            
            const userTokenRecord = records?.find((record: any) => {
                console.log('[SCRM] Checking record:', record.id, 'looking for:', `${AppEnum.PERSISTENCE_USER_TOKEN_PREFIX}${user.id}`);
                return record.id === `${AppEnum.PERSISTENCE_USER_TOKEN_PREFIX}${user.id}`;
            }) as UserTokenRecord | undefined;
            
            console.log('[SCRM] Token found:', !!userTokenRecord?.token);

            let modal;
            if (!userTokenRecord || !userTokenRecord.token) {
                // No token found, show token setup modal
                modal = await createTokenSetupModal({ 
                    modify: this.modify, 
                    message, 
                    user 
                });
            } else {
                // Token exists, show task creation modal
                modal = await createTaskModal({ 
                    modify: this.modify, 
                    message, 
                    user,
                    http: this.http,
                    persistence: this.persistence,
                    read: this.read
                });
            }

            // Mở modal
            return context.getInteractionResponder().openModalViewResponse(modal);
        }
        
        // Handle reset token action
        if (data.actionId === AppEnum.ACTION_RESET_TOKEN) {
            const { user } = data;
            
            console.log('[SCRM] Resetting token for user:', user.id);
            
            try {
                // Delete existing token
                const association = new RocketChatAssociationRecord(
                    RocketChatAssociationModel.USER,
                    user.id
                );
                
                // Remove token from persistence
                await this.persistence.removeByAssociation(association);
                
                console.log('[SCRM] Token reset successfully');
                
                // Show token setup modal
                const modal = await createTokenSetupModal({ 
                    modify: this.modify, 
                    message: undefined, 
                    user 
                });
                
                return context.getInteractionResponder().updateModalViewResponse(modal);
                
            } catch (error) {
                console.error('[SCRM] Error resetting token:', error);
                return context.getInteractionResponder().errorResponse();
            }
        }

        return context.getInteractionResponder().successResponse();
    }
}