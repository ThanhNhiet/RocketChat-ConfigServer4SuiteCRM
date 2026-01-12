// src/handlers/ActionHandler.ts
import { IRead, IModify, IHttp, IPersistence } from '@rocket.chat/apps-engine/definition/accessors';
import { UIKitActionButtonInteractionContext, IUIKitResponse } from '@rocket.chat/apps-engine/definition/uikit';
import { AppEnum } from '../constants/enum';
import { createTaskModal } from '../ui/CreateTaskModal';

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

            // Gọi hàm vẽ modal từ file UI
            const modal = await createTaskModal({ 
                modify: this.modify, 
                message, 
                user 
            });

            // Mở modal
            return context.getInteractionResponder().openModalViewResponse(modal);
        }

        return context.getInteractionResponder().successResponse();
    }
}