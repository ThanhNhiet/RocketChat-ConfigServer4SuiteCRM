// src/handlers/ActionHandler.ts
import { IRead, IModify, IHttp, IPersistence } from '@rocket.chat/apps-engine/definition/accessors';
import { UIKitActionButtonInteractionContext, UIKitBlockInteractionContext, IUIKitResponse } from '@rocket.chat/apps-engine/definition/uikit';
import { RoomType } from '@rocket.chat/apps-engine/definition/rooms';
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

        // Handle Create Task button
        if (data.actionId === AppEnum.ACTION_CREATE_TASK) {
            const { message, user } = data;

            // Check for existing user token
            const association = new RocketChatAssociationRecord(
                RocketChatAssociationModel.USER,
                user.id
            );
            
            const records = await this.read.getPersistenceReader().readByAssociation(association);
            
            const userTokenRecord = records?.find((record: any) => {
                return record.id === `${AppEnum.PERSISTENCE_USER_TOKEN_PREFIX}${user.id}`;
            }) as UserTokenRecord | undefined;

            let modal;
            if (!userTokenRecord || !userTokenRecord.token) {
                // No token - show token setup modal
                modal = await createTokenSetupModal({ 
                    modify: this.modify, 
                    message, 
                    user 
                });
            } else {
                // Token exists - show task creation modal
                modal = await createTaskModal({ 
                    modify: this.modify, 
                    message, 
                    user,
                    http: this.http,
                    persistence: this.persistence,
                    read: this.read
                });
            }

            // Open modal
            return context.getInteractionResponder().openModalViewResponse(modal);
        }

        return context.getInteractionResponder().successResponse();
    }

    // Handle block interactions (reset token button)
    public async runBlockAction(context: UIKitBlockInteractionContext): Promise<IUIKitResponse> {
        const data = context.getInteractionData();

        // Handle reset token action
        if (data.actionId === AppEnum.ACTION_RESET_TOKEN) {
            const { user } = data;
            
            try {
                // Delete existing token from persistence
                const association = new RocketChatAssociationRecord(
                    RocketChatAssociationModel.USER,
                    user.id
                );
                
                await this.persistence.removeByAssociation(association);
                
                // Send notification about reset success
                try {
                    const appUser = await this.read.getUserReader().getAppUser();
                    if (appUser) {
                        // Find or create DM room
                        let targetRoom = await this.read.getRoomReader().getDirectByUsernames([appUser.username, user.username]);
                        
                        if (!targetRoom) {
                            const roomBuilder = this.modify.getCreator().startRoom()
                                .setType(RoomType.DIRECT_MESSAGE)
                                .setCreator(appUser)
                                .addMemberToBeAddedByUsername(user.username);
                            
                            const roomId = await this.modify.getCreator().finish(roomBuilder);
                            const newRoom = await this.read.getRoomReader().getById(roomId);
                            if (newRoom) {
                                targetRoom = newRoom;
                            }
                        }
                        
                        if (targetRoom) {
                            const messageBuilder = this.modify.getCreator().startMessage()
                                .setSender(appUser)
                                .setRoom(targetRoom)
                                .setText(`🔄 **Token Reset Successfully**\n\n` +
                                        `Your SuiteCRM token has been removed. Use the "Create Task" button to set up a new token.`)
                                .setGroupable(false);
                            
                            await this.modify.getCreator().finish(messageBuilder);
                        }
                    }
                } catch (notifError) {
                    // Notification failed but token was reset
                }
                
                // Show reset confirmation modal
                const blockBuilder = this.modify.getCreator().getBlockBuilder();
                
                const confirmationBlocks = [
                    blockBuilder.addSectionBlock({
                        text: blockBuilder.newMarkdownTextObject(
                            '✅ **Token Reset Successfully**\n\n' +
                            'Your SuiteCRM token has been removed.\n\n' +
                            '**Next Steps:**\n' +
                            '1. Close this dialog\n' +
                            '2. Use the "Create Task" button to set up a new token'
                        )
                    }).getBlocks()[0]
                ];
                
                return context.getInteractionResponder().updateModalViewResponse({
                    id: AppEnum.TOKEN_SETUP_MODAL_ID,
                    title: blockBuilder.newPlainTextObject('Reset Complete'),
                    blocks: confirmationBlocks,
                    close: blockBuilder.newButtonElement({
                        text: blockBuilder.newPlainTextObject('Close'),
                    })
                });
                
            } catch (error) {
                return context.getInteractionResponder().errorResponse();
            }
        }

        return context.getInteractionResponder().successResponse();
    }
}