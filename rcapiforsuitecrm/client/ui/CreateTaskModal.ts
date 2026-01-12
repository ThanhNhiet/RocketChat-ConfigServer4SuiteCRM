import { IModify } from '@rocket.chat/apps-engine/definition/accessors';
import { IUIKitModalViewParam } from '@rocket.chat/apps-engine/definition/uikit/UIKitInteractionResponder';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { AppEnum } from '../constants/enum'; // Lưu ý: Kiểm tra lại tên file là enum.ts hay enums.ts

export async function createTaskModal({
    modify,
    message,
    user
}: {
    modify: IModify;
    message?: IMessage;
    user: IUser;
}): Promise<IUIKitModalViewParam> {
    const block = modify.getCreator().getBlockBuilder();

    // BƯỚC 1: Sử dụng hàm addInputBlock để thêm block vào builder
    
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

    // Section: Debug Info
    block.addSectionBlock({
        text: block.newMarkdownTextObject(
            `--- \n` +
            `**User Context:** ${user.username} (${user.emails})\n` +
            `**Source Message:** ${message?.id || 'N/A'}`
        )
    });

    // BƯỚC 2: Trả về cấu trúc Modal với block.getBlocks()
    return {
        id: AppEnum.MODAL_ID,
        title: block.newPlainTextObject('Create SuiteCRM Task'),
        blocks: block.getBlocks(), // <--- QUAN TRỌNG: Lấy danh sách block đã add ở trên
        submit: block.newButtonElement({
            text: block.newPlainTextObject('Create'),
        }),
    };
}