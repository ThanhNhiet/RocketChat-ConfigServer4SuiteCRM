// src/handlers/SubmitHandler.ts
import { IRead, IModify, IHttp, IPersistence } from '@rocket.chat/apps-engine/definition/accessors';
import { UIKitViewSubmitInteractionContext, IUIKitResponse } from '@rocket.chat/apps-engine/definition/uikit';
import { AppEnum } from '../constants/enum';

export class SubmitHandler {
    constructor(
        private readonly read: IRead,
        private readonly http: IHttp,
        private readonly modify: IModify,
        private readonly persistence: IPersistence,
    ) {}

    public async run(context: UIKitViewSubmitInteractionContext): Promise<IUIKitResponse> {
        const data = context.getInteractionData();
        const { view, user } = data;

        // Kiểm tra xem Modal submit có đúng là modal của mình không
        if (view.id === AppEnum.MODAL_ID) {
            const state = view.state as any;

            // Lấy dữ liệu từ State dựa trên các ID đã định nghĩa trong enum
            const taskName = state?.[AppEnum.BLOCK_TASK_NAME]?.[AppEnum.INPUT_TASK_NAME];
            const taskDesc = state?.[AppEnum.BLOCK_TASK_DESC]?.[AppEnum.INPUT_TASK_DESC];

            // --- LOGIC GỌI API SUITECRM CỦA BẠN Ở ĐÂY ---
            console.log(`[SuiteCRM App] Creating Task: ${taskName} - ${taskDesc}`);
            console.log(`[SuiteCRM App] By User: ${user.username}`);
            
            // Ví dụ gọi API (Code giả định)
            /*
            await this.http.post('https://your-crm.com/api/v8/modules/Tasks', {
                data: { name: taskName, description: taskDesc }
            });
            */

            // Trả về thành công (Modal sẽ đóng lại)
            return context.getInteractionResponder().successResponse();
        }

        return context.getInteractionResponder().successResponse();
    }
}